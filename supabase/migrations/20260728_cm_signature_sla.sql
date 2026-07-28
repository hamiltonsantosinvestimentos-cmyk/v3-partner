-- ============================================================
-- MIGRATION: SLA de Assinaturas (48h) — Bolsa de Capitais — v1.9+
-- Date: 2026-07-28
-- Scope: coluna de timestamp para calcular SLA de assinatura pendente
--        (Painel de Monitoramento de Assinaturas, Fase 1 do refix
--        pos-homologacao Taisa/Dr. Luis Athaydes).
-- Rollback:
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS sent_to_signature_at;
-- ============================================================

ALTER TABLE operation_contracts
  ADD COLUMN IF NOT EXISTS sent_to_signature_at timestamptz;

COMMENT ON COLUMN operation_contracts.sent_to_signature_at IS
  'Timestamp do envio (ou reenvio) da notificacao de assinatura ao signatario — usado para calcular o SLA de 48h no Painel de Monitoramento de Assinaturas. Contratos criados antes desta migration nao tem este campo retroativo: o frontend usa COALESCE(sent_to_signature_at, updated_at) como fallback.';
