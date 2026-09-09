-- Análise de Crédito obrigatória + vínculo a Deal — extensão pra Mesa M&A
-- (09/09/2026). O gate obrigatório (tarja + bloqueio 422 + override ADMIN)
-- já existe em produção só pra Mesa de Crédito desde 26/08/2026 (PR #52/#53:
-- credit_desk_proposal_id em partner_service_orders + /api/credit-proposals
-- PATCH). Esta migration generaliza o vínculo pra também cobrir ma_deals,
-- e move o vínculo pro LINK (partner_service_links), não só pro PEDIDO
-- (partner_service_orders) — necessário pro fluxo self-service novo em
-- "Meus Links de Serviço" (dropdown de Deal), onde o vínculo precisa existir
-- ANTES do pedido ser criado pelo cliente no checkout público.
--
-- Todas as colunas são nullable — nenhum link/pedido existente é afetado.

ALTER TABLE partner_service_links
  ADD COLUMN IF NOT EXISTS credit_desk_proposal_id uuid REFERENCES credit_desk_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ma_deal_id              uuid REFERENCES ma_deals(id) ON DELETE SET NULL;

ALTER TABLE partner_service_orders
  ADD COLUMN IF NOT EXISTS ma_deal_id uuid REFERENCES ma_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_psl_credit_desk_proposal_id ON partner_service_links(credit_desk_proposal_id);
CREATE INDEX IF NOT EXISTS idx_psl_ma_deal_id              ON partner_service_links(ma_deal_id);
CREATE INDEX IF NOT EXISTS idx_pso_ma_deal_id               ON partner_service_orders(ma_deal_id);

COMMENT ON COLUMN partner_service_links.credit_desk_proposal_id IS 'Vínculo opcional criado pelo partner (dropdown em Meus Links de Serviço) OU pela Mesa (botão Link Análise no modal da proposta). Todo pedido criado a partir deste link herda o vínculo.';
COMMENT ON COLUMN partner_service_links.ma_deal_id IS 'Mesmo padrão de credit_desk_proposal_id, para Deals da Mesa M&A.';
COMMENT ON COLUMN partner_service_orders.ma_deal_id IS 'Espelha credit_desk_proposal_id (26/08/2026) — gravado a partir do link (partner_service_links.ma_deal_id) ou de ?prop=<code>&deal_type=ma em /analise-v2 (fluxo Mesa M&A, mesmo padrão do checkout direto de Crédito).';
