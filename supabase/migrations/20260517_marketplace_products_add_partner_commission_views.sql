-- Migração: adicionar colunas partner_commission_percent e views em marketplace_products
-- Necessário para o painel admin de Marketplace funcionar corretamente
-- Data: 2026-05-17

ALTER TABLE marketplace_products
  ADD COLUMN IF NOT EXISTS partner_commission_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;

-- Comentários
COMMENT ON COLUMN marketplace_products.partner_commission_percent IS 'Percentual de comissão definido pelo admin para o parceiro que indicou o lead';
COMMENT ON COLUMN marketplace_products.views IS 'Contador de visualizações do produto no marketplace';
