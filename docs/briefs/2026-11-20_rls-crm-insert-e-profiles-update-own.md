# BRIEF: URGENTE: usuário logado consegue alterar o próprio role (escalada para ADMIN) + criação de conta sem checagem

> Data: 2026-11-19 (noite) | Autor: Claude (pedido do Hamilton) | Status: EM QA, rodada 4 | Prioridade: MÁXIMA
> Salvar em `docs/briefs/2026-11-20_rls-crm-insert-e-profiles-update-own.md` e commitar junto com a migration.

## MUDANÇAS DA RODADA 3 PARA A 4
Texto alinhado à migration: lista permitida só `updated_at`; sem bypass; leitura dos claims com `nullif`; justificativa correta para `search_documents_rag` e `match_investors_for_deal` (EXECUTE só da service_role); `cm_enqueue_movement_emails` com consulta de verificação.

## MUDANÇAS DA RODADA 2 PARA A 3
`nullif` nos claims; consulta ampliada e colada; bypass e `last_login_at` removidos.

## MUDANÇAS DA RODADA 1 PARA A 2
Trava agora fechada por padrão (libera só service_role, conexão direta e ADMIN; anon e todos os demais caem na lista); lista permitida reduzida ao mínimo (depois reduzida a só `updated_at` na rodada 3), porque nenhuma escrita legítima em `profiles` usa a sessão de usuário comum; inventário corrigido (`createServiceClient()` manda o JWT do ADMIN); consulta de funções, cron, políticas e enum pedida antes do go; prova em transação com ROLLBACK antes de aplicar; migration em `begin/commit`; achado do `POST /api/usuarios` sem checagem incluído no escopo; compliance com saída explícita.

## ACHADOS (provados em 19/11/2026)
1. **Escalada de privilégio em `profiles`** (consulta no SQL Editor rodada pelo Hamilton): política `profiles_update_own` (UPDATE, `{public}`, USING `id = auth.uid()`, sem WITH CHECK); `authenticated` com UPDATE na tabela e em `role`, `is_active`, `enterprise_id`, `enterprise_repasse_percent`, `closer_id`, `trial_expires_at`, `white_label_dominio`; único trigger `profiles_updated_at` (só grava `updated_at`). Qualquer usuário logado, com a chave anon e o próprio JWT, pode virar ADMIN, estender o teste grátis, se reativar, mudar repasse etc. pela API REST.
2. **`crm_insert`** aceita qualquer autenticado (`auth.uid() IS NOT NULL`): dá para criar lead no CRM de outro partner.
3. **`POST /api/usuarios` sem checagem de quem chama** (`app/api/usuarios/route.ts` linha 49 em diante; QA, 19/11): qualquer usuário logado chega a `auth.admin.createUser` (chave de serviço) e cria conta, com e-mail de boas-vindas. A troca de role roda com o JWT de quem chamou e hoje é barrada pela RLS (0 linhas), então não vira ADMIN, mas cria conta órfã.

## SINAIS DE EXPLORAÇÃO (leitura em 19/11/2026, service role)
- Perfis privilegiados: ADMIN = QA Playwright (teste), Robson Lino, Suporte Mesa, João Lemos; MESA_OPERACIONAL = Taisa Pedroso; FINANCEIRO = Aline Rodrigues; CLOSER = Fernando Henrique. Nenhum desconhecido.
- Nenhum `trial_expires_at` depois de 2027-12-31.
- Limite: alteração direta pela REST não passa por `audit_logs`; não dá para provar que nunca aconteceu.

## SCOPE
1. Trigger `BEFORE UPDATE` em `profiles`, **fechado por padrão**: libera `service_role`, conexão direta (sem JWT: postgres, pg_cron, GoTrue) e sessão de ADMIN; para todos os demais (anon incluído), só deixa mudar `updated_at`.
2. Política `crm_insert` só em nome próprio (ou papéis internos), confirmada contra as demais políticas de `crm_leads`.
3. `POST /api/usuarios`: exigir sessão de ADMIN (mesma checagem do `GET` da própria rota), antes de qualquer `createUser`.

## LISTA PERMITIDA (sessão de usuário comum no próprio perfil)
`updated_at` (somente). `last_login_at` saiu: nenhuma função do banco nem rota grava essa coluna pela sessão do usuário (consulta de 19/11). Justificativa (menor privilégio): nenhuma tela grava `profiles` direto do navegador, e as rotas que gravam dados do próprio perfil (`app/api/profile`, `app/api/profile/avatar`) usam service role e já têm a lista e as validações da aplicação. Gravar `full_name`, `document_cpf` ou `cobranding_slug` direto pela REST pularia essas validações.

## INVENTÁRIO DE QUEM GRAVA `profiles` (código, 19/11)
- Service role de verdade (supabase-js com a chave de serviço, sem cookies; `auth.role() = service_role`, o trigger libera): `app/api/profile`, `profile/avatar`, `enterprise/{dominio,marca,usuarios}` (via `lib/enterprise-server.ts`), `kyc/update`, `prospeccao/[id]`, `financeiro/assinaturas`, `cadastro-partner/aprovar`, webhooks Cora e InfinitePay, exclusão em `usuarios/[id]`.
- **Sessão do ADMIN** (não service role): `app/api/usuarios/route.ts` (POST, grava role), `app/api/usuarios/[id]/route.ts` (PATCH: role, is_active, trial_expires_at, closer_id), `app/api/cm/deal-intermediaries/quick-partner/route.ts` (role). Usam `createServiceClient()` de `lib/supabase/server.ts`, que é o `createServerClient` do `@supabase/ssr` com a chave de serviço **e os cookies da sessão**, então o PostgREST recebe o JWT de quem está logado. Funcionam porque checam ADMIN e o trigger libera ADMIN. (Revisar esse helper fica para BRIEF próprio; ver RISKS.)
- Navegador: nenhum `update`/`upsert` em `profiles`.
- Banco (funções, triggers de outras tabelas, pg_cron): **consulta abaixo, resultado a colar antes do go**.

## CONSULTA ANTES DO GO (só leitura; Hamilton roda no SQL Editor e cola o resultado aqui)
```sql
select '1 funcoes que gravam profiles' as item, n.nspname || '.' || p.proname || ' | security_definer=' || p.prosecdef as resultado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','auth') and p.prosrc ~* 'profiles'
union all
select '2 cron que cita profiles', jobname || ' | ' || left(command, 200) from cron.job where command ilike '%profiles%'
union all
select '3 politicas crm_leads e profiles', tablename || ' | ' || policyname || ' | ' || cmd || ' | ' || permissive || ' | ' || roles::text || ' | USING: ' || coalesce(qual,'-') || ' | CHECK: ' || coalesce(with_check,'-')
from pg_policies where schemaname='public' and tablename in ('crm_leads','profiles')
union all
select '4 enum user_role', string_agg(v::text, ', ') from unnest(enum_range(NULL::user_role)) v
order by 1, 2;
```
Regras de leitura: (1) o item lista toda função que cita `profiles` (pega `"public"."profiles"`, SQL dinâmico e `INSERT ... ON CONFLICT DO UPDATE`); marcar à mão as que gravam. Toda função que grave coluna fora da lista e possa rodar com JWT de usuário comum entra no escopo (deixa de ser chamada pela sessão ou passa a rodar como service_role); a migration **não tem** porta de bypass; (3) nenhuma outra política permissiva de INSERT ou ALL em `crm_leads` pode aceitar autenticado sem amarrar `partner_id`; se houver, entra no escopo; (4) `SDR` e `CLOSER` precisam existir no enum, senão saem da política.

## RESULTADO DA CONSULTA ANTES DO GO (19/11/2026, rodada pelo Hamilton no SQL Editor)
```
1 funcoes que citam profiles: cm_enqueue_movement_emails, creation_log_retention, fn_excluir_documento_qualificacao, fn_liberar_qualificacao, fn_limpar_conferencia, get_user_role, handle_new_user (grava=provavel), ma_deal_transfer_to_desk, ma_desk_confirm_classification, match_investors_for_deal, reserve_creation_slot, search_documents_rag, user_can_access_team_room (todas security_definer=true)
2 cron que cita profiles: (nenhuma linha)
3 crm_leads: crm_delete_admin DELETE ADMIN | crm_insert INSERT CHECK auth.uid() IS NOT NULL | crm_select SELECT dono ou ADMIN/GESTAO/MESA_OPERACIONAL | crm_update UPDATE dono ou ADMIN/GESTAO (todas PERMISSIVE, {public})
3 profiles: profiles_select_admin | profiles_select_own | profiles_update_admin (UPDATE, get_user_role() = 'ADMIN') | profiles_update_own (todas PERMISSIVE, {public})
4 enum user_role: ADMIN, PARTNER, PARTNER_PRO, MESA_OPERACIONAL, GESTAO, FINANCEIRO, SDR, CLOSER, STARTER, ENTERPRISE, INSTITUICAO, PARTNER_HE, GOLD, DIAMANTE
```
Leitura:
- Funções: só `handle_new_user` grava `profiles` (cria o perfil quando a conta nasce, disparada pelo Auth do Supabase, sem claims de usuário, então passa como conexão direta; e é INSERT). As demais leem o papel (`get_user_role`, checagens de acesso); conferido no repositório para `creation_log_retention`, `fn_excluir_documento_qualificacao`, `fn_liberar_qualificacao`, `fn_limpar_conferencia`, `ma_deal_transfer_to_desk`, `ma_desk_confirm_classification`, `reserve_creation_slot`, `user_can_access_team_room` (nenhum UPDATE/INSERT em profiles). `search_documents_rag` e `match_investors_for_deal`: EXECUTE revogado de public, anon e authenticated e dado só à service_role (`supabase/migrations/20261101a_funcoes_fechadas_a_anon.sql` linhas 9 e 15; `supabase/migrations/20261031a_fim_leitura_direta_externo.sql` linhas 109 a 114), então só rodam como service_role e o trigger libera. `cm_enqueue_movement_emails` (fora do repositório): verificada, resultado abaixo (`false`). **A migration não tem porta de bypass.**

Verificação de `cm_enqueue_movement_emails` (Hamilton roda e cola):
`select pg_get_functiondef('public.cm_enqueue_movement_emails'::regproc) ~* '(update|insert\s+into)\s+("?public"?\.)?"?profiles' as grava_profiles;`
Resultado (19/11/2026, Hamilton no SQL Editor): **`false`**. A função não grava `profiles`; item fechado.
- Cron: nenhum job cita `profiles`.
- `crm_leads`: só existe uma política de INSERT (`crm_insert`), sem ALL; trocando ela, fecha. `profiles_update_admin` existe (rotas de ADMIN e teste "ADMIN altera role de terceiro" dependem dela).
- Enum: `SDR` e `CLOSER` existem; a política nova fica como desenhada.

## IMPACT
- Banco: 1 função + 1 trigger em `profiles`; 1 política trocada em `crm_leads`. Sem coluna nova.
- Código: `app/api/usuarios/route.ts` (POST passa a exigir ADMIN; 401 sem sessão, 403 sem ADMIN, antes de `createUser`).
- Rotas afetadas: `POST /api/usuarios`; o resto do efeito é só sobre chamadas diretas à API REST do Supabase.

## UX: ONDE O USUÁRIO VÊ ISSO
- Sem UI nova: correção de segurança. Justificativa: os caminhos bloqueados (alterar o próprio perfil pela REST, inserir lead para outro, criar conta sem ser ADMIN) não são usados por nenhuma tela de quem não é ADMIN.
- Tentativa bloqueada no banco: erro "Alteração não permitida neste campo do perfil." (código 42501), inclusive para anon.
- `POST /api/usuarios` sem ADMIN: 403 "Acesso restrito a administradores" (mesmo texto do GET).
- Telas existentes (Configurações, avatar, cobranding, onboarding, Usuários do ADMIN): iguais.

## DEPENDENCIES
- Nenhuma. Aplicar **antes** do deploy dos BRIEFs do Enterprise e antes de cadastrar usuários da AGS Finance.

## RISKS (nunca "nenhum")
- Breaking change: função do banco ou job que grave `profiles` com JWT de usuário comum passa a falhar. Mitigação: consulta acima antes do go e prova em transação.
- `createServiceClient()` com cookies: quem usa espera service role e recebe a sessão do usuário. Fora do escopo (só documentado); BRIEF próprio depois.
- Ordem dos triggers: alfabética (`profiles_trava_colunas_sensiveis` antes de `profiles_updated_at`); `updated_at` está na lista, sem conflito.
- `auth.role()` é a forma legada; a função lê `nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'`, estável e sem erro em conexão reaproveitada.
- Segurança de acesso ao banco: função `SECURITY INVOKER`, `SET search_path = public`, `REVOKE EXECUTE` de anon e public; política nova `TO authenticated` com condição real.
- LGPD: reduz exposição. Ver Parecer.
- Performance: um trigger por UPDATE em tabela pequena. Desprezível.

## APPROACH
- Escolhida: trigger fechado por padrão com lista mínima + política de INSERT amarrada ao dono + checagem de ADMIN no POST.
- Descartada 1: só `WITH CHECK (id = auth.uid())`: não impede mudar o `role`.
- Descartada 2: `REVOKE UPDATE` + `GRANT UPDATE (colunas)`: coluna nova pode herdar grant; mais frágil.
- Descartada 3: remover `profiles_update_own`: equivalente na prática (lista mínima), mas o trigger também cobre anon e qualquer política futura mal escrita.

## DESENHO TÉCNICO
Migration `supabase/migrations/20261120a_profiles_trava_colunas_sensiveis.sql`:
```sql
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
  -- Libera só o explícito: conexão direta (sem JWT), service_role e ADMIN.
  IF papel IS NULL OR papel = 'service_role' THEN RETURN NEW; END IF;
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

DROP POLICY IF EXISTS crm_insert ON public.crm_leads;
CREATE POLICY crm_insert ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (partner_id = auth.uid()
    OR get_user_role() = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role,'MESA_OPERACIONAL'::user_role,'SDR'::user_role,'CLOSER'::user_role]));
-- (lista de papéis ajustada ao enum confirmado na consulta)

COMMIT;
```
Reversão `supabase/migrations/20261120a_profiles_trava_colunas_sensiveis_rollback.sql.txt`:
```sql
BEGIN;
DROP TRIGGER IF EXISTS profiles_trava_colunas_sensiveis ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_trava_colunas_sensiveis();
DROP POLICY IF EXISTS crm_insert ON public.crm_leads;
CREATE POLICY crm_insert ON public.crm_leads FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);
COMMIT;
```
Código (`app/api/usuarios/route.ts`, POST): no início, a mesma checagem do GET da rota (extraída para uma função local `exigirAdmin()` usada pelos dois): 401 sem usuário, 403 se `role !== 'ADMIN'`; só então o fluxo atual.

## PLANO DE TESTE
**Antes de aplicar (prova em transação desfeita, no SQL Editor):** `begin;` + o corpo da migration (sem o COMMIT) e, para cada caso, `set local role <papel>; select set_config('request.jwt.claims', '<json>', true);` seguido do comando; no fim, `rollback;`. Casos (contas de teste, nunca partner real):
- conexão reaproveitada: `select set_config('request.jwt.claims', '', true);` + UPDATE de `trial_expires_at` = ok (passa como conexão direta, sem erro de JSON).
- "Negado" em UPDATE = 0 linhas afetadas ou 42501.
- anon (`set local role anon`, claims `{"role":"anon"}`): UPDATE em `profiles` = 0 linhas (a RLS filtra antes do trigger); INSERT em `crm_leads` = negado.
- partner comum (`authenticated`, claims com `sub` da conta de teste PARTNER): `update profiles set role='ADMIN'` = 42501; `trial_expires_at` = 42501; `full_name` = 42501 (fora da lista); `updated_at` = ok; INSERT em `crm_leads` com `partner_id` de outro = negado; com o próprio = ok.
- equipe (GESTAO ou MESA_OPERACIONAL): INSERT em `crm_leads` para outro partner = ok; UPDATE do próprio `role` = 42501.
- ADMIN: UPDATE de `role` de terceiro = ok.
- service_role (claims `{"role":"service_role"}`): UPDATE de `trial_expires_at` = ok.
**Depois de aplicar:** conta de teste PARTNER pela REST (chave anon + JWT): `{"role":"ADMIN"}` = 42501. Telas: Configurações, avatar, cobranding, onboarding = ok; Usuários do ADMIN (criar, mudar role, bloquear), aprovar cadastro, Enterprise, vincular closer = ok. `POST /api/usuarios` com conta PARTNER = 403; com ADMIN = ok.

## ESTIMATE
S. Cerca de 1h30 com a prova em transação e os testes. Confiança alta.

## PARECER DE COMPLIANCE
- [VALIDAR COM ROBSON]: se o achado precisa de registro interno de incidente de segurança (LGPD art. 48; sem evidência de acesso indevido até 19/11). Não muda a correção.
- Saída enquanto não houver resposta: a correção reduz exposição e é urgente; aplicar antes do parecer é decisão do João ou do Hamilton, registrada como **"go mesmo assim"**, com esta pendência listada como falha aceita.

## PROVA EM TRANSAÇÃO DESFEITA (20/11/2026, rodada pelo Hamilton no SQL Editor)
Roteiro: `docs/briefs/anexos/2026-11-20_prova-trava-profiles.sql`. Resultado (13 de 13 OK):
```
1a anon update profiles: OK (P0001 linhas=0)
1b anon insert crm: OK (42501 new row violates row-level security policy for table "crm_leads")
2a partner muda role p/ ADMIN: OK (42501 Alteração não permitida neste campo do perfil.)
2b partner estende trial: OK (42501 Alteração não permitida neste campo do perfil.)
2c partner muda nome direto: OK (42501 Alteração não permitida neste campo do perfil.)
2d partner muda updated_at: OK (P0001 linhas=1)
2e partner insere lead p/ outro: OK (42501 new row violates row-level security policy for table "crm_leads")
2f partner insere lead proprio: OK (P0001 inseriu proprio)
3a gestao insere lead p/ outro: OK (P0001 inseriu p/ outro)
3b gestao muda proprio role: OK (42501 Alteração não permitida neste campo do perfil.)
4 admin altera terceiro: OK (P0001 linhas=1)
5 service_role altera trial: OK (P0001 linhas=1)
6 claims vazio (conexao direta): OK (P0001 linhas=1)
```
Conferido depois (service role): conta de teste segue ADMIN; master AGS segue ENTERPRISE com trial 2027-11-11; nenhum lead `PROVA-%`. Nada foi gravado.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (5 falhas: trava aberta por padrão; inventário incompleto e `createServiceClient` descrito errado; eficácia do `crm_insert` sem prova das outras políticas e enum; prova só depois de aplicar; compliance em aberto). Achado novo do QA: `POST /api/usuarios` sem checagem (incluído no escopo). Correções nesta versão.

Rodada 2 de 6: BLOQUEADO (2 falhas: `nullif` na leitura dos claims, corrigido; compliance, que fecha com resposta do Robson ou "go mesmo assim"). Pendentes só do resultado da consulta: funções (bypass sai se ninguém precisar), cron sem claims, políticas de `crm_leads` e `profiles_update_admin`, enum, quem grava `last_login_at`. Sugestões aplicadas: consulta ampliada, "negado" definido, `exigirAdmin()` único.

Rodada 3 de 6: BLOQUEADO (3 falhas: `cm_enqueue_movement_emails` sem verificação; texto desatualizado, corrigido; compliance). Migration sem objeção técnica.

Rodada 4 de 6: BLOQUEADO (1 falha: compliance, [VALIDAR COM ROBSON] sobre registro interno de incidente). Sem objeção técnica à migration nem ao código. Saída prevista: "go mesmo assim" do Hamilton.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO só por compliance (rodadas: 4)
- Override ("go mesmo assim"): aguardando o Hamilton. Falha aceita se ele der o override: [VALIDAR COM ROBSON] sobre registro interno de incidente de segurança (LGPD art. 48). Compromisso: levar o achado e a correção ao Robson depois de aplicar e colar a resposta neste BRIEF.
- Go: "go mesmo assim" do Hamilton em 2026-11-20 01:08 UTC (registrado pelo hook, override=true)
- Migration aplicada em produção: não (exige segundo go, com o SQL mostrado)
