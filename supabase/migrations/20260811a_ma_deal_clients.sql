-- =============================================================================
-- CLIENT 360, FASE B: M&A entra no Client 360 (multiplos clientes, ciclo de vida)
-- =============================================================================
--
-- CONTEXTO
--   Joao (arquiteto/orquestrador, confirmado via /AIOX:agents:data-engineer e
--   confirmacao verbal direta em 10-11/08/2026) definiu as regras de negocio:
--   um deal de M&A pode ter multiplos clientes, cada um com um papel
--   (comprador/vendedor/intermediario) que PODE VARIAR de deal para deal (o
--   mesmo CPF/CNPJ pode comprar um precatorio hoje e vender outro amanha),
--   e um ciclo de vida por deal: prospecto -> a_performar -> performado.
--
-- ACHADO REAL, MUDOU O DESENHO ORIGINAL
--   O plano original assumia que o papel seria definido "no momento da
--   qualificacao dos documentos (NDA, FPA, Mandato)". Investigado antes de
--   codar: cm_party_qualifications/cm_qualification_batches so cobre Bolsa
--   de Ativos (FK para listing_id, cm_asset_listings) -- nao existe deal_id
--   de M&A nessa tabela. M&A nao tem hoje nenhum fluxo estruturado de
--   captura de CPF/CNPJ por parte. Decisao de Joao: a Mesa vincula
--   manualmente por CPF/CNPJ por enquanto (tela simples), sem depender de
--   um fluxo de qualificacao que ainda nao existe para M&A. Estender
--   cm_qualification_batches para M&A fica registrado como possibilidade
--   futura, fora do escopo desta migration.
--
--   role fica NULLABLE de proposito: a linha nasce como "prospecto" assim
--   que a Mesa vincula o cliente ao deal, e o papel (comprador/vendedor/
--   intermediario) e definido pela Mesa explicitamente, nunca inferido por
--   heuristica de match de nome contra ma_deals.buyer_name/seller_name
--   (texto livre, seria adivinhacao, nao dado confiavel).
--
-- TRANSICOES DE STATUS AUTOMATIZADAS NESTA SESSAO
--   prospecto -> a_performar: app/api/ma/clicksign-webhook/route.ts, quando
--     um operation_contracts.status_signature vira 'assinado' para um
--     contrato com deal_id preenchido.
--   a_performar -> performado: app/api/ma-deals/route.ts (PATCH), quando
--     ma_deals.stage vira 'CLOSED_WON'.
--   Nenhuma transicao anda pra tras automaticamente (nunca rebaixa
--     performado, por exemplo).
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 1 tabela nova. Nenhum DROP, nenhum UPDATE em dado
--   existente.
-- =============================================================================

create table if not exists public.ma_deal_clients (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.ma_deals(id) on delete cascade,
  v3_client_id  uuid not null references public.v3_clients(id),
  role          text check (role in ('comprador', 'vendedor', 'intermediario')),
  status        text not null default 'prospecto' check (status in ('prospecto', 'a_performar', 'performado')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (deal_id, v3_client_id)
);

comment on table public.ma_deal_clients is
  'Client 360, Fase B (10-11/08/2026): vinculo cliente-deal de M&A, com papel (definido manualmente pela Mesa, nunca inferido) e ciclo de vida prospecto/a_performar/performado. Um mesmo v3_client_id pode ter papeis diferentes em deals diferentes -- o papel nao e um atributo do cliente, e um atributo da relacao com aquele deal especifico.';
comment on column public.ma_deal_clients.role is
  'comprador/vendedor/intermediario, definido pela Mesa. Nulo ate a Mesa classificar -- nunca inferido por heuristica de nome.';
comment on column public.ma_deal_clients.status is
  'prospecto (vinculado, antes de assinar) -> a_performar (contrato assinado, deal ainda nao fechado) -> performado (deal CLOSED_WON). Nunca rebaixado automaticamente.';

create index if not exists idx_ma_deal_clients_deal on public.ma_deal_clients(deal_id);
create index if not exists idx_ma_deal_clients_client on public.ma_deal_clients(v3_client_id);

alter table public.ma_deal_clients enable row level security;

drop policy if exists "mesa le clientes do deal" on public.ma_deal_clients;
create policy "mesa le clientes do deal" on public.ma_deal_clients
  for select using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));

drop policy if exists "mesa gerencia clientes do deal" on public.ma_deal_clients;
create policy "mesa gerencia clientes do deal" on public.ma_deal_clients
  for all using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  )) with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));
