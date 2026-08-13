-- =============================================================================
-- QUALIFICACAO PF/PJ, INDICACAO RAPIDA COM TRAVA DE CONTEXTO, PIPELINE NCNDA->FPA
-- =============================================================================
--
-- CONTEXTO
--   Joao pediu (13/08/2026) uma esteira nova de indicacao de comissionados
--   (mandatario/finder/intermediario) com link de intake PF/PJ, gate de NCNDA
--   e modulo de rateio FPA. O prompt original especificava uma tabela nova
--   (deal_commissioned_qualifications) -- investigado antes de codar (regra
--   REUSE > ADAPT > CREATE, ~/.claude/rules/v3-numbering-governance.md):
--   cm_qualification_batches + cm_party_qualifications ja cobrem ~70% disso
--   desde 28/07/2026 (Bolsa de Ativos) e generalizado em 11/08/2026 (Central
--   de Contratos), incluindo role_in_document com mandatario/intermediario_*
--   e o link publico /intake/qualificacao/[token] ja em producao real (2
--   contratos reais, rev.77/78). Criar tabela paralela repetiria o defeito
--   ja corrigido em 11/08 (contraparte apagada de contrato real por
--   fragmentacao de fonte de verdade). Esta migration ESTENDE as tabelas
--   existentes, nunca cria um sistema de qualificacao paralelo.
--
-- ESCOPO DESTA MIGRATION (as 3 fases do BRIEF aprovado por Joao, "go")
--   Fase 1: indicacao rapida com side travado por contexto + campos PF/PJ
--   Fase 2: (sem schema novo, so a rota de texto juridico)
--   Fase 3: pipeline de status NCNDA->FPA + tabela de rateio
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo nas 2 tabelas existentes (colunas novas nullable, valores
--   novos de CHECK adicionados aos que ja existem, nunca removidos). 1
--   tabela nova (cm_fpa_rateio, dominio que nao existia em lugar nenhum).
--   Os 35 registros historicos de cm_party_qualifications ficam com
--   person_type NULL -- decisao consciente, nao retroativo.
-- =============================================================================

-- ── cm_qualification_batches: origem via Buy-Side, lado travado, pipeline novo ──

alter table public.cm_qualification_batches
  add column if not exists demand_id uuid references public.investor_demands(id),
  add column if not exists side text check (side is null or side in ('BUY_SIDE', 'SELL_SIDE'));

alter table public.cm_qualification_batches alter column document_type drop not null;

comment on column public.cm_qualification_batches.demand_id is
  'Quando a indicacao rapida se origina do card de um comprador Buy-Side (investor_demands), em vez de um listing ou operation_contract. Nullable -- os fluxos antigos continuam sem isso.';
comment on column public.cm_qualification_batches.side is
  'Travado automaticamente pelo card que disparou a indicacao (SELL_SIDE = card de Ativo, BUY_SIDE = card de Comprador). Nunca escolhido manualmente pelo usuario. Nulo para lotes antigos/fora da Bolsa de Ativos.';
comment on column public.cm_qualification_batches.document_type is
  'Agora nullable: a indicacao rapida (Etapa 1) ainda nao sabe qual instrumento sera gerado -- isso e decidido pela Governanca no disparo do intake juridico (Etapa 2), nao na indicacao.';

-- status: adiciona o pipeline novo (NCNDA->FPA) preservando os valores antigos
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.cm_qualification_batches'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.cm_qualification_batches drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.cm_qualification_batches
  add constraint cm_qualification_batches_status_check check (status in (
    'coletando', 'completo', -- valores originais (20260728c), preservados -- CORRIGIDO 13/08: a 1a versao desta
    -- migration escreveu 'ativo' aqui por engano (nunca foi o valor real). 'coletando' e o DEFAULT da coluna
    -- desde a criacao original -- sem ele, toda criacao de lote nova (POST /api/cm/qualifications, que nunca
    -- especifica status, conta com o default) quebra com 23514. Achado e corrigido na mesma sessao, antes de
    -- qualquer lote real ser criado sob o constraint errado.
    'aguardando_triagem_governanca', 'link_intake_enviado', 'qualificado_para_ncnda',
    'ncnda_assinado', 'fpa_liberado', 'concluido'
  ));

comment on column public.cm_qualification_batches.status is
  'Pipeline completo desde 13/08/2026: aguardando_triagem_governanca (indicacao rapida, ainda sem document_type) -> link_intake_enviado (Governanca disparou) -> qualificado_para_ncnda (todos preencheram, era "completo") -> ncnda_assinado -> fpa_liberado -> concluido. coletando/completo preservados para lotes antigos (coletando e o DEFAULT da coluna).';

-- ── cm_party_qualifications: PF/PJ estruturado + telefone da indicacao rapida ──

alter table public.cm_party_qualifications
  add column if not exists person_type text check (person_type is null or person_type in ('PF', 'PJ')),
  add column if not exists company_name text,
  add column if not exists company_cnpj text,
  add column if not exists company_address text,
  add column if not exists nationality text,
  add column if not exists marital_status text,
  add column if not exists profession text,
  add column if not exists birth_date date,
  add column if not exists phone text;

comment on column public.cm_party_qualifications.person_type is
  'PF ou PJ, escolhido pelo proprio indicado no link publico de intake (Etapa 2). Nulo para os 35 registros historicos anteriores a 13/08/2026 e para quem so preencheu o CPF/CNPJ simples (fluxo antigo).';
comment on column public.cm_party_qualifications.company_name is 'Razao social, so preenchido quando person_type = PJ.';
comment on column public.cm_party_qualifications.company_cnpj is 'CNPJ da PJ -- diferente de cpf_cnpj, que e sempre o documento PESSOAL de quem assina (o representante, mesmo em caso PJ).';
comment on column public.cm_party_qualifications.company_address is 'Endereco da sede da PJ -- diferente de endereco_completo, que e sempre o endereco RESIDENCIAL do representante/PF.';

-- role_in_document: adiciona os 4 papeis granulares (Finder/Originacao separado
-- de Intermediario, por lado), preservando os 5 valores antigos
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.cm_party_qualifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role_in_document%'
  loop
    execute format('alter table public.cm_party_qualifications drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.cm_party_qualifications
  add constraint cm_party_qualifications_role_in_document_check check (role_in_document in (
    'parte_principal', 'intermediario_finder_venda', 'intermediario_finder_compra', 'mandatario', 'testemunha', -- valores originais
    'finder_originacao_venda', 'finder_originacao_compra', 'intermediario_venda', 'intermediario_compra'
  ));

-- ── cm_fpa_rateio: dominio novo, nao existia em lugar nenhum ──

create table if not exists public.cm_fpa_rateio (
  id                        uuid primary key default gen_random_uuid(),
  batch_id                  uuid not null references public.cm_qualification_batches(id) on delete cascade,
  party_qualification_id    uuid not null references public.cm_party_qualifications(id) on delete cascade,
  valor_reais               numeric,
  percentual                numeric,
  created_by                uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  unique (batch_id, party_qualification_id)
);

comment on table public.cm_fpa_rateio is
  'Rateio de comissionamento do FPA (Fee Payment Agreement) entre os envolvidos ja qualificados de um lote, em R$ e/ou %. So liberado apos o batch atingir status ncnda_assinado. Dominio novo, criado em 13/08/2026.';

create index if not exists idx_cm_fpa_rateio_batch on public.cm_fpa_rateio(batch_id);

alter table public.cm_fpa_rateio enable row level security;

drop policy if exists "mesa le rateio fpa" on public.cm_fpa_rateio;
create policy "mesa le rateio fpa" on public.cm_fpa_rateio
  for select using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));

drop policy if exists "mesa gerencia rateio fpa" on public.cm_fpa_rateio;
create policy "mesa gerencia rateio fpa" on public.cm_fpa_rateio
  for all using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  )) with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));
