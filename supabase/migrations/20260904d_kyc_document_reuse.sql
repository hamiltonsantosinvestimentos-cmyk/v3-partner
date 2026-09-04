-- ============================================================
-- MIGRATION: Reaproveitamento de KYC (Anexo ID + Contrato Social) via Client 360
-- Date: 2026-09-04
-- Scope: pedido do Robson (via João) -- qualificação de partes passa a exigir
--        anexo de documento de identificação com foto (PF) e contrato social
--        (PJ), com reaproveitamento inteligente entre operações diferentes do
--        mesmo CPF/CNPJ, para não obrigar o mesmo cliente a reenviar o mesmo
--        documento a cada novo contrato.
--
-- DECISÃO DE ARQUITETURA (ajuste feito no BRIEF antes do "go", registrado
-- aqui para quem ler esta migration sem o histórico da sessão): o documento
-- NÃO é ancorado em cm_party_qualifications (por transação) -- isso tornaria
-- reaproveitamento impossível sem duplicar o arquivo no Storage. É ancorado
-- em v3_clients (Client 360, Fase 1, 08/08/2026, lib/v3-clients.ts), o mesmo
-- padrão já usado por credit_desk_proposals/cm_asset_listings/credit_profiles/
-- partner_registrations. Uma qualificação nova do mesmo CPF/CNPJ referencia o
-- documento já existente, nunca copia bytes.
--
-- Validade: calculada em runtime (uploaded_at > now() - 12 meses, ver
-- lib/kyc-documents.ts), não é coluna própria -- decisão deliberada para
-- não ter duas fontes de verdade (uploaded_at vs uma coluna de expiração
-- redundante) enquanto a regra de negócio for uniforme (12 meses para
-- qualquer document_kind).
--
-- LGPD: vínculo daqui para frente (forward-only, resolveClient() no
-- momento do submit), mesmo padrão do Client 360 Fase 1, que não exigiu
-- sign-off formal -- diferente do Client 360 Backfill (20260810b), que
-- reaproveita dado HISTÓRICO para finalidade nova e por isso ficou gated.
-- Pedido partiu do próprio Robson (compliance).
--
-- Rollback:
--   drop table if exists public.cm_party_qualification_document_views;
--   drop table if exists public.cm_party_qualification_documents;
--   alter table public.cm_party_qualifications drop column if exists v3_client_id;
-- ============================================================

-- ── 1. cm_party_qualifications ganha o vínculo de identidade ──

alter table public.cm_party_qualifications
  add column if not exists v3_client_id uuid references public.v3_clients(id);

comment on column public.cm_party_qualifications.v3_client_id is
  'Resolvido via resolveClient() em POST /api/cm/qualificacao/[token], a partir de cpf_cnpj (natureza PF/PF_PROCURACAO/INCAPAZ_RELATIVO) ou company_cnpj (natureza PJ). Ancora o reaproveitamento de documentos KYC (cm_party_qualification_documents) entre operações diferentes do mesmo CPF/CNPJ. Nulo para natureza INCAPAZ_ABSOLUTO/ESPOLIO no topo (a pessoa qualificada não tem documento próprio de assinatura -- quem assina é o representante, cujo v3_client_id vive dentro do JSONB representation).';

create index if not exists idx_cm_party_qual_v3_client on public.cm_party_qualifications(v3_client_id);

-- ── 2. Documentos de KYC ancorados por identidade, não por transação ──

create table if not exists public.cm_party_qualification_documents (
  id                            uuid primary key default gen_random_uuid(),
  v3_client_id                  uuid not null references public.v3_clients(id),
  document_kind                 text not null check (document_kind in ('identificacao_foto', 'contrato_social')),
  owner_label                   text,
  storage_path                  text not null,
  original_filename             text,
  mime_type                     text,
  file_size_bytes               integer,
  uploaded_by_qualification_id  uuid references public.cm_party_qualifications(id),
  uploaded_at                   timestamptz not null default now()
);

comment on table public.cm_party_qualification_documents is
  'Documentos de KYC (foto de identificação com foto, contrato social) ancorados por v3_client_id -- reaproveitáveis entre operações diferentes do mesmo CPF/CNPJ, o arquivo físico no Storage nunca é duplicado. Validade calculada em runtime (uploaded_at > now() - 12 meses, ver lib/kyc-documents.ts::KYC_VALIDITY_MONTHS), não armazenada como coluna. uploaded_by_qualification_id é só rastro de auditoria (qual qualificação originalmente coletou o arquivo), nunca fonte de autorização de acesso -- quem autoriza é v3_client_id.';
comment on column public.cm_party_qualification_documents.owner_label is
  'Rótulo livre para exibição no card ("Parte Principal", "Representante", "Representante do Representante", "Empresa"), não modela a recursão de representação no schema -- essa recursão vive só no JSONB cm_party_qualifications.representation.';

create index if not exists idx_cm_party_qual_docs_client_kind on public.cm_party_qualification_documents(v3_client_id, document_kind, uploaded_at desc);

alter table public.cm_party_qualification_documents enable row level security;

create policy cm_party_qual_docs_select on public.cm_party_qualification_documents for select to authenticated
  using ((select public.get_user_role()) in ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

create policy cm_party_qual_docs_delete on public.cm_party_qualification_documents for delete to authenticated
  using ((select public.get_user_role()) in ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- Sem policy de INSERT para 'authenticated': o upload público (POST
-- /api/cm/qualificacao/[token]/documents) roda com a service role key no
-- servidor, que ignora RLS -- mesmo padrão de cm_party_qualifications
-- (ver comentário em 20260728c_cm_party_qualifications.sql).

-- ── 3. Log de auditoria de acesso -- mesmo padrão de cm_deal_room_document_views ──

create table if not exists public.cm_party_qualification_document_views (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.cm_party_qualification_documents(id) on delete cascade,
  viewed_by     uuid references public.profiles(id),
  ip_address    text,
  viewed_at     timestamptz not null default now()
);

comment on table public.cm_party_qualification_document_views is
  'Trilha de auditoria: toda vez que a Mesa abre/baixa um documento de KYC (foto de ID, contrato social) via GET /api/cm/qualifications/party/[id], gera uma linha aqui (gravada pelo servidor com service role, nunca pelo client). Nunca deletar -- evidência de compliance, mesmo padrão de cm_deal_room_document_views (20260708_cm_deal_room_security_kyc.sql).';

create index if not exists idx_cm_party_qual_doc_views_document on public.cm_party_qualification_document_views(document_id);

alter table public.cm_party_qualification_document_views enable row level security;

create policy cm_party_qual_doc_views_select on public.cm_party_qualification_document_views for select to authenticated
  using ((select public.get_user_role()) in ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- Sem policy de INSERT para 'authenticated': gravado por service role dentro
-- da própria rota GET que serve o documento (ver 2 acima).
