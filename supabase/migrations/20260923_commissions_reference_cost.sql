-- Custo de referência da comissão (23/09/2026, pedido de Hamilton).
-- Comissão de consulta / Análise de Crédito (Pedidos de Partners): o partner recebe um valor
-- FIXO (config consulta_partner_payout_cents, ex. R$60), mas a aba Comissões precisa mostrar
-- também o custo de uma análise (R$197 por CNPJ/CPF). commission_percent tem 2 casas decimais,
-- então "R$197 × %" nunca dá exatamente R$60: o custo fica numa coluna própria, só de exibição,
-- e o valor pago continua operation_value × commission_percent (fixo × 100%).
-- Nullable, backward compatible: comissões que não são de consulta ficam NULL.

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS reference_cost numeric(18,2);

COMMENT ON COLUMN commissions.reference_cost IS
  'Custo de referência exibido na aba Comissões (ex.: R$197 por análise de crédito). Não entra no cálculo de commission_value.';

-- Comissões de consulta já geradas (código terminando em -CON, uma por análise entregue)
UPDATE commissions
   SET reference_cost = 197.00
 WHERE code LIKE '%-CON'
   AND reference_cost IS NULL;
