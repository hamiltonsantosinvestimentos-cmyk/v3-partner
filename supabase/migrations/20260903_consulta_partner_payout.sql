-- ============================================================
-- MIGRATION: Valor direcionado ao partner nas consultas (Pedidos de Partners)
-- Date: 2026-09-03
-- Scope:
--   1. Nova config global em platform_settings: valor FIXO (em centavos) que
--      vira comissão do partner a cada consulta / Análise de Crédito entregue
--      ao cliente no painel "Pedidos de Partners" (agora sob a Mesa Operacional).
--      Editável em Configurações -> Comissões (ADMIN/GESTAO/FINANCEIRO).
--   2. Coluna de rastreio da comissão gerada por pedido, para idempotência e
--      para o painel mostrar "comissão do partner gerada".
--
-- A comissão nasce com status AGUARDANDO_AUTORIZACAO (mesmo fluxo das comissões
-- de crédito liberado) — ADMIN/FINANCEIRO autorizam e definem a data prevista
-- na aba Comissões. Sem retenção adicional de imposto: o valor configurado é o
-- valor cheio destinado ao partner.
--
-- Rollback:
--   ALTER TABLE partner_service_orders DROP COLUMN IF EXISTS partner_commission_id;
--   DROP INDEX IF EXISTS idx_pso_partner_commission_id;
--   DELETE FROM platform_settings WHERE key = 'consulta_partner_payout_cents';
-- ============================================================

-- ── 1. Config global — valor fixo por consulta (centavos) ──
-- Default '0' = nada é direcionado ao partner enquanto o admin não configurar.
INSERT INTO platform_settings (key, value)
VALUES ('consulta_partner_payout_cents', '0')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Rastreio da comissão gerada por pedido ──
ALTER TABLE partner_service_orders
  ADD COLUMN IF NOT EXISTS partner_commission_id uuid REFERENCES commissions(id) ON DELETE SET NULL;

COMMENT ON COLUMN partner_service_orders.partner_commission_id IS
  'Comissão gerada para o partner quando o relatório da consulta foi entregue ao cliente. Idempotência da entrega.';

CREATE INDEX IF NOT EXISTS idx_pso_partner_commission_id
  ON partner_service_orders(partner_commission_id);

-- ── 3. Conferência ──
-- SELECT key, value FROM platform_settings WHERE key = 'consulta_partner_payout_cents';
-- SELECT o.id, o.client_name, o.partner_id, o.report_delivered_at, o.partner_commission_id,
--        c.code, c.commission_value, c.status
--   FROM partner_service_orders o
--   LEFT JOIN commissions c ON c.id = o.partner_commission_id
--  WHERE o.partner_commission_id IS NOT NULL
--  ORDER BY o.report_delivered_at DESC LIMIT 20;
