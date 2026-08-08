-- ============================================================================
-- Fase 1 do Registro Central de Cliente (Client 360), aprovado por João em
-- 08/08/2026. Objetivo: identidade de cliente hoje vive isolada por vertical
-- (credit_desk_proposals.client_cpf_cnpj, cm_asset_listings.seller_cpf_cnpj,
-- credit_profiles.subject_cpf_cnpj, partner_registrations.cpf/cnpj), sem
-- nenhum ponto de junção. Esta migration cria a fonte da verdade e os
-- vínculos. NENHUM BACKFILL AQUI — ver 20260810b (escrita, não aplicada,
-- aguardando sign-off LGPD do Robson).
-- ============================================================================

create table if not exists public.v3_clients (
  id uuid primary key default gen_random_uuid(),
  -- Só dígitos, nunca com máscara — é a chave de identidade, e máscara
  -- inconsistente (com/sem pontuação) já foi causa de duplicidade em outras
  -- tabelas deste projeto (ver credit_line texto livre, Fase 2a).
  document_number text not null unique,
  document_type text not null check (document_type in ('CPF', 'CNPJ')),
  legal_name text,
  -- Vertical e data em que este CPF/CNPJ apareceu pela primeira vez em
  -- qualquer tabela do sistema, só para auditoria/contexto, nunca fonte de
  -- verdade de nada.
  first_seen_vertical text,
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.v3_clients is
  'Registro central de identidade de cliente (Client 360), por CPF/CNPJ, '
  'entre todas as verticais V3. Fase 1, aprovada por João 08/08/2026. '
  'Populado por lib/v3-clients.ts::resolveClient() (find-or-create '
  'idempotente), nunca escrito diretamente por rota alguma.';
comment on column public.v3_clients.document_number is
  'Só dígitos (regexp_replace \D). É a chave de identidade — nunca o nome, '
  'que muda (razão social, casamento).';

create index if not exists idx_v3_clients_document_number
  on public.v3_clients(document_number);

alter table public.v3_clients enable row level security;

drop policy if exists "v3_clients_select_authenticated" on public.v3_clients;
create policy "v3_clients_select_authenticated" on public.v3_clients
  for select to authenticated using (true);

drop policy if exists "v3_clients_all_service_role" on public.v3_clients;
create policy "v3_clients_all_service_role" on public.v3_clients
  for all to service_role using (true) with check (true);

-- ============================================================================
-- Vínculo (FK) nas 4 tabelas que já têm CPF/CNPJ normalizado hoje. Nullable:
-- nenhum dado existente é obrigado a se vincular imediatamente (o backfill é
-- Fase 1b, gated). Novas linhas passam a resolver o vínculo no momento da
-- criação, via resolveClient(), a partir de agora.
-- ============================================================================

alter table public.credit_desk_proposals
  add column if not exists v3_client_id uuid references public.v3_clients(id);

alter table public.cm_asset_listings
  add column if not exists v3_client_id uuid references public.v3_clients(id);

alter table public.credit_profiles
  add column if not exists v3_client_id uuid references public.v3_clients(id);

alter table public.partner_registrations
  add column if not exists v3_client_id uuid references public.v3_clients(id);

comment on column public.credit_desk_proposals.v3_client_id is
  'FK para v3_clients. Nulo em propostas antigas até o backfill (20260810b) '
  'ser aprovado e aplicado. Novas propostas resolvem via resolveClient().';
comment on column public.cm_asset_listings.v3_client_id is
  'FK para v3_clients. Mesmo padrão de credit_desk_proposals.v3_client_id.';
comment on column public.credit_profiles.v3_client_id is
  'FK para v3_clients. Mesmo padrão de credit_desk_proposals.v3_client_id.';
comment on column public.partner_registrations.v3_client_id is
  'FK para v3_clients. Mesmo padrão de credit_desk_proposals.v3_client_id.';
