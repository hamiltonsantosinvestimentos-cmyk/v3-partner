-- Adiciona partner_commission_percent à tabela marketplace_products
-- Esta coluna é definida pelo admin ao aprovar o produto (comissão V3→Partner)
ALTER TABLE marketplace_products
  ADD COLUMN IF NOT EXISTS partner_commission_percent numeric(5,2);

-- Adiciona views counter
ALTER TABLE marketplace_products
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
