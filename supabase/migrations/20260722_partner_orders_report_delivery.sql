-- Painel de Pedidos de Partners · Análise de Crédito
-- Vincula partner_service_orders (pedidos pagos) a credit_desk_proposals e adiciona
-- rastreio de entrega do relatório final (link público + PDF).

ALTER TABLE partner_service_orders
  ADD COLUMN IF NOT EXISTS credit_desk_proposal_id UUID REFERENCES credit_desk_proposals(id),
  ADD COLUMN IF NOT EXISTS report_public_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS report_delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN partner_service_orders.credit_desk_proposal_id IS
  'Proposta criada pela Mesa a partir deste pedido pago, quando a análise é iniciada.';
COMMENT ON COLUMN partner_service_orders.report_public_token IS
  'Token da rota pública /relatorio-credito/[token]. Gerado quando a Mesa emite o relatório final.';
COMMENT ON COLUMN partner_service_orders.report_delivered_at IS
  'Preenchido quando a Mesa confirma a entrega (email enviado).';

CREATE INDEX IF NOT EXISTS idx_pso_report_public_token ON partner_service_orders(report_public_token);
CREATE INDEX IF NOT EXISTS idx_pso_credit_desk_proposal_id ON partner_service_orders(credit_desk_proposal_id);

-- RLS: pso_select/pso_update hoje só cobrem ADMIN/GESTAO. Adiciona MESA_OPERACIONAL,
-- que é quem efetivamente opera o Credit Engine no dia a dia.
DROP POLICY IF EXISTS pso_select ON partner_service_orders;
CREATE POLICY pso_select ON partner_service_orders FOR SELECT
  USING (partner_id = auth.uid() OR get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

DROP POLICY IF EXISTS pso_update ON partner_service_orders;
CREATE POLICY pso_update ON partner_service_orders FOR UPDATE
  USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

-- Rollback:
-- DROP POLICY IF EXISTS pso_select ON partner_service_orders;
-- CREATE POLICY pso_select ON partner_service_orders FOR SELECT
--   USING (partner_id = auth.uid() OR get_user_role() IN ('ADMIN','GESTAO'));
-- DROP POLICY IF EXISTS pso_update ON partner_service_orders;
-- CREATE POLICY pso_update ON partner_service_orders FOR UPDATE
--   USING (get_user_role() IN ('ADMIN','GESTAO'));
-- ALTER TABLE partner_service_orders
--   DROP COLUMN IF EXISTS credit_desk_proposal_id,
--   DROP COLUMN IF EXISTS report_public_token,
--   DROP COLUMN IF EXISTS report_delivered_at;
