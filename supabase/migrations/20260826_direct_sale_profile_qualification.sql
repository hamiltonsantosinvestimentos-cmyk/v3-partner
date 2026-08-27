-- Qualificação de perfil no checkout direto de /analise-v2 (26/08/2026).
-- Blinda 2 problemas reais de negócio: empresário comprando só CNPJ
-- (diagnóstico incompleto sem sócio/garantidor) e pessoa física sem
-- empresa travada comprando 1 CNPJ que não precisa. Ver
-- lib/credit-analysis-pricing.ts getMinCounts() para a regra de mínimos.
--
-- Colunas puramente informativas para a Mesa (Credit Engine) entender o
-- contexto da compra — não alteram o cálculo de preço, que continua 100%
-- derivado de cnpj_count/cpf_count (migration 20260820). Pedido sem
-- qualificação de perfil (link legado, /analise Variante A) grava NULL.

ALTER TABLE partner_service_orders
  ADD COLUMN IF NOT EXISTS profile_type text
    CHECK (profile_type IS NULL OR profile_type IN ('PF', 'PJ')),
  ADD COLUMN IF NOT EXISTS company_structure text
    CHECK (company_structure IS NULL OR company_structure IN ('UNIPESSOAL', 'MULTIPLOS_SOCIOS'));

COMMENT ON COLUMN partner_service_orders.profile_type IS
  'Perfil escolhido no fluxo guiado de /analise-v2: PF (pessoa física, sem CNPJ) ou PJ (empresário/sócio). NULL = pedido legado, sem qualificação de perfil.';
COMMENT ON COLUMN partner_service_orders.company_structure IS
  'Estrutura societária, só preenchida quando profile_type=PJ: UNIPESSOAL (mín. 1 CNPJ + 1 CPF) ou MULTIPLOS_SOCIOS (mín. 1 CNPJ + 2 CPF). NULL para PF ou pedido legado.';

-- Rollback:
-- ALTER TABLE partner_service_orders
--   DROP COLUMN IF EXISTS profile_type,
--   DROP COLUMN IF EXISTS company_structure;
