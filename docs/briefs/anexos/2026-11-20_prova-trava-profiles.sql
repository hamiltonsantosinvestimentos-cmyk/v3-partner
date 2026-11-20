-- PROVA EM TRANSAÇÃO DESFEITA da migration 20261120a (BRIEF 2026-11-20_rls-crm-insert-e-profiles-update-own.md)
-- Roda tudo dentro de um único bloco e TERMINA COM ERRO DE PROPÓSITO: o Postgres desfaz tudo,
-- inclusive a função, o trigger, a política e as trocas de papel da conta de teste. Nada fica gravado.
-- O resultado aparece na MENSAGEM DE ERRO ("RESULTADO DA PROVA: ..."). Esperado: todas as linhas com OK.
-- Conta usada: QA Playwright (conta de teste, 6568e9d3...). Perfil alvo dos casos "outro" (57375034...): só dentro da transação.
DO $prova$
DECLARE
  qa uuid := '6568e9d3-1056-448b-989e-748d6b15831b';
  outro uuid := '57375034-ee87-4b29-a784-2220037c4802';
  res text := '';
  n int;
BEGIN
  -- 0) Aplica a migration (sem BEGIN/COMMIT, porque já estamos numa transação)
  EXECUTE $f$
  CREATE OR REPLACE FUNCTION public.profiles_trava_colunas_sensiveis()
  RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $b$
  DECLARE
    papel text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
    permitidas text[] := ARRAY['updated_at'];
    novo jsonb := to_jsonb(NEW); velho jsonb := to_jsonb(OLD); k text;
  BEGIN
    IF papel IS NULL OR papel = 'service_role' THEN RETURN NEW; END IF;
    IF papel = 'authenticated' AND get_user_role()::text = 'ADMIN' THEN RETURN NEW; END IF;
    FOR k IN SELECT jsonb_object_keys(novo) LOOP
      IF NOT (k = ANY(permitidas)) AND (novo -> k) IS DISTINCT FROM (velho -> k) THEN
        RAISE EXCEPTION 'Alteração não permitida neste campo do perfil.' USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END; $b$ $f$;
  EXECUTE 'DROP TRIGGER IF EXISTS profiles_trava_colunas_sensiveis ON public.profiles';
  EXECUTE 'CREATE TRIGGER profiles_trava_colunas_sensiveis BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_trava_colunas_sensiveis()';
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.profiles_trava_colunas_sensiveis() FROM anon, public';
  EXECUTE 'DROP POLICY IF EXISTS crm_insert ON public.crm_leads';
  EXECUTE $p$CREATE POLICY crm_insert ON public.crm_leads FOR INSERT TO authenticated
    WITH CHECK (partner_id = auth.uid() OR get_user_role() = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role,'MESA_OPERACIONAL'::user_role,'SDR'::user_role,'CLOSER'::user_role]))$p$;

  -- Cada caso roda num sub-bloco que termina com erro de propósito: desfaz o caso e volta ao papel postgres.
  -- 1) ANON
  BEGIN
    PERFORM set_config('role','anon',true); PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    UPDATE public.profiles SET full_name = 'x' WHERE id = qa; GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'linhas=' || n;
  EXCEPTION WHEN OTHERS THEN res := res || E'\n1a anon update profiles: ' || CASE WHEN SQLERRM = 'linhas=0' OR SQLSTATE='42501' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;
  BEGIN
    PERFORM set_config('role','anon',true); PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    INSERT INTO public.crm_leads (code, created_by, name, partner_id) VALUES ('PROVA-1', qa, 'prova', qa);
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'inseriu';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n1b anon insert crm: ' || CASE WHEN SQLSTATE='42501' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;

  -- 2) PARTNER (conta de teste rebaixada só dentro da transação)
  UPDATE public.profiles SET role = 'PARTNER' WHERE id = qa;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    UPDATE public.profiles SET role = 'ADMIN' WHERE id = qa;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'virou ADMIN';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n2a partner muda role p/ ADMIN: ' || CASE WHEN SQLSTATE='42501' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    UPDATE public.profiles SET trial_expires_at = '2030-01-01' WHERE id = qa;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'estendeu trial';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n2b partner estende trial: ' || CASE WHEN SQLSTATE='42501' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    UPDATE public.profiles SET full_name = 'Teste' WHERE id = qa;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'mudou nome';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n2c partner muda nome direto: ' || CASE WHEN SQLSTATE='42501' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    UPDATE public.profiles SET updated_at = now() WHERE id = qa; GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'linhas=' || n;
  EXCEPTION WHEN OTHERS THEN res := res || E'\n2d partner muda updated_at: ' || CASE WHEN SQLERRM='linhas=1' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    INSERT INTO public.crm_leads (code, created_by, name, partner_id) VALUES ('PROVA-2', qa, 'prova', outro);
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'inseriu p/ outro';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n2e partner insere lead p/ outro: ' || CASE WHEN SQLSTATE='42501' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    INSERT INTO public.crm_leads (code, created_by, name, partner_id) VALUES ('PROVA-3', qa, 'prova', qa);
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'inseriu proprio';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n2f partner insere lead proprio: ' || CASE WHEN SQLERRM='inseriu proprio' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;

  -- 3) GESTAO
  UPDATE public.profiles SET role = 'GESTAO' WHERE id = qa;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    INSERT INTO public.crm_leads (code, created_by, name, partner_id) VALUES ('PROVA-4', qa, 'prova', outro);
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'inseriu p/ outro';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n3a gestao insere lead p/ outro: ' || CASE WHEN SQLERRM='inseriu p/ outro' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    UPDATE public.profiles SET role = 'ADMIN' WHERE id = qa;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'virou ADMIN';
  EXCEPTION WHEN OTHERS THEN res := res || E'\n3b gestao muda proprio role: ' || CASE WHEN SQLSTATE='42501' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;

  -- 4) ADMIN altera terceiro
  UPDATE public.profiles SET role = 'ADMIN' WHERE id = qa;
  BEGIN
    PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claims', json_build_object('sub',qa,'role','authenticated')::text, true);
    UPDATE public.profiles SET trial_expires_at = '2031-01-01' WHERE id = outro; GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'linhas=' || n;
  EXCEPTION WHEN OTHERS THEN res := res || E'\n4 admin altera terceiro: ' || CASE WHEN SQLERRM='linhas=1' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;

  -- 5) service_role (rotas da API)
  BEGIN
    PERFORM set_config('role','service_role',true); PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
    UPDATE public.profiles SET trial_expires_at = '2031-01-01' WHERE id = outro; GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'linhas=' || n;
  EXCEPTION WHEN OTHERS THEN res := res || E'\n5 service_role altera trial: ' || CASE WHEN SQLERRM='linhas=1' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;

  -- 6) conexão reaproveitada (claims vazio) = passa como conexão direta
  BEGIN
    PERFORM set_config('request.jwt.claims','',true);
    UPDATE public.profiles SET trial_expires_at = '2031-01-01' WHERE id = outro; GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE = 'linhas=' || n;
  EXCEPTION WHEN OTHERS THEN res := res || E'\n6 claims vazio (conexao direta): ' || CASE WHEN SQLERRM='linhas=1' THEN 'OK' ELSE 'FALHOU' END || ' (' || SQLSTATE || ' ' || SQLERRM || ')'; END;

  -- Fim: erro de propósito para DESFAZER TUDO (migration e papéis da conta de teste).
  RAISE EXCEPTION 'RESULTADO DA PROVA (tudo desfeito, nada gravado):%', res;
END
$prova$;
