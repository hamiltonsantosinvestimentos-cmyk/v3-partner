-- ============================================================
-- MIGRATION: contract_templates.requires_counterparty_signature
-- Date: 2026-09-03
-- Scope: suporta minutas assinadas SÓ pela V3 (carta unilateral de
--        manifestação de interesse ao Cedente/Vendedor, comprador oculto),
--        sem exigir contraparte/qualificação como todo template hoje exige.
-- Nullable-safe: default true preserva 100% do comportamento atual de
-- qualquer template já existente (todos continuam exigindo contraparte).
-- Rollback:
--   ALTER TABLE contract_templates DROP COLUMN IF EXISTS requires_counterparty_signature;
-- ============================================================

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS requires_counterparty_signature boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN contract_templates.requires_counterparty_signature IS
  'true (default) = template exige contraparte/qualificação como signatário, comportamento atual de toda minuta existente. false = documento unilateral, só V3 (João Lemos Netto) assina — ex: Carta de Intenção de Compra V3 para Terceiros, onde o destinatário só recebe, nunca assina.';
