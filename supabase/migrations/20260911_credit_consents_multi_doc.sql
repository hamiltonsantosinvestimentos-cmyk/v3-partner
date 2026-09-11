-- Suporte a múltiplos documentos por pedido de Análise de Crédito Empresarial
-- (CNPJ + sócios/garantidores, ou grupo com mais de 1 CNPJ).
--
-- Contexto: o preço já é modular (cnpj_count + cpf_count, ver
-- lib/credit-analysis-pricing.ts), mas até aqui o checkout só captura o
-- documento PRINCIPAL (client_doc, singular) — os documentos adicionais
-- (sócio, 2º CNPJ do grupo) nunca tinham onde ser guardados.
--
-- Decisão com Hamilton, 11/09/2026: em vez de pedir todos os documentos na
-- landing page (mais fricção no checkout), a Mesa Operacional gera um link
-- de consentimento LGPD por documento adicional, reaproveitando o fluxo que
-- já existe (/intake/credit/[token]). Cada documento adicional vira sua
-- própria proposta → análise → relatório, todos amarrados ao mesmo pedido
-- via partner_service_order_id. O documento principal continua exatamente
-- como está hoje (partner_service_orders.intake_token/credit_desk_proposal_id/
-- report_public_token) — nada muda nesse caminho.

ALTER TABLE credit_consents
  ADD COLUMN IF NOT EXISTS partner_service_order_id uuid REFERENCES partner_service_orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS document_label text,
  ADD COLUMN IF NOT EXISTS credit_desk_proposal_id uuid REFERENCES credit_desk_proposals(id),
  ADD COLUMN IF NOT EXISTS report_public_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS report_pdf_path text,
  ADD COLUMN IF NOT EXISTS report_delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_credit_consents_order ON credit_consents(partner_service_order_id);

COMMENT ON COLUMN credit_consents.partner_service_order_id IS
  'Preenchido só para consentimentos de documentos ADICIONAIS de um pedido multi-documento (sócio/garantidor CPF, ou 2º+ CNPJ do grupo). O documento principal do pedido continua usando partner_service_orders.intake_token, sem mudança.';
COMMENT ON COLUMN credit_consents.document_label IS
  'Rótulo livre definido pela Mesa ao gerar o link (ex: "Sócio 1 - João Silva", "CNPJ filial SP"), só para documentos adicionais.';
COMMENT ON COLUMN credit_consents.report_public_token IS
  'Token do relatório público desse documento adicional (mesmo padrão de partner_service_orders.report_public_token, mas 1:1 com o documento, não com o pedido).';
