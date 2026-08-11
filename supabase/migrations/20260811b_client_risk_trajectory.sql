-- =============================================================================
-- CLIENT 360, FASE C: risco como atributo dinamico (trajetoria)
-- =============================================================================
--
-- CONTEXTO
--   Joao (confirmado, ver Fase B): "o risco nao e uma foto estatica, e um
--   instrumento ativo". Vincular kyc_analyses e credit_profiles a v3_clients,
--   calcular trajetoria (melhora/piora ao longo do tempo), preparar estrutura
--   para sugestoes consultivas atreladas ao perfil de risco.
--
-- ACHADO REAL, MUDOU O DESENHO
--   1. credit_profiles JA TEM v3_client_id desde a Fase 1 (09/08) -- mas
--      nenhuma linha e inserida por nenhuma rota Next.js. O motor de credito
--      (workflow n8n W-CREDIT) grava direto na tabela, fora do alcance de
--      "adicionar uma chamada resolveClient() na rota" -- nao existe rota.
--      Solucao: trigger no banco, dispara em qualquer INSERT/UPDATE de
--      subject_cpf_cnpj, nao importa quem grava a linha.
--   2. Confirmado por pergunta direta a Joao: credito (score_total/tier,
--      0-1000) e compliance/KYC (score/risk_label/verdict, sancao/PLD) sao
--      dois instrumentos sem formula publica de conversao entre eles.
--      Trajetoria calculada SEPARADA por dimensao, nunca fundida num
--      indicador so -- fundir exigiria inventar pesos que nao existem em
--      lugar nenhum do sistema.
--   3. "Sugestoes de melhoria constante": esta migration prepara a
--      ESTRUTURA (tabela). A logica que GERA sugestao automatica (provavel
--      chamada a LLM analisando o historico) fica fora do escopo desta
--      sessao -- e uma feature propria, nao um efeito colateral de tabela.
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 1 coluna nova (kyc_analyses.v3_client_id), 1 tabela nova
--   (v3_client_risk_suggestions), 1 trigger novo (so em credit_profiles,
--   dispara apenas quando v3_client_id ainda esta nulo), 1 view nova. Nenhum
--   DROP, nenhum UPDATE em dado existente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. kyc_analyses ganha v3_client_id (nao existia nenhuma coluna de vinculo)
-- -----------------------------------------------------------------------------

alter table public.kyc_analyses
  add column if not exists v3_client_id uuid references public.v3_clients(id);

comment on column public.kyc_analyses.v3_client_id is
  'Client 360, Fase C (11/08/2026). Resolvido em app/api/kyc/analyze/route.ts no momento da analise.';


-- -----------------------------------------------------------------------------
-- 2. credit_profiles: trigger no banco, nao wiring de rota (nao existe rota
--    que insira nesta tabela -- grava direto o workflow n8n W-CREDIT). Mesma
--    logica de find-or-create de resolveClient(), reimplementada em SQL
--    porque o caminho de escrita esta fora do alcance de codigo TypeScript.
-- -----------------------------------------------------------------------------

create or replace function public.sync_credit_profile_v3_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_type text;
  v_client_id uuid;
begin
  if new.subject_cpf_cnpj is null then
    return new;
  end if;

  v_digits := regexp_replace(new.subject_cpf_cnpj, '\D', '', 'g');

  if length(v_digits) = 11 then
    v_type := 'CPF';
  elsif length(v_digits) = 14 then
    v_type := 'CNPJ';
  else
    return new; -- documento invalido, nunca vincula a um cliente "sujo"
  end if;

  insert into public.v3_clients (document_number, document_type, legal_name, first_seen_vertical)
  values (v_digits, v_type, new.subject_name, 'credit_engine')
  on conflict (document_number) do nothing;

  select id into v_client_id from public.v3_clients where document_number = v_digits;
  new.v3_client_id := v_client_id;
  return new;
end;
$$;

comment on function public.sync_credit_profile_v3_client() is
  'Client 360, Fase C (11/08/2026). Equivalente SQL de resolveClient() (lib/v3-clients.ts), para a unica tabela do sistema cujo caminho de escrita real (n8n W-CREDIT) nao roda dentro da aplicacao Next.js.';

drop trigger if exists trg_credit_profiles_v3_client on public.credit_profiles;
create trigger trg_credit_profiles_v3_client
  before insert or update of subject_cpf_cnpj on public.credit_profiles
  for each row
  when (new.v3_client_id is null)
  execute function public.sync_credit_profile_v3_client();


-- -----------------------------------------------------------------------------
-- 3. Trajetoria: view separada por dimensao (credito vs compliance), nunca
--    fundida. "primeira_analise" quando nao ha historico anterior daquele
--    cliente naquela dimensao; "melhorando"/"piorando"/"estavel" comparando
--    com a analise imediatamente anterior do mesmo cliente.
-- -----------------------------------------------------------------------------

create or replace view public.v3_client_risk_trajectory as
select
  v3_client_id,
  'credito'::text as dimension,
  id as source_id,
  score_total as score_atual,
  tier as classificacao_atual,
  lag(score_total) over (partition by v3_client_id order by created_at) as score_anterior,
  created_at,
  case
    when lag(score_total) over (partition by v3_client_id order by created_at) is null then 'primeira_analise'
    when score_total > lag(score_total) over (partition by v3_client_id order by created_at) then 'melhorando'
    when score_total < lag(score_total) over (partition by v3_client_id order by created_at) then 'piorando'
    else 'estavel'
  end as direcao
from public.credit_profiles
where v3_client_id is not null

union all

select
  v3_client_id,
  'compliance'::text as dimension,
  id as source_id,
  score as score_atual,
  verdict as classificacao_atual,
  lag(score) over (partition by v3_client_id order by created_at) as score_anterior,
  created_at,
  case
    when lag(score) over (partition by v3_client_id order by created_at) is null then 'primeira_analise'
    when score > lag(score) over (partition by v3_client_id order by created_at) then 'melhorando'
    when score < lag(score) over (partition by v3_client_id order by created_at) then 'piorando'
    else 'estavel'
  end as direcao
from public.kyc_analyses
where v3_client_id is not null;

comment on view public.v3_client_risk_trajectory is
  'Client 360, Fase C (11/08/2026). Uma linha por analise (credito ou compliance) de cada cliente, com a direcao (melhorando/piorando/estavel/primeira_analise) comparada a analise anterior da MESMA dimensao. Consultado do lado do app com service_role, mesmo padrao das demais rotas internas -- nunca exposto direto a authenticated.';


-- -----------------------------------------------------------------------------
-- 4. Sugestoes de melhoria constante: estrutura pronta para receber
--    recomendacoes atreladas ao perfil de risco consolidado do cliente.
--    A logica que GERA a sugestao (provavel analise por LLM do historico)
--    fica fora do escopo desta migration -- e feature propria.
-- -----------------------------------------------------------------------------

create table if not exists public.v3_client_risk_suggestions (
  id            uuid primary key default gen_random_uuid(),
  v3_client_id  uuid not null references public.v3_clients(id),
  dimension     text not null check (dimension in ('credito', 'compliance')),
  suggestion    text not null,
  status        text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

comment on table public.v3_client_risk_suggestions is
  'Client 360, Fase C (11/08/2026). Estrutura pronta para sugestoes consultivas atreladas ao perfil de risco do cliente, servindo de insumo para a Mesa. created_by nulo quando a sugestao for gerada automaticamente (feature futura); preenchido quando a Mesa registra manualmente.';

create index if not exists idx_v3_client_risk_suggestions_client on public.v3_client_risk_suggestions(v3_client_id);

alter table public.v3_client_risk_suggestions enable row level security;

drop policy if exists "mesa le sugestoes de risco" on public.v3_client_risk_suggestions;
create policy "mesa le sugestoes de risco" on public.v3_client_risk_suggestions
  for select using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));

drop policy if exists "mesa gerencia sugestoes de risco" on public.v3_client_risk_suggestions;
create policy "mesa gerencia sugestoes de risco" on public.v3_client_risk_suggestions
  for all using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  )) with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));
