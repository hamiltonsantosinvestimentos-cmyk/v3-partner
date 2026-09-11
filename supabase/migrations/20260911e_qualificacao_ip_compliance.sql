-- ============================================================
-- MIGRATION: IP de quem preencheu qualificação / enviou documento KYC
-- Date: 2026-09-11
-- Contexto: pedido de Robson Lino (sócio compliance), relayed por João --
-- precisa ser possível identificar de qual IP cada pessoa preencheu o link
-- público de qualificação (/intake/qualificacao/[token]) e enviou cada
-- documento de KYC, para auditoria/antifraude. Hoje só existe registro de
-- IP para quando um FUNCIONÁRIO da V3 visualiza um documento já enviado
-- (cm_party_qualification_document_views) -- nunca do IP de quem enviou.
-- ============================================================

ALTER TABLE cm_party_qualifications ADD COLUMN IF NOT EXISTS filled_ip text;
ALTER TABLE cm_party_qualification_documents ADD COLUMN IF NOT EXISTS uploaded_ip text;

COMMENT ON COLUMN cm_party_qualifications.filled_ip IS
  'IP de origem de quem preencheu o formulário público de qualificação (POST /api/cm/qualificacao/[token]). Compliance (Robson Lino), 11/09/2026.';
COMMENT ON COLUMN cm_party_qualification_documents.uploaded_ip IS
  'IP de origem de quem enviou este documento de KYC (POST /api/cm/qualificacao/[token]/documents). Compliance (Robson Lino), 11/09/2026.';
