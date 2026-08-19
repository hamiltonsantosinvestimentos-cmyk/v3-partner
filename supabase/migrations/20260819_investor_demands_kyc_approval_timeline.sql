-- =============================================================================
-- KYC DO COMPRADOR (BUY-SIDE) + APROVACAO + TIMELINE DA FICHA
-- =============================================================================
--
-- CONTEXTO
--   Joao pediu (18-19/08/2026), pedido 3b da fila do dia: qualificacao clara
--   do ativo pretendido na ficha do comprador (ja tinha o dado, so faltava
--   exibir), exigencia de documentos de KYC reais (identidade, comprovante
--   de residencia, contrato social se PJ -- distinto do que a tela ja
--   chamava de "KYC" mas era na verdade LOI/MOU + procuracao, documentos de
--   mandato, nao de identidade), aprovacao formal pela Mesa com e-mail pro
--   comprador e link de retorno, e timeline de eventos visivel pra quem
--   estrutura/origina o deal.
--
-- REUSE > ADAPT > CREATE (~/.claude/rules/v3-numbering-governance.md)
--   O link de retorno "ate coletar tudo" ja existe de graca: o upload de
--   documento do comprador (POST /api/cm/intake/buy/[token]/documents) ja
--   funciona mesmo com intake_locked=true, desde 12/08/2026. cm_deal_notes
--   (bloco de notas com @mencao, ja em producao pra listing_id) e
--   generalizada pra aceitar demand_id tambem, mesmo padrao ja usado hoje
--   cedo em cm_qualification_batches (demand_id) e cm_asset_listings
--   (originator_referral_id espelhado em investor_demands).
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo em investor_demands e investor_demand_documents (coluna
--   nova nullable, 3 valores novos de CHECK). cm_deal_notes relaxa 2 NOT
--   NULL existentes (listing_id, author_id) -- nenhuma linha hoje tem os
--   dois nulos, e o CHECK novo garante que nunca vao ficar os dois nulos
--   ao mesmo tempo daqui pra frente.
-- =============================================================================

-- ── investor_demand_documents: 3 tipos reais de KYC, distintos de LOI/MOU/procuracao ──

alter table public.investor_demand_documents drop constraint if exists investor_demand_documents_document_type_check;

alter table public.investor_demand_documents
  add constraint investor_demand_documents_document_type_check check (document_type in (
    'loi_mou', 'procuracao', 'outro', -- valores originais (20260708), preservados
    'kyc_identidade', 'kyc_comprovante_residencia', 'kyc_contrato_social'
  ));

comment on column public.investor_demand_documents.document_type is
  'loi_mou/procuracao/outro: documentos de mandato (Fase 1, 08/07/2026). kyc_identidade (RG/CNH), kyc_comprovante_residencia, kyc_contrato_social (so PJ, quando investor_demands.cnpj preenchido): checklist real de KYC exigido pela Mesa antes de liberar Full DD (19/08/2026).';

-- ── investor_demands: aprovacao formal do KYC pela Mesa ──

alter table public.investor_demands
  add column if not exists kyc_approved_at timestamptz,
  add column if not exists kyc_approved_by uuid references public.profiles(id);

comment on column public.investor_demands.kyc_approved_at is
  'Setado quando a Mesa aprova o checklist de KYC (identidade + comprovante + contrato social se PJ). Distinto de status (que controla se a demanda esta ativa no motor de matching) -- um comprador pode estar ativo e ainda sem KYC aprovado.';

-- ── cm_deal_notes: generalizada pra aceitar timeline de comprador (demand_id), alem de ativo (listing_id) ──

alter table public.cm_deal_notes
  add column if not exists demand_id uuid references public.investor_demands(id) on delete cascade,
  add column if not exists is_system boolean not null default false;

alter table public.cm_deal_notes alter column listing_id drop not null;
alter table public.cm_deal_notes alter column author_id drop not null;

alter table public.cm_deal_notes drop constraint if exists cm_deal_notes_listing_ou_demand_check;
alter table public.cm_deal_notes
  add constraint cm_deal_notes_listing_ou_demand_check check (
    (listing_id is not null and demand_id is null) or (listing_id is null and demand_id is not null)
  );

comment on column public.cm_deal_notes.demand_id is
  'Timeline da ficha do comprador (Buy-Side), alternativa a listing_id -- exatamente um dos dois e preenchido, nunca os dois nem nenhum (CHECK cm_deal_notes_listing_ou_demand_check).';
comment on column public.cm_deal_notes.is_system is
  'true para eventos automaticos do pipeline (documento KYC anexado, aprovacao), gravados sem author_id humano. false (default) para nota manual escrita por alguem da Mesa.';

create index if not exists idx_cm_deal_notes_demand on public.cm_deal_notes(demand_id);
