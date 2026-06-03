-- Migration: 20260521_vdr_taxonomy
-- Feature: Taxonomia V3 de deals + rastreamento paramétrico VDR
-- Sprint: Imediato

-- ─── 1. Colunas de taxonomia em ma_deals ──────────────────────────────────────
ALTER TABLE ma_deals
  ADD COLUMN IF NOT EXISTS v3_code     TEXT,
  ADD COLUMN IF NOT EXISTS legacy_code TEXT;

-- Preservar códigos atuais como legado
UPDATE ma_deals
SET legacy_code = code
WHERE legacy_code IS NULL AND code IS NOT NULL;

-- Índice único no novo código (sparse — só onde v3_code não é NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_deals_v3_code
  ON ma_deals(v3_code)
  WHERE v3_code IS NOT NULL;

-- ─── 2. Função geradora de código V3 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_v3_deal_code(
  p_sector_code TEXT,
  p_date        DATE DEFAULT CURRENT_DATE
) RETURNS TEXT AS $$
DECLARE
  v_prefix   TEXT;
  v_next_seq INT;
  v_code     TEXT;
BEGIN
  -- Valida: exatamente 3 letras maiúsculas
  IF p_sector_code !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION
      'Sigla de setor inválida: %. Use exatamente 3 letras maiúsculas (ex: REA, AGR, MIN).',
      p_sector_code;
  END IF;

  v_prefix := 'V3-'
    || TO_CHAR(p_date, 'YYYY') || '-'
    || TO_CHAR(p_date, 'MM')   || '-'
    || p_sector_code           || '-';

  -- Sequencial dentro do mesmo prefixo (mês + setor)
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(v3_code FROM '\d{3}$') AS INT)), 0
  ) + 1
  INTO v_next_seq
  FROM ma_deals
  WHERE v3_code LIKE v_prefix || '%';

  v_code := v_prefix || LPAD(v_next_seq::TEXT, 3, '0');

  -- Garante unicidade com loop em caso de race condition
  WHILE EXISTS (SELECT 1 FROM ma_deals WHERE v3_code = v_code) LOOP
    v_next_seq := v_next_seq + 1;
    v_code := v_prefix || LPAD(v_next_seq::TEXT, 3, '0');
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- ─── 3. Deal Room tables (criação idempotente) ────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','closed','expired')),
  expires_at   TIMESTAMPTZ,
  nda_required BOOLEAN NOT NULL DEFAULT TRUE,
  nda_text     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_deal_rooms_updated_at ON deal_rooms;
CREATE TRIGGER trg_deal_rooms_updated_at
  BEFORE UPDATE ON deal_rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE deal_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_rooms_admin_gestao" ON deal_rooms;
CREATE POLICY "deal_rooms_admin_gestao" ON deal_rooms
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role])
  ));

CREATE TABLE IF NOT EXISTS deal_room_invites (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id        UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  investor_name       TEXT NOT NULL,
  investor_email      TEXT NOT NULL,
  investor_company    TEXT,
  token               TEXT NOT NULL UNIQUE,
  token_expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','nda_signed','viewing','expired','revoked')),
  -- Rastreamento de grupo (VDR parametrizado)
  source_group        TEXT,
  access_side         TEXT NOT NULL DEFAULT 'buyer'
                        CHECK (access_side IN ('buyer','intermediario','co_advisor','seller')),
  utm_params          JSONB DEFAULT '{}',
  first_accessed_at   TIMESTAMPTZ,
  access_count        INT NOT NULL DEFAULT 0,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_deal_room_invites_updated_at ON deal_room_invites;
CREATE TRIGGER trg_deal_room_invites_updated_at
  BEFORE UPDATE ON deal_room_invites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE deal_room_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites_admin_gestao" ON deal_room_invites;
CREATE POLICY "invites_admin_gestao" ON deal_room_invites
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role])
  ));

CREATE TABLE IF NOT EXISTS deal_room_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('cim','teaser','nda','apresentacao','outro')),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  requires_nda BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deal_room_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_docs_admin_gestao" ON deal_room_documents;
CREATE POLICY "room_docs_admin_gestao" ON deal_room_documents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role])
  ));

CREATE TABLE IF NOT EXISTS nda_signatures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id       UUID NOT NULL REFERENCES deal_room_invites(id) ON DELETE CASCADE,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      TEXT,
  user_agent      TEXT,
  agreed_text     TEXT,
  clicksign_doc_id TEXT
);

ALTER TABLE nda_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nda_admin_gestao" ON nda_signatures;
CREATE POLICY "nda_admin_gestao" ON nda_signatures
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role])
  ));

CREATE TABLE IF NOT EXISTS document_views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id    UUID NOT NULL REFERENCES deal_room_invites(id) ON DELETE CASCADE,
  document_id  UUID REFERENCES deal_room_documents(id) ON DELETE SET NULL,
  viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INT,
  ip_address   TEXT,
  device_type  TEXT,
  status       TEXT DEFAULT 'opened' CHECK (status IN ('pre_nda','opened','closed'))
);

ALTER TABLE document_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_views_admin_gestao" ON document_views;
CREATE POLICY "doc_views_admin_gestao" ON document_views
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role])
  ));

-- Índices para analytics por grupo
CREATE INDEX IF NOT EXISTS idx_invites_token         ON deal_room_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_deal_room     ON deal_room_invites(deal_room_id);
CREATE INDEX IF NOT EXISTS idx_invites_source_group  ON deal_room_invites(source_group) WHERE source_group IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invites_access_side   ON deal_room_invites(access_side);
CREATE INDEX IF NOT EXISTS idx_doc_views_invite      ON document_views(invite_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_rooms_deal       ON deal_rooms(deal_id);

-- ─── 4. Tabela de setores padronizados (referência) ───────────────────────────
CREATE TABLE IF NOT EXISTS deal_sector_codes (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO deal_sector_codes (code, label, description) VALUES
  ('REA', 'Real Estate',     'Shopping, laje corporativa, SLB, BTR, incorporação'),
  ('AGR', 'Agronegócio',     'Fazendas, usinas, silos, CAR, insumos'),
  ('MIN', 'Mineração',       'Ouro, lítio, terras raras, garimpo regulado'),
  ('SAU', 'Saúde',           'Hospitais, clínicas, farmácias, diagnóstico'),
  ('ENE', 'Energia',         'Solar, eólica, PCH, usinas termelétricas'),
  ('INF', 'Infraestrutura',  'Rodovias, portos, aeroportos, saneamento'),
  ('FIN', 'Financeiro',      'Precatórios, FIDC, recebíveis, securitização'),
  ('TEC', 'Tecnologia',      'SaaS, fintechs, plataformas digitais'),
  ('LOG', 'Logística',       'Galpões, CDs, last-mile, transporte'),
  ('IND', 'Industrial',      'Fábricas, metalurgia, química, manufatura'),
  ('HOT', 'Hotelaria',       'Hotéis, resorts, apart-hotel, turismo'),
  ('GRL', 'Geral',           'Cross-vertical ou sem classificação específica')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE deal_sector_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sector_codes_read_all" ON deal_sector_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sector_codes_admin_write" ON deal_sector_codes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role])
  ));
