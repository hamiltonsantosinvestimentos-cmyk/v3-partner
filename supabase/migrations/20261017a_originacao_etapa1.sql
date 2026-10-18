-- Aba "Originação" da Mesa M&A, fatia 1: Etapa 1 (Ingestão e diagnóstico).
-- BRIEF: 06_Operacional/SOPs/2026-10-17_Operacional_BRIEF-Playbook-Esteira-MA-Originacao-Estruturacao_v1.html
-- "Go" de implementação do João em 17/10/2026.
--
-- O que cria:
--   1. ma_origination_units: catálogo de unidades com teto de sanidade (multissetor:
--      agro usa t/ha/conteiner, engenharia e entretenimento usam unidade/projeto).
--   2. ma_origination_label: os 4 rótulos de confiança (Trava 1 do BRIEF).
--   3. 4 colunas nullable em ma_deals (etapa da esteira, data da reunião, decisão, reunião de origem).
--   4. ma_origination_names: grafias de pessoas e empresas, A_CONFIRMAR até confirmação humana.
--   5. ma_origination_facts: fatos rotulados, com valor estruturado (valor_min, valor_max, unidade, moeda).
-- Regras no banco (não só na tela): faixa min <= max, piso 0 só em declaração de ausência,
-- moeda ISO 4217 obrigatória só em unidade monetária, teto por unidade, VERIFICADO exige fonte e data.
-- RLS: mesmo padrão de ma_deal_clients (ADMIN, GESTAO, MESA_OPERACIONAL).

begin;

-- 1. Catálogo de unidades ------------------------------------------------------
create table if not exists public.ma_origination_units (
  code       text primary key,
  label      text not null,
  monetaria  boolean not null default false,
  teto       numeric not null check (teto > 0),
  created_at timestamptz not null default now()
);
comment on table public.ma_origination_units is
  'Catálogo de unidades dos fatos da Originação (BRIEF 17/10/2026). teto = limite de sanidade do valor_max.';

insert into public.ma_origination_units (code, label, monetaria, teto) values
  ('conteiner', 'Contêineres',              false, 100000),
  ('ha',        'Hectares',                 false, 1000000),
  ('moeda',     'Valor monetário',          true,  1000000000000),
  ('pessoa',    'Pessoas',                  false, 100000),
  ('projeto',   'Projetos ou contratos',    false, 100000),
  ('t',         'Toneladas',                false, 1000000),
  ('unidade',   'Unidades produzidas',      false, 1000000)
on conflict (code) do nothing;

-- 2. Rótulos de confiança ------------------------------------------------------
do $$ begin
  create type public.ma_origination_label as enum ('VERIFICADO', 'DECLARADO_REUNIAO', 'INFERIDO', 'NAO_ENCONTRADO');
exception when duplicate_object then null; end $$;

-- 3. Estado da esteira no deal (colunas nullable, backward compatible) -------------
alter table public.ma_deals
  add column if not exists origination_stage smallint
    check (origination_stage between 1 and 6),
  add column if not exists origination_meeting_date date,
  add column if not exists origination_decision text
    check (origination_decision in ('sim', 'nao', 'em_conversa')),
  add column if not exists origination_meeting_summary_id uuid
    references public.meeting_summaries(id) on delete set null;

comment on column public.ma_deals.origination_stage is 'Etapa atual da esteira de Originação (1 a 6). Null = deal fora da esteira.';
comment on column public.ma_deals.origination_meeting_date is 'Data da reunião de origem (coluna date: nunca new Date(AAAA-MM-DD) na tela).';

-- 4. Nomes e grafias -----------------------------------------------------------
create table if not exists public.ma_origination_names (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references public.ma_deals(id) on delete cascade,
  tipo              text not null check (tipo in ('pessoa', 'empresa')),
  grafias           text[] not null check (cardinality(grafias) > 0),
  grafia_provavel   text,
  grafia_confirmada text,
  status            text not null default 'A_CONFIRMAR' check (status in ('A_CONFIRMAR', 'CONFIRMADO')),
  confirmed_by      uuid references auth.users(id),
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint nome_confirmado_completo check (
    status = 'A_CONFIRMAR' or (grafia_confirmada is not null and confirmed_by is not null and confirmed_at is not null)
  )
);
create index if not exists ma_origination_names_deal_idx on public.ma_origination_names (deal_id);
comment on table public.ma_origination_names is
  'Nomes citados na reunião. Trava da Etapa 1: o deal não avança enquanto houver A_CONFIRMAR.';

-- 5. Fatos rotulados -----------------------------------------------------------
create table if not exists public.ma_origination_facts (
  id                 uuid primary key default gen_random_uuid(),
  deal_id            uuid not null references public.ma_deals(id) on delete cascade,
  meeting_summary_id uuid references public.meeting_summaries(id) on delete set null,
  tema               text not null check (length(trim(tema)) > 0),
  afirmacao          text not null check (length(trim(afirmacao)) > 0),
  quem_disse         text,
  rotulo             public.ma_origination_label not null default 'DECLARADO_REUNIAO',
  fonte              text,
  fonte_data         date,
  valor_min          numeric,
  valor_max          numeric,
  unidade            text references public.ma_origination_units(code),
  moeda              char(3) check (moeda ~ '^[A-Z]{3}$'),
  ausencia           boolean not null default false,
  ordem              integer not null default 0,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint fato_numerico_completo check (
    (valor_min is null) = (valor_max is null) and (valor_min is null) = (unidade is null)
  ),
  constraint fato_faixa check (valor_min is null or (valor_min >= 0 and valor_min <= valor_max)),
  constraint fato_zero_so_ausencia check (valor_max is null or valor_max > 0 or ausencia),
  constraint fato_verificado_com_fonte check (rotulo <> 'VERIFICADO' or (fonte is not null and fonte_data is not null))
);
create index if not exists ma_origination_facts_deal_idx on public.ma_origination_facts (deal_id, ordem);
comment on table public.ma_origination_facts is
  'Fatos da Originação com rótulo de confiança. Valor numérico estruturado alimenta o teste de coerência da Etapa 3.';

-- Moeda x unidade e teto de sanidade dependem do catálogo: validação por trigger.
create or replace function public.ma_origination_fact_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  u public.ma_origination_units%rowtype;
begin
  new.updated_at := now();
  if new.unidade is null then
    if new.moeda is not null then
      raise exception 'moeda informada sem unidade monetária' using errcode = '23514';
    end if;
    return new;
  end if;
  select * into u from public.ma_origination_units where code = new.unidade;
  if u.monetaria and new.moeda is null then
    raise exception 'moeda obrigatória (ISO 4217) para valor monetário' using errcode = '23514';
  end if;
  if not u.monetaria and new.moeda is not null then
    raise exception 'moeda informada em unidade não monetária' using errcode = '23514';
  end if;
  if new.valor_max > u.teto then
    raise exception 'valor acima do teto de sanidade de %', u.label using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists ma_origination_fact_check on public.ma_origination_facts;
create trigger ma_origination_fact_check
  before insert or update on public.ma_origination_facts
  for each row execute function public.ma_origination_fact_check();

-- updated_at de nomes: reaproveita a função padrão do projeto.
drop trigger if exists trg_ma_origination_names_updated_at on public.ma_origination_names;
create trigger trg_ma_origination_names_updated_at
  before update on public.ma_origination_names
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------------
alter table public.ma_origination_units enable row level security;
alter table public.ma_origination_names enable row level security;
alter table public.ma_origination_facts enable row level security;

drop policy if exists "autenticado le unidades" on public.ma_origination_units;
create policy "autenticado le unidades" on public.ma_origination_units
  for select using (auth.uid() is not null);

drop policy if exists "mesa gerencia nomes da originacao" on public.ma_origination_names;
create policy "mesa gerencia nomes da originacao" on public.ma_origination_names
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role])))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role])));

drop policy if exists "mesa gerencia fatos da originacao" on public.ma_origination_facts;
create policy "mesa gerencia fatos da originacao" on public.ma_origination_facts
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role])))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role])));

commit;
