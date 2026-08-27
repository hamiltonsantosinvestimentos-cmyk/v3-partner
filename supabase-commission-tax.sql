-- ============================================================
-- Impostos sobre Comissões — alíquota GLOBAL
-- + remoção do tipo de operação SPLIT_FISCAL
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── 1. Tabela de configurações da plataforma (caso ainda não exista) ──
CREATE TABLE IF NOT EXISTS platform_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_settings' AND policyname = 'authenticated read settings') THEN
    CREATE POLICY "authenticated read settings" ON public.platform_settings
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ── 2. Alíquota global de imposto sobre comissões (em %) ──
-- Default '0' = nenhum imposto retido enquanto o admin não configurar.
INSERT INTO platform_settings (key, value)
VALUES ('commission_tax_percent', '0')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Colunas de imposto na tabela commissions ──
-- tax_percent          : alíquota aplicada NAQUELA comissão (snapshot no momento do registro)
-- tax_value            : imposto retido        = comissão bruta * tax_percent/100
-- commission_net_value : líquido a receber      = comissão bruta - imposto
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS tax_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS tax_value numeric(18,2)
  GENERATED ALWAYS AS (
    round(operation_value * commission_percent * tax_percent / 10000.0, 2)
  ) STORED;

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS commission_net_value numeric(18,2)
  GENERATED ALWAYS AS (
    round(
      operation_value * commission_percent / 100.0
      - operation_value * commission_percent * tax_percent / 10000.0
    , 2)
  ) STORED;

-- ── 4. Remoção do tipo SPLIT_FISCAL ──
-- Confirmado com o time: não há comissões com operation_type = 'SPLIT_FISCAL'
-- no banco, então basta apertar o CHECK. Guarda de segurança abaixo aborta a
-- migração caso apareça alguma linha inesperada com esse tipo.
DO $$
DECLARE legadas int;
BEGIN
  SELECT count(*) INTO legadas FROM commissions WHERE operation_type = 'SPLIT_FISCAL';
  IF legadas > 0 THEN
    RAISE EXCEPTION 'Abortado: % comissão(ões) ainda usam SPLIT_FISCAL. Reclassifique antes de rodar esta migração.', legadas;
  END IF;
END $$;

ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_operation_type_check;
ALTER TABLE commissions
  ADD CONSTRAINT commissions_operation_type_check
  CHECK (operation_type IN ('CREDITO', 'MA', 'CONSORCIO', 'MARKETPLACE'));

-- ── 5. Conferência ──
-- SELECT key, value FROM platform_settings WHERE key = 'commission_tax_percent';
-- SELECT code, operation_value, commission_percent, commission_value,
--        tax_percent, tax_value, commission_net_value
--   FROM commissions ORDER BY created_at DESC LIMIT 20;
