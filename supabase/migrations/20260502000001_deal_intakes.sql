-- Migration: W2 Intake de Deals — V3 Partners
-- Scope: Independent from ma_deals — zero coupling
-- Generated: 2026-05-02
-- Actor: João Lemos (internal only, n8n service role write)

BEGIN;

-- ============================================================
-- ENUM: setor_v3
-- ============================================================
DO $$ BEGIN
  CREATE TYPE setor_v3 AS ENUM (
    'credito_recebiveis',
    'real_estate',
    'mineracao_commodities',
    'ma_cross_border'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- ENUM: tipo_operacao_v3
-- ============================================================
DO $$ BEGIN
  CREATE TYPE tipo_operacao_v3 AS ENUM (
    'venda',
    'fusao',
    'captacao',
    'estruturacao'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- ENUM: origem_lead_v3
-- ============================================================
DO $$ BEGIN
  CREATE TYPE origem_lead_v3 AS ENUM (
    'parceiro',
    'cold_outreach',
    'indicacao',
    'evento',
    'inbound'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- ENUM: status_intake
-- ============================================================
DO $$ BEGIN
  CREATE TYPE status_intake AS ENUM (
    'novo',
    'em_analise',
    'deal_card_gerado',
    'arquivado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: deal_intakes
-- Isolada de ma_deals — sem FK cruzada, sem trigger compartilhado
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_intakes (
  -- Primary key
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do ativo
  empresa_nome      TEXT NOT NULL,
  setor             setor_v3 NOT NULL,
  valor_estimado    NUMERIC(18, 2) NOT NULL
                      CONSTRAINT valor_minimo CHECK (valor_estimado >= 500000),
  tipo_operacao     tipo_operacao_v3 NOT NULL,

  -- Contato
  contato_nome      TEXT NOT NULL,
  contato_telefone  TEXT,
  contato_email     TEXT,

  -- Origem e qualificação
  origem_lead       origem_lead_v3 NOT NULL,
  observacoes       TEXT,

  -- IA: sugestão de tese gerada pelo Claude no n8n
  sugestao_tese     TEXT,

  -- Lifecycle
  status            status_intake NOT NULL DEFAULT 'novo',
  deal_card_path    TEXT, -- path do HTML em V3 Central de Documentos

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: auto-atualiza updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_intakes_updated_at ON deal_intakes;
CREATE TRIGGER trg_deal_intakes_updated_at
  BEFORE UPDATE ON deal_intakes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- INDEXES — padrão de acesso: por status e por data
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_deal_intakes_status
  ON deal_intakes(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_intakes_setor
  ON deal_intakes(setor, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_intakes_created
  ON deal_intakes(created_at DESC);

-- ============================================================
-- RLS — habilitado, acesso via service_role (n8n) e authenticated (João)
-- ============================================================
ALTER TABLE deal_intakes ENABLE ROW LEVEL SECURITY;

-- n8n usa service_role → bypassa RLS por design do Supabase
-- João autenticado no portal pode ler tudo
CREATE POLICY "deal_intakes_authenticated_read"
  ON deal_intakes
  FOR SELECT
  TO authenticated
  USING (true);

-- João pode inserir via portal se necessário
CREATE POLICY "deal_intakes_authenticated_insert"
  ON deal_intakes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- João pode atualizar status / deal_card_path
CREATE POLICY "deal_intakes_authenticated_update"
  ON deal_intakes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE deal_intakes IS
  'Intake de deals via n8n (W2). Independente de ma_deals. '
  'Service role escreve, authenticated lê/atualiza.';

COMMENT ON COLUMN deal_intakes.sugestao_tese IS
  'Gerada pelo Claude API no n8n com base em setor + tipo_operacao + valor_estimado.';

COMMENT ON COLUMN deal_intakes.deal_card_path IS
  'Caminho absoluto do HTML gerado em V3 Central de Documentos/03_MA_e_Deals/.';

COMMENT ON COLUMN deal_intakes.valor_estimado IS
  'Valor em BRL. Mínimo R$500.000 — crédito consignado/pessoal excluído por policy.';

COMMIT;
