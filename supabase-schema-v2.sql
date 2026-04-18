-- ============================================================
-- V3 PARTNER — Schema SQL v2 (Tabelas Complementares)
-- Execute no Supabase > SQL Editor APÓS o supabase-schema.sql
-- ============================================================

-- ============================================================
-- COLUNAS ADICIONAIS na tabela profiles
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_data   JSONB DEFAULT NULL;

-- ============================================================
-- TABLE: crm_leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  document         TEXT,
  person_type      TEXT NOT NULL DEFAULT 'PJ',
  email            TEXT,
  phone            TEXT,
  segment          TEXT,
  annual_revenue   NUMERIC(15,2) NOT NULL DEFAULT 0,
  city             TEXT,
  state            TEXT,
  status           TEXT NOT NULL DEFAULT 'prospect',
  source           TEXT NOT NULL DEFAULT 'ativo',
  visit_date       DATE,
  next_contact     DATE,
  notes            TEXT,
  product_interest TEXT,
  credit_line      TEXT,
  interactions     JSONB NOT NULL DEFAULT '[]',
  partner_id       UUID REFERENCES public.profiles(id),
  partner_name     TEXT,
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_leads_select" ON public.crm_leads
  FOR SELECT USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
  );
CREATE POLICY "crm_leads_insert" ON public.crm_leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "crm_leads_update" ON public.crm_leads
  FOR UPDATE USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO')
  );
CREATE POLICY "crm_leads_delete" ON public.crm_leads
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

CREATE INDEX idx_crm_leads_partner  ON public.crm_leads(partner_id);
CREATE INDEX idx_crm_leads_status   ON public.crm_leads(status);

-- ============================================================
-- TABLE: commissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.commissions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT UNIQUE NOT NULL,
  partner_id             UUID NOT NULL REFERENCES public.profiles(id),
  operation_type         TEXT NOT NULL,   -- CREDITO | MA | CONSORCIO | SPLIT_FISCAL
  operation_id           UUID,
  operation_code         TEXT,
  operation_description  TEXT NOT NULL,
  operation_value        NUMERIC(15,2) NOT NULL,
  commission_percent     NUMERIC(5,2) NOT NULL,
  commission_value       NUMERIC(15,2) GENERATED ALWAYS AS (operation_value * commission_percent / 100) STORED,
  status                 TEXT NOT NULL DEFAULT 'A_PAGAR',  -- A_PAGAR | PAGA | CANCELADA
  operation_closed_at    TIMESTAMPTZ,
  payment_date           DATE,
  notes                  TEXT,
  created_by             UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_select" ON public.commissions
  FOR SELECT USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO', 'FINANCEIRO')
  );
CREATE POLICY "commissions_insert" ON public.commissions
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN', 'GESTAO', 'FINANCEIRO'));
CREATE POLICY "commissions_update" ON public.commissions
  FOR UPDATE USING (public.get_user_role() IN ('ADMIN', 'GESTAO', 'FINANCEIRO'));
CREATE POLICY "commissions_delete" ON public.commissions
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

CREATE INDEX idx_commissions_partner ON public.commissions(partner_id);
CREATE INDEX idx_commissions_status  ON public.commissions(status);

-- ============================================================
-- TABLE: financeiro_records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financeiro_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,   -- funcionarios | despesas_fixas | despesas_variaveis | comissoes | dre | movimentos | impostos
  data       JSONB NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER financeiro_records_updated_at
  BEFORE UPDATE ON public.financeiro_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financeiro_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_select" ON public.financeiro_records
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));
CREATE POLICY "financeiro_insert" ON public.financeiro_records
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));
CREATE POLICY "financeiro_update" ON public.financeiro_records
  FOR UPDATE USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));
CREATE POLICY "financeiro_delete" ON public.financeiro_records
  FOR DELETE USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO'));

CREATE INDEX idx_financeiro_type ON public.financeiro_records(type);

-- ============================================================
-- TABLE: consorcio_leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consorcio_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  client      TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'Imóvel',
  value       NUMERIC(15,2) NOT NULL,
  stage       TEXT NOT NULL DEFAULT 'lead',
  responsible TEXT NOT NULL,
  quota       TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER consorcio_leads_updated_at
  BEFORE UPDATE ON public.consorcio_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.consorcio_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consorcio_leads_all" ON public.consorcio_leads
  FOR ALL USING (public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE INDEX idx_consorcio_leads_stage ON public.consorcio_leads(stage);

-- ============================================================
-- TABLE: consorcio_projetos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consorcio_projetos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'IMOVEL',    -- IMOVEL | VEICULO | SERVICO | OUTROS
  credit_value NUMERIC(15,2) NOT NULL,
  client       TEXT NOT NULL,
  admin        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'AGUARDANDO', -- EM_ANDAMENTO | CONCLUIDO | AGUARDANDO | CANCELADO
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consorcio_projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consorcio_projetos_select" ON public.consorcio_projetos
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "consorcio_projetos_insert" ON public.consorcio_projetos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "consorcio_projetos_delete" ON public.consorcio_projetos
  FOR DELETE USING (public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- ============================================================
-- TABLE: consorcio_cartas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consorcio_cartas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  type         TEXT NOT NULL,                      -- IMOVEL | VEICULO | SERVICO | OUTROS
  credit_value NUMERIC(15,2) NOT NULL,
  admin        TEXT NOT NULL,
  group_name   TEXT,
  quota        TEXT,
  status       TEXT NOT NULL DEFAULT 'DISPONIVEL', -- DISPONIVEL | NEGOCIACAO | VENDIDA | UTILIZADA
  asking_price NUMERIC(15,2) NOT NULL,
  discount     NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consorcio_cartas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consorcio_cartas_select" ON public.consorcio_cartas
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "consorcio_cartas_insert" ON public.consorcio_cartas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "consorcio_cartas_delete" ON public.consorcio_cartas
  FOR DELETE USING (public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- ============================================================
-- TABLE: partner_goals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partner_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year            INT NOT NULL,
  month           INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  goal_proposals  INT NOT NULL DEFAULT 0,
  goal_approvals  INT NOT NULL DEFAULT 0,
  goal_volume     NUMERIC(15,2) NOT NULL DEFAULT 0,
  goal_deals      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, year, month)
);

CREATE TRIGGER partner_goals_updated_at
  BEFORE UPDATE ON public.partner_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.partner_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_goals_select" ON public.partner_goals
  FOR SELECT USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO')
  );
CREATE POLICY "partner_goals_insert" ON public.partner_goals
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN', 'GESTAO'));
CREATE POLICY "partner_goals_update" ON public.partner_goals
  FOR UPDATE USING (public.get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE INDEX idx_partner_goals_partner ON public.partner_goals(partner_id, year, month);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name   TEXT,
  action      TEXT NOT NULL,       -- CREATE | UPDATE | DELETE
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'GESTAO'));
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);  -- service_role inserts via lib/audit.ts

CREATE INDEX idx_audit_logs_entity    ON public.audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_user      ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created   ON public.audit_logs(created_at DESC);

-- ============================================================
-- TABLE: kyc_analyses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kyc_analyses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyst_id     UUID REFERENCES public.profiles(id),
  entity_doc     TEXT NOT NULL,
  entity_name    TEXT,
  entity_type    TEXT NOT NULL DEFAULT 'PJ',  -- PF | PJ
  operation_type TEXT,
  dd_level       TEXT NOT NULL DEFAULT 'Padrão',
  score          INT NOT NULL,
  risk_label     TEXT NOT NULL,   -- BAIXO RISCO | RISCO MÉDIO | ALTO RISCO
  verdict        TEXT NOT NULL,   -- Aprovado | Condicional | Bloqueado
  sources_used   TEXT[] DEFAULT '{}',
  raw_data       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kyc_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_analyses_select" ON public.kyc_analyses
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'GESTAO'));
CREATE POLICY "kyc_analyses_insert" ON public.kyc_analyses
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE INDEX idx_kyc_analyses_doc  ON public.kyc_analyses(entity_doc);
CREATE INDEX idx_kyc_analyses_date ON public.kyc_analyses(created_at DESC);

-- ============================================================
-- TABLE: kyc_blacklist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kyc_blacklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc        TEXT,
  name       TEXT,
  reason     TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kyc_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_blacklist_select" ON public.kyc_blacklist
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));
CREATE POLICY "kyc_blacklist_insert" ON public.kyc_blacklist
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN', 'GESTAO'));
CREATE POLICY "kyc_blacklist_update" ON public.kyc_blacklist
  FOR UPDATE USING (public.get_user_role() IN ('ADMIN', 'GESTAO'));

-- ============================================================
-- TABLE: kyc_access_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kyc_access_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ok',
  entity_doc  TEXT,
  entity_name TEXT,
  score       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kyc_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_access_log_insert" ON public.kyc_access_log
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "kyc_access_log_select" ON public.kyc_access_log
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE INDEX idx_kyc_access_log_user ON public.kyc_access_log(user_id);
CREATE INDEX idx_kyc_access_log_date ON public.kyc_access_log(created_at DESC);

-- ============================================================
-- TABLE: comunidade_prospects
-- (trial + ativos captados + investidores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comunidade_prospects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     TEXT NOT NULL,
  tipo       TEXT NOT NULL,   -- trial | ativo | investidor
  perfil     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.comunidade_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunidade_select" ON public.comunidade_prospects
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));
CREATE POLICY "comunidade_insert" ON public.comunidade_prospects
  FOR INSERT WITH CHECK (TRUE);  -- público (formulários externos)

CREATE INDEX idx_comunidade_tipo   ON public.comunidade_prospects(tipo);
CREATE INDEX idx_comunidade_codigo ON public.comunidade_prospects(codigo);
