-- 20261120a: trava de colunas sensíveis em profiles + crm_insert só em nome próprio.
-- BRIEF: docs/briefs/2026-11-20_rls-crm-insert-e-profiles-update-own.md (go mesmo assim do Hamilton, 20/11/2026).
-- Achado (19/11/2026): profiles_update_own sem WITH CHECK + UPDATE de authenticated em todas as colunas
-- = qualquer usuário logado podia mudar o próprio role (virar ADMIN), trial_expires_at etc. pela API REST.
-- Regra: libera só conexão direta (sem JWT), service_role e ADMIN; todos os demais (anon incluído)
-- só podem mudar updated_at. Lista fechada por padrão: coluna nova não abre brecha.
-- Reversão: 20261120a_profiles_trava_colunas_sensiveis_rollback.sql.txt

BEGIN;

CREATE OR REPLACE FUNCTION public.profiles_trava_colunas_sensiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  papel text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  permitidas text[] := ARRAY['updated_at'];
  novo jsonb := to_jsonb(NEW);
  velho jsonb := to_jsonb(OLD);
  k text;
BEGIN
  -- Libera só o explícito: conexão direta (sem JWT: postgres, pg_cron, Auth), service_role e ADMIN.
  IF papel IS NULL OR papel = 'service_role' THEN RETURN NEW; END IF;
  -- get_user_role() lê o papel ATUAL gravado (OLD): quem manda role=ADMIN não se libera no mesmo UPDATE.
  IF papel = 'authenticated' AND get_user_role()::text = 'ADMIN' THEN RETURN NEW; END IF;
  -- Todos os demais, anon incluído: só a lista permitida.
  FOR k IN SELECT jsonb_object_keys(novo) LOOP
    IF NOT (k = ANY(permitidas)) AND (novo -> k) IS DISTINCT FROM (velho -> k) THEN
      RAISE EXCEPTION 'Alteração não permitida neste campo do perfil.' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_trava_colunas_sensiveis ON public.profiles;
CREATE TRIGGER profiles_trava_colunas_sensiveis
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_trava_colunas_sensiveis();

REVOKE EXECUTE ON FUNCTION public.profiles_trava_colunas_sensiveis() FROM anon, public;

-- crm_leads: inserir só em nome próprio (ou papéis internos). Antes: qualquer autenticado, com qualquer partner_id.
DROP POLICY IF EXISTS crm_insert ON public.crm_leads;
CREATE POLICY crm_insert ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (partner_id = auth.uid()
    OR get_user_role() = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role, 'SDR'::user_role, 'CLOSER'::user_role]));

COMMIT;
