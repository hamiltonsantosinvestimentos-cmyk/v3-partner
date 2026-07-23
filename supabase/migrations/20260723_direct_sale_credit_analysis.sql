-- Landing Page D2C — Venda direta de Análise de Crédito (/analise)
-- Desacopla o checkout de partner_service_links: pedidos diretos não têm
-- link_id nem partner_id "dono", só um ref_partner_id opcional de atribuição
-- (?ref=<uuid> na URL, mesmo padrão já usado em /indicacao e /cadastro-partner).

ALTER TABLE partner_service_orders
  ALTER COLUMN link_id DROP NOT NULL,
  ALTER COLUMN partner_id DROP NOT NULL;

ALTER TABLE partner_service_orders
  ADD COLUMN IF NOT EXISTS service_type text CHECK (service_type IS NULL OR service_type IN ('credit_analysis', 'credit_analysis_consultoria')),
  ADD COLUMN IF NOT EXISTS ref_partner_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'partner_link' CHECK (source IN ('partner_link', 'direct'));

COMMENT ON COLUMN partner_service_orders.service_type IS
  'Só preenchido em pedidos source=direct (sem link_id). Pedidos source=partner_link continuam lendo service_type via join com partner_service_links.';
COMMENT ON COLUMN partner_service_orders.ref_partner_id IS
  'Partner de atribuição opcional capturado via ?ref= na landing page pública. Não é o dono do pedido (isso é partner_id, que fica NULL em vendas diretas) — é só referência para comissão manual.';
COMMENT ON COLUMN partner_service_orders.source IS
  'partner_link = pedido criado a partir de um link que um partner gerou em /meus-links. direct = venda direta na LP pública /analise, sem link de partner.';

CREATE INDEX IF NOT EXISTS idx_pso_ref_partner_id ON partner_service_orders(ref_partner_id);
CREATE INDEX IF NOT EXISTS idx_pso_source ON partner_service_orders(source);

-- RLS: pso_select/pso_update hoje cobrem ADMIN/GESTAO/MESA_OPERACIONAL (ver
-- 20260722_partner_orders_report_delivery.sql). Adiciona visão do partner
-- referenciado sobre os próprios pedidos de atribuição (para ele acompanhar
-- em /comissoes, mesmo sem ser o "dono" do pedido).
DROP POLICY IF EXISTS pso_select ON partner_service_orders;
CREATE POLICY pso_select ON partner_service_orders FOR SELECT
  USING (
    partner_id = auth.uid()
    OR ref_partner_id = auth.uid()
    OR get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
  );

-- Rollback:
-- DROP POLICY IF EXISTS pso_select ON partner_service_orders;
-- CREATE POLICY pso_select ON partner_service_orders FOR SELECT
--   USING (partner_id = auth.uid() OR get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
-- DROP INDEX IF EXISTS idx_pso_ref_partner_id;
-- DROP INDEX IF EXISTS idx_pso_source;
-- ALTER TABLE partner_service_orders
--   DROP COLUMN IF EXISTS service_type,
--   DROP COLUMN IF EXISTS ref_partner_id,
--   DROP COLUMN IF EXISTS source;
-- ALTER TABLE partner_service_orders
--   ALTER COLUMN link_id SET NOT NULL,
--   ALTER COLUMN partner_id SET NOT NULL;
