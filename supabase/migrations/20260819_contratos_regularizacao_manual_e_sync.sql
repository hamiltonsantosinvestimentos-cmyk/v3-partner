-- ============================================================
-- MIGRATION: Central de Contratos, Regularização de Contratos
-- Manuais (série V3C-REG) + infraestrutura de sincronização
-- ClickSign + vínculo de deal futuro a contrato-mãe
-- Date: 2026-08-19
--
-- Contexto: João pediu 4 ajustes ao BRIEF original (origem avulsa,
-- sincronização de assinatura, geração a partir de minuta, regularização
-- de contratos manuais pré-Central de Contratos). Esta migration cobre
-- a parte de schema dos itens 2 e 4. Itens 1 e 3 não exigem schema novo
-- (reaproveitam operation_contracts.parties e contract_templates
-- existentes).
--
-- Decisões de João nesta sessão, aplicadas ao pé da letra:
--   (a) Sigla da série nova: V3C-REG (Regularização).
--   (b) Texto jurídico do "Termo de Ratificação e Vinculação Comercial"
--       é fornecido por ele (V1 já pronta), não escrito aqui, entra via
--       INSERT em contract_templates numa sessão futura, quando o texto
--       chegar, com approval_status='rascunho' (nunca grandfathered:
--       diferente dos 8 templates de 11/08, este é novo e precisa passar
--       pelo quórum jurídico+compliance real antes de gerar qualquer
--       contrato).
--   (1) Sync via n8n batendo em /api/cron/clicksign-sync a cada 30min,
--       não cron da Vercel, sem impacto de schema, só de rota (ver
--       app/api/cron/clicksign-sync/route.ts).
--   (2) operation_contract_links.expiration_date obrigatória: trava de
--       validade do contrato-mãe antes de vincular deal futuro.
--   (3) Hash SHA-256 do arquivo original E do arquivo estampado, para
--       não-repúdio.
--   (4) message customizada no envio ClickSign, usa o campo real
--       attributes.default_message do envelope v3, confirmado por
--       chamada real contra a API de produção nesta sessão (GET
--       /api/v3/envelopes/{id} do envelope V3C-PAR-2026-0037 retornou
--       "default_subject":null,"default_message":null na resposta real,
--       confirmando que os dois campos existem de fato no schema da
--       ClickSign, não são suposição).
--
-- Achado real na mesma verificação ao vivo, registrado aqui porque
-- corrige uma suposição de migration anterior: a migration 20260814
-- afirmava que "a API v3 não expõe nenhum endpoint de download do
-- documento final assinado". Isso está ERRADO, confirmado ao vivo:
-- GET /envelopes/{id}/documents retorna, quando o documento está
-- fechado, um link presigned S3 em data[].attributes.links... na
-- verdade em data[].links.files.signed (TTL curto, ~5min). O poller de
-- e-mail (lib/clicksign-archive.ts) continua válido como método
-- primário (mais simples, já funciona), mas o sync novo desta migration
-- passa a usar esse endpoint como fonte de status por ser mais rápido
-- e não depender de e-mail chegar.
--
-- Rollback:
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS is_master_agreement;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS manual_original_path;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS stamped_document_path;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS regularization_justification;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS regularization_expires_at;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS original_file_hash;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS stamped_file_hash;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS signature_message;
--   DROP TABLE IF EXISTS operation_contract_links;
--   DELETE FROM v3_code_series WHERE id = 'V3C-REG';
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Série V3C-REG (Regularização)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.v3_code_series
  (id, label, prefix, segment_class, scope_grain, seq_width, target_table, target_column, notes)
VALUES
  ('V3C-REG', 'Regularização de Contrato Manual', 'V3C-REG', 'none', 'ano', 4,
   'operation_contracts', 'contract_code',
   'Contratos manuais pré-existentes (assinados antes da Central de Contratos, sem numeração V3) regularizados via Termo de Ratificação e Vinculação Comercial. Sigla confirmada com João em 19/08/2026. Distinto de V3C-ORG: aquele é para contrato de originação novo, este é retroativo.')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. operation_contracts: colunas novas (todas nullable, aditivo)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.operation_contracts
  ADD COLUMN IF NOT EXISTS is_master_agreement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_original_path text,
  ADD COLUMN IF NOT EXISTS stamped_document_path text,
  ADD COLUMN IF NOT EXISTS regularization_justification text,
  ADD COLUMN IF NOT EXISTS regularization_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_file_hash text,
  ADD COLUMN IF NOT EXISTS stamped_file_hash text,
  ADD COLUMN IF NOT EXISTS signature_message text;

COMMENT ON COLUMN public.operation_contracts.is_master_agreement IS 'true quando este contrato foi regularizado via upload manual (série V3C-REG) e elevado a peça-mãe/guarda-chuva, podendo ser vinculado a múltiplos deals futuros via operation_contract_links. Nunca setado por rota de geração normal (generate/route.ts), só por app/api/contracts/manual-intake.';
COMMENT ON COLUMN public.operation_contracts.manual_original_path IS 'Path no bucket Storage "documents" (contratos-manuais/{id}-original.{ext}) do arquivo manual exatamente como foi enviado, antes de qualquer carimbo, preservado intacto para conferência de hash.';
COMMENT ON COLUMN public.operation_contracts.stamped_document_path IS 'Path no bucket Storage "documents" (contratos-manuais/{id}-estampado.pdf) da versão com a estampilha digital (código V3C-REG, data de revalidação, justificativa) aplicada via pdf-lib. Distinto de signed_document_path (Fase 2 ClickSign, 20260814), que guarda o PDF assinado depois do envio.';
COMMENT ON COLUMN public.operation_contracts.regularization_justification IS 'Texto livre, obrigatório no upload manual: por que este contrato está sendo regularizado agora, quem autorizou (ex: "NDA físico assinado em 2023 com a Home Cash, nunca teve número V3, regularizado a pedido de João em 19/08/2026").';
COMMENT ON COLUMN public.operation_contracts.regularization_expires_at IS 'Validade do contrato-mãe ratificado. Null = sem prazo definido (nunca expira). Toda tentativa de vincular um novo deal via operation_contract_links é bloqueada (422) se este campo estiver no passado, ver app/api/contracts/[id]/link-deal.';
COMMENT ON COLUMN public.operation_contracts.original_file_hash IS 'SHA-256 (hex) do arquivo original exatamente como recebido no upload, calculado antes de qualquer processamento. Prova o que o cliente/parceiro de fato enviou.';
COMMENT ON COLUMN public.operation_contracts.stamped_file_hash IS 'SHA-256 (hex) do PDF final com a estampilha aplicada. Junto com original_file_hash, garante não-repúdio: qualquer auditoria futura recalcula o hash dos dois arquivos guardados no Storage e confere contra estas colunas.';
COMMENT ON COLUMN public.operation_contracts.signature_message IS 'Mensagem customizada opcional, injetada em attributes.default_message no POST /api/v3/envelopes da ClickSign (confirmado campo real via chamada de produção em 19/08/2026). Usado principalmente pela série V3C-REG para explicar ao signatário que se trata de uma revalidação/integração ao sistema V3, mas disponível para qualquer contrato.';

-- ────────────────────────────────────────────────────────────
-- 3. operation_contract_links: vínculo de contrato-mãe a deals futuros
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operation_contract_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_contract_id uuid NOT NULL REFERENCES public.operation_contracts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.ma_deals(id),
  listing_id uuid REFERENCES public.cm_asset_listings(id),
  credit_proposal_id uuid REFERENCES public.credit_desk_proposals(id),
  ticket_id uuid REFERENCES public.operational_tickets(id),
  expiration_date timestamptz NOT NULL,
  justification text NOT NULL,
  linked_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_operation_contract_links_um_destino CHECK (
    (CASE WHEN deal_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN listing_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN credit_proposal_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN ticket_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

COMMENT ON TABLE public.operation_contract_links IS 'Vincula um contrato-mãe (operation_contracts.is_master_agreement=true) a UM deal/listing/proposta/ticket futuro, sem gerar instrumento jurídico novo: o negócio passa a ser coberto pelo contrato-mãe já ratificado. Pedido explícito de João em 19/08/2026 (item 2 dos ajustes de governança).';
COMMENT ON COLUMN public.operation_contract_links.expiration_date IS 'Cópia (snapshot, não referência) de operation_contracts.regularization_expires_at no momento em que o vínculo foi criado, auditável mesmo se a validade do contrato-mãe for alterada depois. A validação de bloqueio em tempo real lê o valor atual em operation_contracts, não esta coluna.';
COMMENT ON CONSTRAINT chk_operation_contract_links_um_destino ON public.operation_contract_links IS 'Cada vínculo aponta para exatamente um destino (deal OU listing OU proposta OU ticket), nunca zero nem mais de um, mesmo padrão de exclusividade mútua já usado em operation_contracts (deal_id/listing_id/bid_id/credit_proposal_id/ticket_id).';

CREATE INDEX IF NOT EXISTS idx_operation_contract_links_master ON public.operation_contract_links(master_contract_id);

ALTER TABLE public.operation_contract_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY operation_contract_links_select ON public.operation_contract_links FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- Só ADMIN/GESTAO cria vínculo: ato com efeito jurídico real (estende um
-- contrato-mãe a um novo negócio), não é operação de rotina da Mesa.
CREATE POLICY operation_contract_links_insert ON public.operation_contract_links FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

CREATE POLICY operation_contract_links_delete ON public.operation_contract_links FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));
