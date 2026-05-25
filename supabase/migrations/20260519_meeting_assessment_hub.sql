-- Migration: Meeting & Assessment Hub — V3 Partners
-- Módulo: Qualificação de clientes para tokenização + registro de reuniões
-- Gerado: 2026-05-19
-- Projeto: sbmuashewklfhdyyuezr (V3 PARTNERS PRO)
-- Cross-references: deal_intakes, ma_deals, profiles

BEGIN;

-- ============================================================
-- ENUMs
-- ============================================================

DO $$ BEGIN
  CREATE TYPE assessment_status AS ENUM (
    'rascunho',
    'completo',
    'em_analise',
    'promovido',
    'descartado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE assessment_origem AS ENUM (
    'site_publico',
    'portal_interno',
    'reuniao'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE instrumento_recomendado AS ENUM (
    'CRI_VERDE',
    'TOKEN_RWA',
    'FIDC_ESG',
    'EQUITY_TOKEN',
    'MA_ESTRUTURADO',
    'INDEFINIDO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE meeting_type AS ENUM (
    'presencial',
    'remoto',
    'call',
    'whatsapp'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM (
    'agendada',
    'realizada',
    'cancelada',
    'remarcada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: deal_assessments
-- Respostas do formulário de qualificação + diagnóstico V3
-- Origem: site público (sem auth) OU portal interno (autenticado)
-- ============================================================

CREATE TABLE IF NOT EXISTS deal_assessments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do lead
  lead_nome                 TEXT NOT NULL,
  lead_email                TEXT,
  lead_telefone             TEXT,
  empresa_nome              TEXT NOT NULL,
  empresa_cnpj              TEXT,                 -- ⚠️ PII — validar LGPD com Robson antes de expor via API pública

  -- Bloco 1 — Estrutura do Projeto
  projeto_estagio           TEXT,                 -- 'inicial' | 'em_desenvolvimento' | 'aprovado'
  municipio_contrato        TEXT,                 -- 'nao' | 'mou' | 'formal'
  spe_status                TEXT,                 -- 'nao' | 'em_constituicao' | 'ativa'

  -- Bloco 2 — Geração de Caixa
  fontes_receita            JSONB,                -- ["biometano","energia","carbono","tipping_fee","fertilizante"]
  receita_anual_projecao    TEXT,                 -- 'ate_10m' | '10m_40m' | 'acima_40m'
  offtake_contrato          TEXT,                 -- 'nao' | 'em_negociacao' | 'assinado'

  -- Bloco 3 — Crédito de Carbono
  carbono_tco2e_estimativa  TEXT,                 -- 'nao_calculado' | '10k_50k' | 'acima_50k'
  carbono_certificacao      TEXT,                 -- 'nao_definido' | 'voluntario' | 'regulado'
  tokenizacao_motivo        TEXT,                 -- 'acesso_investidores' | 'antecipar_receita' | 'liquidez'

  -- Bloco 4 — Garantias e Investidores
  garantias                 JSONB,                -- ["terreno","equipamentos","concessao","offtake","aval_socios"]
  investidores_existentes   TEXT,                 -- 'nao' | 'interesse_informal' | 'loi_assinada'
  valor_captacao_necessario TEXT,                 -- 'ate_50m' | '50m_120m' | 'acima_120m'
  valor_captacao_brl        NUMERIC(18, 2),       -- valor exato se informado

  -- Bloco 5 — Capacidade de Estruturação
  orcamento_estruturacao    TEXT,                 -- 'menos_200k' | '200k_500k' | 'acima_500k'

  -- Diagnóstico (gerado pelo Claude Haiku após submissão)
  instrumento_recomendado   instrumento_recomendado DEFAULT 'INDEFINIDO',
  score_qualificacao        SMALLINT CHECK (score_qualificacao BETWEEN 0 AND 5),
  diagnostico_notas         TEXT,
  diagnostico_gerado_em     TIMESTAMPTZ,

  -- Metadata
  origem                    assessment_origem NOT NULL DEFAULT 'site_publico',
  status                    assessment_status NOT NULL DEFAULT 'rascunho',

  -- Cross-references com pipeline M&A (nullable — preenchidos quando promovido)
  deal_intake_id            UUID REFERENCES deal_intakes(id) ON DELETE SET NULL,
  ma_deal_id                UUID,                 -- referência a ma_deals.id (sem FK hard para evitar migration order issues)

  -- Audit
  created_by                UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL se vier do site público
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger
DROP TRIGGER IF EXISTS trg_deal_assessments_updated_at ON deal_assessments;
CREATE TRIGGER trg_deal_assessments_updated_at
  BEFORE UPDATE ON deal_assessments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE deal_assessments ENABLE ROW LEVEL SECURITY;

-- ADMIN e GESTAO: acesso total
CREATE POLICY "deal_assessments_admin_gestao_all" ON deal_assessments
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

-- MESA: pode ver e criar (não deletar)
CREATE POLICY "deal_assessments_mesa_select_insert" ON deal_assessments
  FOR SELECT TO authenticated
  USING (get_user_role() = 'MESA_OPERACIONAL');

CREATE POLICY "deal_assessments_mesa_insert" ON deal_assessments
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'MESA_OPERACIONAL');

-- Anon (site público): apenas INSERT — sem SELECT
CREATE POLICY "deal_assessments_anon_insert" ON deal_assessments
  FOR INSERT TO anon
  WITH CHECK (origem = 'site_publico');

-- Índices
CREATE INDEX IF NOT EXISTS idx_deal_assessments_status
  ON deal_assessments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_assessments_instrumento
  ON deal_assessments(instrumento_recomendado);

CREATE INDEX IF NOT EXISTS idx_deal_assessments_deal_intake
  ON deal_assessments(deal_intake_id)
  WHERE deal_intake_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_assessments_ma_deal
  ON deal_assessments(ma_deal_id)
  WHERE ma_deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_assessments_email
  ON deal_assessments(lead_email)
  WHERE lead_email IS NOT NULL;

COMMENT ON TABLE deal_assessments IS
  'Respostas do formulário de qualificação V3 (site público ou portal interno). '
  'Diagnóstico gerado por Claude Haiku. Pode ser promovido para deal_intakes ou ma_deals.';

COMMENT ON COLUMN deal_assessments.empresa_cnpj IS
  '⚠️ PII — campo sensível. Validar LGPD com Robson antes de expor via API pública. Gravar apenas se consentimento explícito.';

COMMENT ON COLUMN deal_assessments.ma_deal_id IS
  'Referência a ma_deals.id — FK soft (sem constraint hard para evitar dependency na ordem das migrations).';

-- ============================================================
-- TABLE: business_meetings
-- Registro de reuniões com clientes/prospects
-- ============================================================

CREATE TABLE IF NOT EXISTS business_meetings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do cliente
  empresa_nome              TEXT NOT NULL,
  contato_nome              TEXT NOT NULL,
  contato_email             TEXT,
  contato_telefone          TEXT,

  -- Dados da reunião
  meeting_date              DATE NOT NULL,
  meeting_type              meeting_type NOT NULL DEFAULT 'remoto',
  status                    meeting_status NOT NULL DEFAULT 'agendada',

  -- Participantes V3 (array de {profile_id, nome, role})
  participantes_v3          JSONB DEFAULT '[]'::jsonb,

  -- Conteúdo
  pauta                     TEXT,
  notas                     TEXT,
  proximo_passo             TEXT,
  prazo_proximo_passo       DATE,

  -- Cross-references (todos opcionais)
  assessment_id             UUID REFERENCES deal_assessments(id) ON DELETE SET NULL,
  deal_intake_id            UUID REFERENCES deal_intakes(id) ON DELETE SET NULL,
  ma_deal_id                UUID,                 -- FK soft para ma_deals.id

  -- Responsável pela reunião
  conducted_by              UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger
DROP TRIGGER IF EXISTS trg_business_meetings_updated_at ON business_meetings;
CREATE TRIGGER trg_business_meetings_updated_at
  BEFORE UPDATE ON business_meetings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE business_meetings ENABLE ROW LEVEL SECURITY;

-- ADMIN e GESTAO: acesso total
CREATE POLICY "business_meetings_admin_gestao_all" ON business_meetings
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

-- MESA: pode ver todas e criar/atualizar as suas
CREATE POLICY "business_meetings_mesa_select" ON business_meetings
  FOR SELECT TO authenticated
  USING (get_user_role() = 'MESA_OPERACIONAL');

CREATE POLICY "business_meetings_mesa_insert" ON business_meetings
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'MESA_OPERACIONAL' AND conducted_by = auth.uid());

CREATE POLICY "business_meetings_mesa_update_own" ON business_meetings
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'MESA_OPERACIONAL' AND conducted_by = auth.uid())
  WITH CHECK (get_user_role() = 'MESA_OPERACIONAL' AND conducted_by = auth.uid());

-- Índices
CREATE INDEX IF NOT EXISTS idx_business_meetings_date
  ON business_meetings(meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_business_meetings_status
  ON business_meetings(status, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_business_meetings_conducted_by
  ON business_meetings(conducted_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_meetings_assessment
  ON business_meetings(assessment_id)
  WHERE assessment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_meetings_deal_intake
  ON business_meetings(deal_intake_id)
  WHERE deal_intake_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_meetings_ma_deal
  ON business_meetings(ma_deal_id)
  WHERE ma_deal_id IS NOT NULL;

COMMENT ON TABLE business_meetings IS
  'Registro de reuniões com clientes e prospects V3. '
  'Vincula assessments de qualificação ao pipeline M&A (deal_intakes / ma_deals).';

COMMIT;

-- ============================================================
-- ROLLBACK (executar em caso de reversão):
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS business_meetings CASCADE;
-- DROP TABLE IF EXISTS deal_assessments CASCADE;
-- DROP TYPE IF EXISTS meeting_status CASCADE;
-- DROP TYPE IF EXISTS meeting_type CASCADE;
-- DROP TYPE IF EXISTS instrumento_recomendado CASCADE;
-- DROP TYPE IF EXISTS assessment_origem CASCADE;
-- DROP TYPE IF EXISTS assessment_status CASCADE;
-- COMMIT;
