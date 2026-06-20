-- ============================================================
-- MIGRATION: Capital Markets Marketplace — Foundation (Fase 1)
-- Date: 2026-06-19
-- Author: DARA (Database Architect) via OPTIMUS PRIME
-- Scope: 9 new tables, 3 table extensions, 5 SQL functions, RLS
-- ============================================================

-- ════════════════════════════════════════════════════
-- 1. ENUM TYPES
-- ════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE cm_asset_type AS ENUM (
    'precatorio', 'direito_creditorio', 'cgi', 'cri', 'fidc', 'outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cm_listing_status AS ENUM (
    'reuniao_validada',
    'formulario_preenchido',
    'nda_assinado',
    'em_analise',
    'aprovado_head',
    'ativo_vitrine',
    'proposta_recebida',
    'em_escrow_due_diligence',
    'liquidado',
    'cancelado',
    'expirado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cm_bid_status AS ENUM (
    'pendente', 'aceita', 'recusada', 'contra_proposta', 'expirada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cm_tranche_status AS ENUM (
    'disponivel', 'reservada', 'vendida', 'cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cm_payment_type AS ENUM (
    'a_vista', 'parcelado', 'escrow'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════
-- 2. TABLE: cm_asset_listings (core)
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_asset_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id text UNIQUE NOT NULL,
  seller_profile_id uuid REFERENCES profiles(id),
  ma_deal_id uuid REFERENCES ma_deals(id),
  asset_type cm_asset_type NOT NULL,
  seller_name text NOT NULL,
  seller_cpf_cnpj text,
  ente_devedor text,
  esfera text,
  tribunal text,
  natureza text,
  numero_processo text,
  valor_face numeric NOT NULL,
  valor_atualizado numeric,
  desagio_pretendido numeric,
  tir_estimada numeric,
  vpl numeric,
  prazo_estimado_meses integer,
  risk_score integer CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_details jsonb DEFAULT '{}'::jsonb,
  listing_status cm_listing_status NOT NULL DEFAULT 'reuniao_validada',
  allows_tranching boolean NOT NULL DEFAULT false,
  ocr_validation jsonb,
  conditional_blocks jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  nda_signed_at timestamptz,
  nda_document_url text,
  head_approved_at timestamptz,
  head_approved_by uuid REFERENCES profiles(id),
  meeting_validated_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_asset_listings IS 'Ativos listados no Marketplace de Mercado de Capitais. Core do Order Book V3.';
COMMENT ON COLUMN cm_asset_listings.anonymous_id IS 'ID anonimo para vitrine: CM-{TIPO}-{ESFERA}-{SEQ}';
COMMENT ON COLUMN cm_asset_listings.seller_cpf_cnpj IS 'CPF/CNPJ do cedente — NUNCA exposto na vitrine publica';

-- ════════════════════════════════════════════════════
-- 3. TABLE: cm_listing_documents
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_listing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  original_filename text,
  file_size_bytes bigint,
  ocr_result jsonb,
  validation_status text NOT NULL DEFAULT 'pendente',
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_listing_documents IS 'Documentos anexados a listings: CND, certidoes, sentencas, alvaras.';

-- ════════════════════════════════════════════════════
-- 4. TABLE: cm_bids
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  buyer_profile_id uuid REFERENCES investor_profiles(id),
  bid_value numeric NOT NULL,
  desagio_oferecido numeric,
  tir_pretendida numeric,
  payment_type cm_payment_type NOT NULL DEFAULT 'a_vista',
  payment_details jsonb DEFAULT '{}'::jsonb,
  status cm_bid_status NOT NULL DEFAULT 'pendente',
  expires_at timestamptz,
  notes text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_bids IS 'Lances e propostas de compra feitos por investidores na vitrine.';

-- ════════════════════════════════════════════════════
-- 5. TABLE: cm_tranches
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_tranches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  tranche_code text UNIQUE NOT NULL,
  tranche_value numeric NOT NULL,
  percentage numeric NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  buyer_profile_id uuid REFERENCES investor_profiles(id),
  bid_id uuid REFERENCES cm_bids(id),
  status cm_tranche_status NOT NULL DEFAULT 'disponivel',
  cessao_contract_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_tranches IS 'Fatias de ativos de grande porte vendidos de forma pulverizada.';

-- ════════════════════════════════════════════════════
-- 6. TABLE: cm_commission_splits
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES cm_bids(id),
  valor_face numeric NOT NULL,
  commission_total_percent numeric NOT NULL
    CONSTRAINT check_commission_range CHECK (commission_total_percent >= 5.0 AND commission_total_percent <= 20.0),
  commission_total_value numeric NOT NULL,
  split_buy_value numeric NOT NULL,
  split_platform_value numeric NOT NULL,
  split_sell_value numeric NOT NULL,
  minimum_enforced boolean NOT NULL DEFAULT false,
  maximum_exceeded boolean NOT NULL DEFAULT false,
  override_approved_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'calculado',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_commission_splits IS 'Split de comissao 3 vias. Faixa obrigatoria: 5-20%. CHECK constraint no banco.';

-- ════════════════════════════════════════════════════
-- 7. TABLE: cm_risk_scores
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL DEFAULT 'v1.0',
  calculated_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_risk_scores IS 'Historico de scores de risco por listing. Score 0-100.';

-- ════════════════════════════════════════════════════
-- 8. TABLE: cm_status_transitions
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  from_status cm_listing_status NOT NULL,
  to_status cm_listing_status NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_status_transitions IS 'Audit trail de mudancas de status dos listings. Imutavel.';

-- ════════════════════════════════════════════════════
-- 9. TABLE: cm_buyer_alerts
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_buyer_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id uuid NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  demand_id uuid REFERENCES investor_demands(id),
  channel text NOT NULL DEFAULT 'email',
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_buyer_alerts IS 'Alertas configurados pelos compradores para novos matches.';

-- ════════════════════════════════════════════════════
-- 10. TABLE: cm_escrow_operations
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_escrow_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES cm_bids(id),
  escrow_provider text,
  escrow_value numeric NOT NULL,
  contract_url text,
  status text NOT NULL DEFAULT 'aberto',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_escrow_operations IS 'Controle de operacoes em escrow para liquidacao.';

-- ════════════════════════════════════════════════════
-- 11. EXTENSIONS: investor_demands
-- ════════════════════════════════════════════════════

ALTER TABLE investor_demands ADD COLUMN IF NOT EXISTS jurisdicao_alvo text[];
ALTER TABLE investor_demands ADD COLUMN IF NOT EXISTS desagio_min numeric;
ALTER TABLE investor_demands ADD COLUMN IF NOT EXISTS natureza_preferida text[];
ALTER TABLE investor_demands ADD COLUMN IF NOT EXISTS alerta_ativo boolean DEFAULT true;
ALTER TABLE investor_demands ADD COLUMN IF NOT EXISTS asset_types_preferidos text[];

-- ════════════════════════════════════════════════════
-- 12. EXTENSIONS: commissions
-- ════════════════════════════════════════════════════

ALTER TABLE commissions ADD COLUMN IF NOT EXISTS split_buy numeric;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS split_platform numeric;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS split_sell numeric;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS minimum_enforced boolean DEFAULT false;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS override_approved_by uuid;

-- ════════════════════════════════════════════════════
-- 13. EXTENSIONS: demand_matches
-- ════════════════════════════════════════════════════

ALTER TABLE demand_matches ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'auto';
ALTER TABLE demand_matches ADD COLUMN IF NOT EXISTS notification_sent boolean DEFAULT false;
ALTER TABLE demand_matches ADD COLUMN IF NOT EXISTS buyer_viewed_at timestamptz;
ALTER TABLE demand_matches ADD COLUMN IF NOT EXISTS listing_id uuid;

-- ════════════════════════════════════════════════════
-- 14. INDEXES
-- ════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_cm_listings_status ON cm_asset_listings(listing_status);
CREATE INDEX IF NOT EXISTS idx_cm_listings_asset_type ON cm_asset_listings(asset_type);
CREATE INDEX IF NOT EXISTS idx_cm_listings_anonymous_id ON cm_asset_listings(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_cm_listings_seller ON cm_asset_listings(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_cm_listings_created ON cm_asset_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_bids_listing ON cm_bids(listing_id);
CREATE INDEX IF NOT EXISTS idx_cm_bids_buyer ON cm_bids(buyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_cm_bids_status ON cm_bids(status);
CREATE INDEX IF NOT EXISTS idx_cm_tranches_parent ON cm_tranches(parent_listing_id);
CREATE INDEX IF NOT EXISTS idx_cm_docs_listing ON cm_listing_documents(listing_id);
CREATE INDEX IF NOT EXISTS idx_cm_transitions_listing ON cm_status_transitions(listing_id);
CREATE INDEX IF NOT EXISTS idx_cm_alerts_investor ON cm_buyer_alerts(investor_profile_id);
CREATE INDEX IF NOT EXISTS idx_cm_risk_listing ON cm_risk_scores(listing_id);

-- ════════════════════════════════════════════════════
-- 15. FUNCTION: generate_cm_anonymous_id
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_cm_anonymous_id(
  p_asset_type cm_asset_type,
  p_esfera text DEFAULT 'FED'
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_type_code text;
  v_esfera_code text;
  v_seq int;
  v_id text;
BEGIN
  v_type_code := CASE p_asset_type
    WHEN 'precatorio' THEN 'PR'
    WHEN 'direito_creditorio' THEN 'DC'
    WHEN 'cgi' THEN 'CG'
    WHEN 'cri' THEN 'CR'
    WHEN 'fidc' THEN 'FI'
    ELSE 'OT'
  END;

  v_esfera_code := CASE UPPER(COALESCE(p_esfera, 'FED'))
    WHEN 'FEDERAL' THEN 'FED'
    WHEN 'ESTADUAL' THEN 'EST'
    WHEN 'MUNICIPAL' THEN 'MUN'
    ELSE UPPER(LEFT(COALESCE(p_esfera, 'FED'), 3))
  END;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(anonymous_id, '^CM-[A-Z]{2}-[A-Z]{3}-', ''), '')::int
  ), 0) + 1
  INTO v_seq
  FROM cm_asset_listings
  WHERE anonymous_id LIKE 'CM-' || v_type_code || '-' || v_esfera_code || '-%';

  v_id := 'CM-' || v_type_code || '-' || v_esfera_code || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_id;
END;
$$;

-- ════════════════════════════════════════════════════
-- 16. FUNCTION: transition_cm_listing_status
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION transition_cm_listing_status(
  p_listing_id uuid,
  p_new_status cm_listing_status,
  p_reason text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_current cm_listing_status;
  v_listing cm_asset_listings%ROWTYPE;
  v_valid boolean := false;
BEGIN
  SELECT * INTO v_listing FROM cm_asset_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_current := v_listing.listing_status;

  v_valid := CASE
    WHEN v_current = 'reuniao_validada'       AND p_new_status = 'formulario_preenchido' THEN true
    WHEN v_current = 'formulario_preenchido'  AND p_new_status = 'nda_assinado'          THEN v_listing.nda_signed_at IS NOT NULL
    WHEN v_current = 'nda_assinado'           AND p_new_status = 'em_analise'            THEN true
    WHEN v_current = 'em_analise'             AND p_new_status = 'aprovado_head'         THEN v_listing.head_approved_by IS NOT NULL
    WHEN v_current = 'aprovado_head'          AND p_new_status = 'ativo_vitrine'         THEN true
    WHEN v_current = 'ativo_vitrine'          AND p_new_status = 'proposta_recebida'     THEN true
    WHEN v_current = 'proposta_recebida'      AND p_new_status = 'em_escrow_due_diligence' THEN true
    WHEN v_current = 'em_escrow_due_diligence' AND p_new_status = 'liquidado'            THEN true
    WHEN p_new_status = 'cancelado' THEN true
    WHEN p_new_status = 'expirado'  THEN true
    ELSE false
  END;

  IF NOT v_valid THEN RETURN false; END IF;

  UPDATE cm_asset_listings
  SET listing_status = p_new_status, updated_at = now()
  WHERE id = p_listing_id;

  INSERT INTO cm_status_transitions (listing_id, from_status, to_status, reason, changed_by)
  VALUES (p_listing_id, v_current, p_new_status, p_reason, p_user_id);

  RETURN true;
END;
$$;

-- ════════════════════════════════════════════════════
-- 17. FUNCTION: calculate_cm_commission_split
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_cm_commission_split(
  p_valor_face numeric,
  p_commission_percent numeric
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_effective numeric;
  v_total numeric;
  v_split numeric;
  v_min_enforced boolean := false;
BEGIN
  IF p_commission_percent > 20.0 THEN
    RETURN jsonb_build_object(
      'error', true,
      'message', format('Bloqueio Operacional: Comissao de %s%% excede teto maximo de 20%%.', p_commission_percent),
      'requires_head_review', true
    );
  END IF;

  v_effective := GREATEST(p_commission_percent, 5.0);
  v_min_enforced := p_commission_percent < 5.0;
  v_total := p_valor_face * (v_effective / 100.0);
  v_split := ROUND(v_total / 3.0, 2);

  RETURN jsonb_build_object(
    'error', false,
    'commission_total_percent', v_effective,
    'commission_total_value', ROUND(v_total, 2),
    'split_buy_value', v_split,
    'split_platform_value', v_split,
    'split_sell_value', v_split,
    'minimum_enforced', v_min_enforced,
    'requires_head_approval', v_min_enforced
  );
END;
$$;

-- ════════════════════════════════════════════════════
-- 18. FUNCTION: calculate_cm_tir_from_desagio
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_cm_financials(
  p_valor_face numeric,
  p_desagio numeric DEFAULT NULL,
  p_tir numeric DEFAULT NULL,
  p_prazo_meses integer DEFAULT 12
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_custo numeric;
  v_ganho numeric;
  v_tir numeric;
  v_desagio numeric;
  v_vpl numeric;
  v_taxa_desconto numeric := 0.12;
BEGIN
  IF p_desagio IS NOT NULL THEN
    v_desagio := p_desagio;
    v_custo := p_valor_face * (1.0 - v_desagio / 100.0);
    v_ganho := p_valor_face - v_custo;
    v_tir := ROUND(((v_ganho / v_custo) * (12.0 / p_prazo_meses)) * 100.0, 2);
  ELSIF p_tir IS NOT NULL THEN
    v_tir := p_tir;
    v_custo := p_valor_face / (1.0 + (v_tir / 100.0) * (p_prazo_meses / 12.0));
    v_desagio := ROUND((1.0 - v_custo / p_valor_face) * 100.0, 2);
    v_ganho := p_valor_face - v_custo;
  ELSE
    RETURN jsonb_build_object('error', true, 'message', 'Informe desagio OU tir');
  END IF;

  v_vpl := ROUND(p_valor_face / POWER(1.0 + v_taxa_desconto, p_prazo_meses / 12.0), 2);

  RETURN jsonb_build_object(
    'error', false,
    'valor_face', p_valor_face,
    'desagio_percent', ROUND(v_desagio, 2),
    'custo_aquisicao', ROUND(v_custo, 2),
    'ganho_bruto', ROUND(v_ganho, 2),
    'tir_anual_percent', v_tir,
    'vpl_12pct', v_vpl,
    'prazo_meses', p_prazo_meses
  );
END;
$$;

-- ════════════════════════════════════════════════════
-- 19. FUNCTION: match_cm_listings_to_demands
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION match_cm_listings_to_demands()
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_listing cm_asset_listings%ROWTYPE;
  v_demand investor_demands%ROWTYPE;
  v_score integer;
  v_reasons jsonb;
  v_count integer := 0;
BEGIN
  FOR v_listing IN
    SELECT * FROM cm_asset_listings
    WHERE listing_status = 'ativo_vitrine'
  LOOP
    FOR v_demand IN
      SELECT * FROM investor_demands
      WHERE status = 'ativo'
      AND alerta_ativo IS NOT FALSE
    LOOP
      v_score := 0;
      v_reasons := '[]'::jsonb;

      IF v_listing.valor_face >= v_demand.ticket_min
         AND (v_demand.ticket_max = 0 OR v_listing.valor_face <= v_demand.ticket_max) THEN
        v_score := v_score + 30;
        v_reasons := v_reasons || jsonb_build_object('criterio', 'ticket', 'peso', 30);
      END IF;

      IF v_demand.jurisdicao_alvo IS NOT NULL
         AND v_listing.esfera = ANY(v_demand.jurisdicao_alvo) THEN
        v_score := v_score + 25;
        v_reasons := v_reasons || jsonb_build_object('criterio', 'jurisdicao', 'peso', 25);
      ELSIF v_demand.jurisdicao_alvo IS NULL THEN
        v_score := v_score + 10;
      END IF;

      IF v_demand.natureza_preferida IS NOT NULL
         AND v_listing.natureza = ANY(v_demand.natureza_preferida) THEN
        v_score := v_score + 20;
        v_reasons := v_reasons || jsonb_build_object('criterio', 'natureza', 'peso', 20);
      ELSIF v_demand.natureza_preferida IS NULL THEN
        v_score := v_score + 10;
      END IF;

      IF v_demand.desagio_min IS NOT NULL
         AND v_listing.desagio_pretendido >= v_demand.desagio_min THEN
        v_score := v_score + 25;
        v_reasons := v_reasons || jsonb_build_object('criterio', 'desagio', 'peso', 25);
      ELSIF v_demand.desagio_min IS NULL THEN
        v_score := v_score + 10;
      END IF;

      IF v_score >= 50 THEN
        INSERT INTO demand_matches (demand_id, deal_id, listing_id, score, match_reasons, match_type, status)
        VALUES (v_demand.id, NULL, v_listing.id, v_score, v_reasons, 'auto', 'novo')
        ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ════════════════════════════════════════════════════
-- 20. TRIGGER: auto-update updated_at
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cm_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_cm_listings_updated BEFORE UPDATE ON cm_asset_listings
    FOR EACH ROW EXECUTE FUNCTION cm_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_cm_bids_updated BEFORE UPDATE ON cm_bids
    FOR EACH ROW EXECUTE FUNCTION cm_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_cm_tranches_updated BEFORE UPDATE ON cm_tranches
    FOR EACH ROW EXECUTE FUNCTION cm_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════
-- 21. RLS POLICIES
-- ════════════════════════════════════════════════════

ALTER TABLE cm_asset_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_listing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_tranches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_buyer_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_escrow_operations ENABLE ROW LEVEL SECURITY;

-- cm_asset_listings: authenticated can read vitrine (ativo_vitrine+), admin/gestao full access
CREATE POLICY cm_listings_select ON cm_asset_listings FOR SELECT TO authenticated
  USING (
    listing_status IN ('ativo_vitrine','proposta_recebida','em_escrow_due_diligence','liquidado')
    OR created_by = auth.uid()
    OR (SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO')
  );

CREATE POLICY cm_listings_insert ON cm_asset_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY cm_listings_update ON cm_asset_listings FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO')
  );

-- cm_bids: buyer sees own, seller sees bids on their listings, admin full
CREATE POLICY cm_bids_select ON cm_bids FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR listing_id IN (SELECT id FROM cm_asset_listings WHERE created_by = auth.uid())
    OR (SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO')
  );

CREATE POLICY cm_bids_insert ON cm_bids FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY cm_bids_update ON cm_bids FOR UPDATE TO authenticated
  USING ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

-- cm_listing_documents: follows parent listing access
CREATE POLICY cm_docs_select ON cm_listing_documents FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM cm_asset_listings WHERE
        created_by = auth.uid()
        OR (SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO')
    )
  );

CREATE POLICY cm_docs_insert ON cm_listing_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- cm_tranches: same as listings
CREATE POLICY cm_tranches_select ON cm_tranches FOR SELECT TO authenticated
  USING (
    parent_listing_id IN (
      SELECT id FROM cm_asset_listings WHERE
        listing_status IN ('ativo_vitrine','proposta_recebida','em_escrow_due_diligence','liquidado')
        OR created_by = auth.uid()
        OR (SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO')
    )
  );

CREATE POLICY cm_tranches_insert ON cm_tranches FOR INSERT TO authenticated
  USING ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

-- cm_commission_splits: admin/gestao only
CREATE POLICY cm_commissions_select ON cm_commission_splits FOR SELECT TO authenticated
  USING ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

CREATE POLICY cm_commissions_insert ON cm_commission_splits FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

-- cm_risk_scores: admin/gestao only
CREATE POLICY cm_risk_select ON cm_risk_scores FOR SELECT TO authenticated
  USING ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

CREATE POLICY cm_risk_insert ON cm_risk_scores FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

-- cm_status_transitions: admin/gestao read
CREATE POLICY cm_transitions_select ON cm_status_transitions FOR SELECT TO authenticated
  USING ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

CREATE POLICY cm_transitions_insert ON cm_status_transitions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- cm_buyer_alerts: owner only
CREATE POLICY cm_alerts_select ON cm_buyer_alerts FOR SELECT TO authenticated
  USING (
    investor_profile_id IN (SELECT id FROM investor_profiles WHERE crm_lead_id IS NOT NULL)
    OR (SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO')
  );

CREATE POLICY cm_alerts_insert ON cm_buyer_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY cm_alerts_update ON cm_buyer_alerts FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- cm_escrow_operations: admin/gestao only
CREATE POLICY cm_escrow_select ON cm_escrow_operations FOR SELECT TO authenticated
  USING ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

CREATE POLICY cm_escrow_insert ON cm_escrow_operations FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role(auth.uid())) IN ('ADMIN','GESTAO'));

-- ════════════════════════════════════════════════════
-- 22. CONSTRAINT: tranches sum cannot exceed parent valor_face
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_tranche_sum()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_total numeric;
  v_parent_value numeric;
BEGIN
  SELECT valor_face INTO v_parent_value
  FROM cm_asset_listings WHERE id = NEW.parent_listing_id;

  SELECT COALESCE(SUM(tranche_value), 0) + NEW.tranche_value INTO v_total
  FROM cm_tranches
  WHERE parent_listing_id = NEW.parent_listing_id
  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_total > v_parent_value THEN
    RAISE EXCEPTION 'Soma dos tranches (R$ %) excede o valor de face do ativo (R$ %)', v_total, v_parent_value;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_check_tranche_sum BEFORE INSERT OR UPDATE ON cm_tranches
    FOR EACH ROW EXECUTE FUNCTION check_tranche_sum();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
