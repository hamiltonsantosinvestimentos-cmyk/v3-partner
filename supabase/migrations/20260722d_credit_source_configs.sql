-- Painel de Configuração de Fontes do Credit Engine por Cliente
-- Feature Spec: 06_Operacional/SOPs/2026-07-20_Operacional_FeatureSpec-PainelConfiguracaoFontesCreditEngine_v1.md
-- Aprovado por João Lemos em 22/07/2026.

CREATE TABLE IF NOT EXISTS credit_source_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  razao_social      TEXT,
  receita_federal   BOOLEAN NOT NULL DEFAULT true,
  cnj_datajud       BOOLEAN NOT NULL DEFAULT true,
  ceis              BOOLEAN NOT NULL DEFAULT true,
  registrato_bacen  BOOLEAN NOT NULL DEFAULT false,
  serasa            BOOLEAN NOT NULL DEFAULT false,
  serasa_modalidade TEXT NOT NULL DEFAULT 'simples' CHECK (serasa_modalidade IN ('simples', 'avancada')),
  serasa_cnpj       BOOLEAN NOT NULL DEFAULT true,
  serasa_cpf        BOOLEAN NOT NULL DEFAULT false,
  serasa_cpf_list   TEXT[],
  spc               BOOLEAN NOT NULL DEFAULT false,
  escavador         BOOLEAN NOT NULL DEFAULT false,
  configured_by     UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cnpj)
);

COMMENT ON COLUMN credit_source_configs.serasa_modalidade IS
  'A Serasa oferece 2 modalidades reais de consulta: simples e avancada. Este campo só importa quando serasa = true.';
COMMENT ON COLUMN credit_source_configs.serasa_cnpj IS
  'Consulta Serasa sobre o CNPJ do titular analisado (pessoa jurídica).';
COMMENT ON COLUMN credit_source_configs.serasa_cpf IS
  'Consulta Serasa sobre o(s) CPF(s) ligado(s) ao titular (sócios, avalistas). Requer lista de CPFs.';
COMMENT ON COLUMN credit_source_configs.serasa_cpf_list IS
  'CPFs a consultar quando serasa_cpf = true. Preenchido manualmente pela Mesa. Dado de PII de pessoa física, já coberto pelo sign-off LGPD-2026-07-03-001 do Credit Engine.';

DROP TRIGGER IF EXISTS trg_credit_source_configs_updated_at ON credit_source_configs;
CREATE TRIGGER trg_credit_source_configs_updated_at
  BEFORE UPDATE ON credit_source_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE credit_source_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_source_configs_mesa_all" ON credit_source_configs
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'MESA_OPERACIONAL'));

CREATE INDEX IF NOT EXISTS idx_credit_source_configs_cnpj
  ON credit_source_configs(cnpj);

-- Auditoria: retrato de quais fontes rodaram de fato em cada análise
ALTER TABLE credit_profiles
  ADD COLUMN IF NOT EXISTS source_config_snapshot JSONB;

COMMENT ON COLUMN credit_profiles.source_config_snapshot IS
  'Retrato das fontes habilitadas em credit_source_configs no momento em que esta análise foi disparada.';

-- Tabela de custeio (pricing) por fonte
CREATE TABLE IF NOT EXISTS credit_source_pricing (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                TEXT NOT NULL,
  modalidade            TEXT NOT NULL CHECK (modalidade IN ('simples', 'avancada')),
  tipo_titular          TEXT NOT NULL CHECK (tipo_titular IN ('PF', 'PJ')),
  produto_nome          TEXT,
  valor_tabela          NUMERIC(10,2) NOT NULL,
  desconto_pct          NUMERIC(5,2),
  valor_unitario_final  NUMERIC(10,2) NOT NULL,
  volume_mensal_plano   INTEGER,
  valor_mensal_plano    NUMERIC(10,2),
  fidelidade_meses      INTEGER,
  status                TEXT NOT NULL DEFAULT 'cotacao' CHECK (status IN ('cotacao', 'contratado', 'encerrado')),
  vigente_desde         DATE,
  vigente_ate           DATE,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_credit_source_pricing_updated_at ON credit_source_pricing;
CREATE TRIGGER trg_credit_source_pricing_updated_at
  BEFORE UPDATE ON credit_source_pricing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE credit_source_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_source_pricing_admin_all" ON credit_source_pricing
  FOR ALL TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE INDEX IF NOT EXISTS idx_credit_source_pricing_source_modalidade
  ON credit_source_pricing(source, modalidade, tipo_titular);

INSERT INTO credit_source_pricing
  (source, modalidade, tipo_titular, produto_nome, valor_tabela, desconto_pct, valor_unitario_final, volume_mensal_plano, valor_mensal_plano, fidelidade_meses, status, observacoes)
VALUES
  ('serasa', 'avancada', 'PF', 'Relatório Recomenda Avançado', 30.10, 30.00, 21.07, 100, 2116.00, 12, 'cotacao', 'Cotação recebida 20/07/2026. Valor mensal informado (R$2.116,00) não fecha exatamente com 100 x R$21,07 = R$2.107,00: confirmar com a Serasa se há arredondamento na tabela ou se o plano combina PF e PJ.'),
  ('serasa', 'avancada', 'PJ', 'Relatório Recomenda Avançado', 37.35, 30.00, 26.15, 80,  2116.00, 12, 'cotacao', 'Cotação recebida 20/07/2026, mesma observação de arredondamento acima. Tabela original apresentava as linhas PF e PJ separadas por "OU": confirmar com a Serasa se são planos mutuamente exclusivos ou contratáveis em paralelo.')
ON CONFLICT DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS credit_source_configs CASCADE;
-- DROP TABLE IF EXISTS credit_source_pricing CASCADE;
-- ALTER TABLE credit_profiles DROP COLUMN IF EXISTS source_config_snapshot;
