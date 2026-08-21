-- Análise de Crédito D2C (/analise-v2) — preço modular por unidade
-- Substitui os 2 pacotes fixos (R$497 / R$997) por R$197 por CNPJ analisado
-- + R$197 por CPF de sócio/garantidor + upsell opcional de R$197 (Consultoria).
--
-- Pedidos novos (source='direct') sempre gravam service_type='credit_analysis'
-- (tipo único) e preenchem estas 3 colunas. Pedidos antigos ficam com elas
-- NULL — o app distingue "pedido novo" de "pedido legado" checando se
-- cnpj_count IS NULL, sem precisar de backfill nem de migrar dado histórico.

ALTER TABLE partner_service_orders
  ADD COLUMN IF NOT EXISTS cnpj_count integer CHECK (cnpj_count IS NULL OR cnpj_count >= 0),
  ADD COLUMN IF NOT EXISTS cpf_count integer CHECK (cpf_count IS NULL OR cpf_count >= 0),
  ADD COLUMN IF NOT EXISTS has_consultancy boolean;

COMMENT ON COLUMN partner_service_orders.cnpj_count IS
  'Quantidade de CNPJ incluídos no diagnóstico modular (R$197 cada). NULL = pedido criado antes desta migration (pacote fixo legado, ver service_type).';
COMMENT ON COLUMN partner_service_orders.cpf_count IS
  'Quantidade de CPF (sócio/garantidor) incluídos no diagnóstico modular (R$197 cada). NULL = pedido legado.';
COMMENT ON COLUMN partner_service_orders.has_consultancy IS
  'Upsell de Consultoria Estratégica V3 (R$197) incluído neste pedido modular. NULL = pedido legado (ver service_type=credit_analysis_consultoria para o equivalente antigo).';

-- Rollback:
-- ALTER TABLE partner_service_orders
--   DROP COLUMN IF EXISTS cnpj_count,
--   DROP COLUMN IF EXISTS cpf_count,
--   DROP COLUMN IF EXISTS has_consultancy;
