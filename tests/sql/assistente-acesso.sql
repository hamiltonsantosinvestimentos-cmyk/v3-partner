-- MY ASSISTANT IA: teste de acesso (BRIEF 01/11/2026, plano de teste). Colar no SQL Editor do Supabase.
-- Termina SEMPRE com um ERRO proposital ("RESULTADO DO TESTE"): é ele que desfaz tudo, inclusive os usuários de teste.
-- Nada fica gravado. Se algum gatilho de auth.users fizer chamada HTTP, o teste aborta antes de inserir qualquer linha.
do $teste$
declare
  dono    constant text := '00000000-0000-4000-8000-0000000000a1';
  outro   constant text := '00000000-0000-4000-8000-0000000000a2';
  partner constant text := '00000000-0000-4000-8000-0000000000a3';
  admin   constant text := '00000000-0000-4000-8000-0000000000a4';
  inativo constant text := '00000000-0000-4000-8000-0000000000a5';
  ins_l constant text := 'with x as (insert into public.assistente_lancamentos (user_id, tipo, valor_centavos, categoria, data, origem) values (''%s'', ''saida'', 100, ''Outros'', ''2026-11-01'', ''tela'') returning 1) select count(*) from x';
  ins_c constant text := 'with x as (insert into public.assistente_compromissos (user_id, titulo, inicio, origem) values (''%s'', ''t'', now(), ''tela'') returning 1) select count(*) from x';
  sel constant text := 'select count(*) from public.%s';
  upd_l constant text := 'with x as (update public.assistente_lancamentos set categoria = ''Lazer'' where id = ''%s'' returning 1) select count(*) from x';
  del_l constant text := 'with x as (delete from public.assistente_lancamentos where id = ''%s'' returning 1) select count(*) from x';
  upd_c constant text := 'with x as (update public.assistente_compromissos set titulo = ''x'' where id = ''%s'' returning 1) select count(*) from x';
  del_c constant text := 'with x as (delete from public.assistente_compromissos where id = ''%s'' returning 1) select count(*) from x';
  l_dono constant text := '00000000-0000-4000-8000-0000000000b1';
  l_outro constant text := '00000000-0000-4000-8000-0000000000b2';
  l_inativo constant text := '00000000-0000-4000-8000-0000000000b5';
  c_dono constant text := '00000000-0000-4000-8000-0000000000c1';
  c_outro constant text := '00000000-0000-4000-8000-0000000000c2';
  m_dono constant text := '00000000-0000-4000-8000-0000000000d1';
  m_outro constant text := '00000000-0000-4000-8000-0000000000d2';
  casos text[][];
  caso text[];
  papel text;
  obtido text;
  n bigint;
  passou int := 0;
  falhou int := 0;
  relatorio text := '';
  perfil_admin text;
  gatilhos text;
begin
  select string_agg(t.tgname, ', ') into gatilhos from pg_trigger t where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;
  if exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal and p.prosrc ~* '(http|net\.|pg_net|webhook)'
  ) then
    raise exception 'ABORTADO SEM INSERIR NADA: gatilho de auth.users pode fazer chamada HTTP (%).', gatilhos;
  end if;

  -- Preparação, como dono do banco.
  insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  select u::uuid, 'authenticated', 'authenticated', 'teste-' || right(u, 2) || '@assistente-rollback.invalid', '', now(), now(), '{}'::jsonb, '{}'::jsonb
  from unnest(array[dono, outro, partner, admin, inativo]) u;

  begin
    update public.profiles set role = 'ADMIN' where id = admin::uuid;
    if found then perfil_admin := 'perfil ADMIN aplicado'; else
      insert into public.profiles (id, email, role) values (admin::uuid, 'teste-a4@assistente-rollback.invalid', 'ADMIN');
      perfil_admin := 'perfil ADMIN inserido';
    end if;
  exception when others then
    perfil_admin := 'SEM perfil ADMIN (' || sqlstate || '): o caso ADMIN valeu só como usuário sem linha em assistente_config';
  end;

  insert into public.assistente_config (user_id, ativo) values (dono::uuid, true), (outro::uuid, true), (inativo::uuid, false);
  insert into public.assistente_mensagens (id, user_id, wa_message_id, tipo) values
    (m_dono::uuid, dono::uuid, 'teste-1', 'texto'), (m_outro::uuid, outro::uuid, 'teste-2', 'texto');
  insert into public.assistente_verificacao (user_id, phone_e164, codigo_hash, expira_em) values (dono::uuid, '+5500000000000', 'x', now());
  insert into public.assistente_lancamentos (id, user_id, tipo, valor_centavos, categoria, data, origem) values
    (l_dono::uuid, dono::uuid, 'saida', 100, 'Outros', '2026-11-01', 'tela'),
    (l_outro::uuid, outro::uuid, 'saida', 100, 'Outros', '2026-11-01', 'tela'),
    (l_inativo::uuid, inativo::uuid, 'saida', 100, 'Outros', '2026-11-01', 'tela');
  insert into public.assistente_compromissos (id, user_id, titulo, inicio, origem) values
    (c_dono::uuid, dono::uuid, 't', now(), 'tela'), (c_outro::uuid, outro::uuid, 't', now(), 'tela');

  -- ator (id ou 'anon') | descrição | SQL que devolve uma contagem | esperado (número, negado ou código de erro).
  casos := array[
    ['anon', 'anon lê config', format(sel, 'assistente_config'), 'negado'],
    ['anon', 'anon lê verificacao', format(sel, 'assistente_verificacao'), 'negado'],
    ['anon', 'anon lê mensagens', format(sel, 'assistente_mensagens'), 'negado'],
    ['anon', 'anon lê lancamentos', format(sel, 'assistente_lancamentos'), 'negado'],
    ['anon', 'anon lê compromissos', format(sel, 'assistente_compromissos'), 'negado'],
    ['anon', 'anon grava lancamento', format(ins_l, dono), 'negado'],

    [partner, 'partner lê lancamentos', format(sel, 'assistente_lancamentos'), '0'],
    [partner, 'partner lê compromissos', format(sel, 'assistente_compromissos'), '0'],
    [partner, 'partner lê config', format(sel, 'assistente_config'), '0'],
    [partner, 'partner lê mensagens', format(sel, 'assistente_mensagens'), 'negado'],
    [partner, 'partner lê verificacao', format(sel, 'assistente_verificacao'), 'negado'],
    [partner, 'partner altera lancamento do dono', format(upd_l, l_dono), '0'],
    [partner, 'partner apaga lancamento do dono', format(del_l, l_dono), '0'],
    [partner, 'partner altera compromisso do dono', format(upd_c, c_dono), '0'],
    [partner, 'partner apaga compromisso do dono', format(del_c, c_dono), '0'],
    [partner, 'partner grava com user_id do dono', format(ins_l, dono), 'negado'],
    [partner, 'partner grava linha própria', format(ins_l, partner), 'negado'],
    [partner, 'partner grava compromisso próprio', format(ins_c, partner), 'negado'],

    [admin, 'ADMIN lê lancamentos', format(sel, 'assistente_lancamentos'), '0'],
    [admin, 'ADMIN lê compromissos', format(sel, 'assistente_compromissos'), '0'],
    [admin, 'ADMIN lê config', format(sel, 'assistente_config'), '0'],
    [admin, 'ADMIN lê mensagens', format(sel, 'assistente_mensagens'), 'negado'],
    [admin, 'ADMIN lê verificacao', format(sel, 'assistente_verificacao'), 'negado'],
    [admin, 'ADMIN altera lancamento do dono', format(upd_l, l_dono), '0'],
    [admin, 'ADMIN apaga lancamento do dono', format(del_l, l_dono), '0'],
    [admin, 'ADMIN grava com user_id do dono', format(ins_l, dono), 'negado'],
    [admin, 'ADMIN grava linha própria', format(ins_l, admin), 'negado'],

    [dono, 'dono lê só o próprio lancamento', format(sel, 'assistente_lancamentos'), '1'],
    [dono, 'dono lê só o próprio compromisso', format(sel, 'assistente_compromissos'), '1'],
    [dono, 'dono lê só a própria config', format(sel, 'assistente_config'), '1'],
    [dono, 'dono lê mensagens', format(sel, 'assistente_mensagens'), 'negado'],
    [dono, 'dono lê verificacao', format(sel, 'assistente_verificacao'), 'negado'],
    [dono, 'dono altera o próprio lancamento', format(upd_l, l_dono), '1'],
    [dono, 'dono altera o próprio compromisso', format(upd_c, c_dono), '1'],
    [dono, 'dono altera lancamento de outro', format(upd_l, l_outro), '0'],
    [dono, 'dono apaga lancamento de outro', format(del_l, l_outro), '0'],
    [dono, 'dono altera compromisso de outro', format(upd_c, c_outro), '0'],
    [dono, 'dono grava linha própria', format(ins_l, dono), '1'],
    [dono, 'dono grava compromisso próprio', format(ins_c, dono), '1'],
    [dono, 'dono grava com user_id de outro', format(ins_l, outro), 'negado'],
    [dono, 'dono passa o lancamento para outro', format('with x as (update public.assistente_lancamentos set user_id = ''%s'' where id = ''%s'' returning 1) select count(*) from x', outro, l_dono), 'negado'],
    [dono, 'dono usa mensagem de outro', format('with x as (insert into public.assistente_lancamentos (user_id, tipo, valor_centavos, categoria, data, origem, mensagem_id) values (''%s'', ''saida'', 100, ''Outros'', ''2026-11-01'', ''tela'', ''%s'') returning 1) select count(*) from x', dono, m_outro), '23503'],
    [dono, 'dono grava valor fora da faixa', format('with x as (insert into public.assistente_lancamentos (user_id, tipo, valor_centavos, categoria, data, origem) values (''%s'', ''saida'', 0, ''Outros'', ''2026-11-01'', ''tela'') returning 1) select count(*) from x', dono), '23514'],
    [dono, 'dono altera a config', format('with x as (update public.assistente_config set ativo = true where user_id = ''%s'' returning 1) select count(*) from x', dono), 'negado'],
    [dono, 'dono cria config', format('with x as (insert into public.assistente_config (user_id) values (''%s'') returning 1) select count(*) from x', partner), 'negado'],
    [dono, 'dono apaga a config', format('with x as (delete from public.assistente_config where user_id = ''%s'' returning 1) select count(*) from x', dono), 'negado'],
    [dono, 'dono apaga o próprio compromisso', format(del_c, c_dono), '1'],
    [dono, 'dono apaga o próprio lancamento', format(del_l, l_dono), '1'],

    [inativo, 'inativo lê lancamentos', format(sel, 'assistente_lancamentos'), '0'],
    [inativo, 'inativo lê compromissos', format(sel, 'assistente_compromissos'), '0'],
    [inativo, 'inativo altera o próprio lancamento', format(upd_l, l_inativo), '0'],
    [inativo, 'inativo apaga o próprio lancamento', format(del_l, l_inativo), '0'],
    [inativo, 'inativo grava lancamento', format(ins_l, inativo), 'negado'],
    [inativo, 'inativo grava compromisso', format(ins_c, inativo), 'negado']
  ];

  foreach caso slice 1 in array casos loop
    papel := case when caso[1] = 'anon' then 'anon' else 'authenticated' end;
    perform set_config('request.jwt.claims',
      case when caso[1] = 'anon' then '{"role":"anon"}' else json_build_object('sub', caso[1], 'role', 'authenticated')::text end, true);
    execute format('set local role %I', papel);
    begin
      execute caso[3] into n;
      obtido := n::text;
    exception
      when insufficient_privilege then obtido := 'negado';
      when others then obtido := sqlstate;
    end;
    execute 'reset role';
    if obtido = caso[4] then
      passou := passou + 1;
    else
      falhou := falhou + 1;
      relatorio := relatorio || E'\n  FALHOU: ' || caso[2] || ' | esperado ' || caso[4] || ', obtido ' || obtido;
    end if;
  end loop;

  raise exception E'RESULTADO DO TESTE (erro proposital, tudo foi desfeito): % passaram, % falharam.\n  %\n  gatilhos de auth.users: % %',
    passou, falhou, perfil_admin, coalesce(gatilhos, 'nenhum'), relatorio;
end
$teste$;
