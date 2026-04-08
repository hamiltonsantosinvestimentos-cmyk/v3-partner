-- ============================================================
-- V3 PARTNER — KYC Engine — Migration
-- Integra o módulo KYC ao projeto principal v3-partner
-- Executar no Supabase > SQL Editor APÓS supabase-schema.sql
--
-- Acesso restrito:
--   ADMIN   → acesso total (todas as operações)
--   GESTAO  → executar análises + consultar blacklist + log
--   Demais roles (PARTNER, PARTNER_PRO, MESA_OPERACIONAL, FINANCEIRO)
--             → SEM acesso
-- ============================================================

-- ── Tabela: kyc_blacklist ────────────────────────────────
-- Lista negra consolidada: INTERPOL, OFAC, PEP, V3 Interno
CREATE TABLE IF NOT EXISTS public.kyc_blacklist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  doc         TEXT,
  nationality TEXT,
  type        TEXT NOT NULL CHECK (type IN ('interpol','ofac','pep','v3','outro')) DEFAULT 'v3',
  notes       TEXT,
  source      TEXT DEFAULT 'V3 Interno',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  added_by    UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, type)
);

CREATE TRIGGER kyc_blacklist_updated_at
  BEFORE UPDATE ON public.kyc_blacklist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.kyc_blacklist IS 'Black List KYC: INTERPOL, OFAC, PEP, V3 Interno. Acesso: ADMIN e GESTAO.';

-- ── Tabela: kyc_analyses ────────────────────────────────
-- Histórico de análises KYC realizadas
CREATE TABLE IF NOT EXISTS public.kyc_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyst_id      UUID NOT NULL REFERENCES public.profiles(id),
  entity_doc      TEXT NOT NULL,
  entity_name     TEXT,
  entity_type     TEXT CHECK (entity_type IN ('PJ','PF')) DEFAULT 'PJ',
  operation_type  TEXT,
  dd_level        TEXT CHECK (dd_level IN ('SDD','Padrão','EDD')) DEFAULT 'Padrão',
  score           INTEGER CHECK (score BETWEEN 0 AND 100),
  risk_label      TEXT CHECK (risk_label IN ('BAIXO RISCO','RISCO MÉDIO','ALTO RISCO')),
  verdict         TEXT CHECK (verdict IN ('Aprovado','Condicional','Bloqueado')),
  sources_used    TEXT[],
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.kyc_analyses IS 'Histórico KYC. Acesso: ADMIN e GESTAO.';

-- ── Tabela: kyc_access_log ──────────────────────────────
-- Auditoria de todas as ações no módulo KYC
CREATE TABLE IF NOT EXISTS public.kyc_access_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('ok','fail','parcial')),
  entity_doc  TEXT,
  entity_name TEXT,
  score       INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.kyc_access_log IS 'Log de auditoria KYC. Acesso: ADMIN e GESTAO.';

-- ── Tabela: kyc_api_keys ────────────────────────────────
-- Chaves de API armazenadas no servidor (não no browser)
CREATE TABLE IF NOT EXISTS public.kyc_api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name   TEXT UNIQUE NOT NULL, -- 'portal_transparencia', 'cnj_datajud'
  key_value  TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.kyc_api_keys IS 'Chaves de API KYC — gerenciadas apenas por ADMIN.';

-- ── Índices ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kyc_bl_name   ON public.kyc_blacklist USING gin(to_tsvector('portuguese', name));
CREATE INDEX IF NOT EXISTS idx_kyc_bl_doc    ON public.kyc_blacklist(doc);
CREATE INDEX IF NOT EXISTS idx_kyc_bl_type   ON public.kyc_blacklist(type);
CREATE INDEX IF NOT EXISTS idx_kyc_bl_active ON public.kyc_blacklist(active) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_kyc_analyses_doc      ON public.kyc_analyses(entity_doc);
CREATE INDEX IF NOT EXISTS idx_kyc_analyses_analyst  ON public.kyc_analyses(analyst_id);
CREATE INDEX IF NOT EXISTS idx_kyc_analyses_created  ON public.kyc_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_log_user    ON public.kyc_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_log_created ON public.kyc_access_log(created_at DESC);

-- ── ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE public.kyc_blacklist  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_analyses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_api_keys   ENABLE ROW LEVEL SECURITY;

-- ── Políticas: kyc_blacklist ─────────────────────────────
-- SELECT: ADMIN e GESTAO podem consultar
CREATE POLICY "kyc_bl_select" ON public.kyc_blacklist
  FOR SELECT USING (public.get_user_role() IN ('ADMIN','GESTAO'));

-- INSERT: somente ADMIN
CREATE POLICY "kyc_bl_insert" ON public.kyc_blacklist
  FOR INSERT WITH CHECK (public.get_user_role() = 'ADMIN');

-- UPDATE: somente ADMIN
CREATE POLICY "kyc_bl_update" ON public.kyc_blacklist
  FOR UPDATE USING (public.get_user_role() = 'ADMIN');

-- DELETE: somente ADMIN
CREATE POLICY "kyc_bl_delete" ON public.kyc_blacklist
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

-- ── Políticas: kyc_analyses ──────────────────────────────
-- SELECT: ADMIN vê tudo, GESTAO vê apenas as próprias análises
CREATE POLICY "kyc_analyses_select_admin" ON public.kyc_analyses
  FOR SELECT USING (public.get_user_role() = 'ADMIN');

CREATE POLICY "kyc_analyses_select_gestao" ON public.kyc_analyses
  FOR SELECT USING (
    public.get_user_role() = 'GESTAO'
    AND analyst_id = auth.uid()
  );

-- INSERT: ADMIN e GESTAO
CREATE POLICY "kyc_analyses_insert" ON public.kyc_analyses
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('ADMIN','GESTAO')
    AND analyst_id = auth.uid()
  );

-- DELETE: somente ADMIN
CREATE POLICY "kyc_analyses_delete" ON public.kyc_analyses
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

-- ── Políticas: kyc_access_log ────────────────────────────
-- SELECT: ADMIN vê tudo, GESTAO vê apenas o próprio log
CREATE POLICY "kyc_log_select_admin" ON public.kyc_access_log
  FOR SELECT USING (public.get_user_role() = 'ADMIN');

CREATE POLICY "kyc_log_select_gestao" ON public.kyc_access_log
  FOR SELECT USING (
    public.get_user_role() = 'GESTAO'
    AND user_id = auth.uid()
  );

-- INSERT: ADMIN e GESTAO (sistema insere automaticamente)
CREATE POLICY "kyc_log_insert" ON public.kyc_access_log
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN','GESTAO'));

-- DELETE: somente ADMIN
CREATE POLICY "kyc_log_delete" ON public.kyc_access_log
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

-- ── Políticas: kyc_api_keys ──────────────────────────────
-- Somente ADMIN gerencia chaves
CREATE POLICY "kyc_keys_admin_only" ON public.kyc_api_keys
  FOR ALL USING (public.get_user_role() = 'ADMIN');

-- ── View: kyc_monthly_usage ──────────────────────────────
-- Uso mensal de consultas KYC por usuário (visível para ADMIN)
CREATE OR REPLACE VIEW public.v_kyc_monthly_usage AS
  SELECT
    p.id          AS user_id,
    p.full_name,
    p.email,
    p.role,
    COUNT(a.id)   AS analyses_this_month,
    to_char(NOW(), 'YYYY-MM') AS current_month
  FROM public.profiles p
  LEFT JOIN public.kyc_analyses a
    ON a.analyst_id = p.id
    AND to_char(a.created_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')
  WHERE p.role IN ('ADMIN','GESTAO')
  GROUP BY p.id, p.full_name, p.email, p.role;

COMMENT ON VIEW public.v_kyc_monthly_usage IS 'Uso mensal KYC — visível apenas para ADMIN';

-- ── Seed: chaves de API (placeholders) ──────────────────
-- Substituir pelos valores reais após obter as chaves
INSERT INTO public.kyc_api_keys (key_name, key_value, active) VALUES
  ('portal_transparencia', 'CONFIGURAR', FALSE),
  ('cnj_datajud',          'CONFIGURAR', FALSE)
ON CONFLICT (key_name) DO NOTHING;

-- ── Resumo de acesso por role ────────────────────────────
-- ADMIN:            blacklist (tudo) + analyses (tudo) + log (tudo) + api_keys
-- GESTAO:           blacklist (SELECT) + analyses (próprias) + log (próprio)
-- PARTNER:          BLOQUEADO
-- PARTNER_PRO:      BLOQUEADO
-- MESA_OPERACIONAL: BLOQUEADO
-- FINANCEIRO:       BLOQUEADO
