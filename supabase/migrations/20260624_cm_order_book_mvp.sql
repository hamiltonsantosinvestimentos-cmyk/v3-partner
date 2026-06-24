-- ============================================================
-- MIGRATION: Capital Markets Order Book MVP
-- Date: 2026-06-24
-- Scope: ask_price_floor, auto-aceite, checklists, Deal Room tiers, mandato V3
-- ============================================================

-- ════════════════════════════════════════════════════
-- 1. COLUNAS NOVAS: cm_asset_listings
-- ════════════════════════════════════════════════════

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS ask_price_floor numeric;
COMMENT ON COLUMN cm_asset_listings.ask_price_floor IS 'Preco minimo aceitavel pelo cedente. Bid >= floor permite auto-aceite.';

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS auto_accept_enabled boolean DEFAULT false;
COMMENT ON COLUMN cm_asset_listings.auto_accept_enabled IS 'Se true + bid >= ask_price_floor → aceite automatico sem intervencao da Mesa.';

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS mandato_v3_template_id uuid;

-- ════════════════════════════════════════════════════
-- 2. COLUNAS NOVAS: cm_bids
-- ════════════════════════════════════════════════════

ALTER TABLE cm_bids ADD COLUMN IF NOT EXISTS proof_of_funds_url text;
ALTER TABLE cm_bids ADD COLUMN IF NOT EXISTS buyer_qualified boolean DEFAULT false;
ALTER TABLE cm_bids ADD COLUMN IF NOT EXISTS auto_accepted boolean DEFAULT false;
COMMENT ON COLUMN cm_bids.auto_accepted IS 'true se bid foi aceito automaticamente (bid_value >= ask_price_floor).';

-- ════════════════════════════════════════════════════
-- 3. COLUNAS NOVAS: cm_deal_room_access
-- ════════════════════════════════════════════════════

ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS access_tier text DEFAULT 'nda_only';
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS qualification_status text DEFAULT 'pendente';
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS bid_id uuid;
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS mandato_v3_accepted boolean DEFAULT false;
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS mandato_v3_accepted_at timestamptz;
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS mandato_v3_hash text;
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS proof_of_funds_path text;
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS qualification_notes text;
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS qualified_by uuid;
ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS qualified_at timestamptz;

-- Constraints via CHECK (idempotent — wrap in DO block)
DO $$ BEGIN
  ALTER TABLE cm_deal_room_access ADD CONSTRAINT chk_access_tier
    CHECK (access_tier IN ('nda_only', 'qualified', 'full_dd'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cm_deal_room_access ADD CONSTRAINT chk_qualification_status
    CHECK (qualification_status IN ('pendente', 'aprovado', 'reprovado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════
-- 4. NOVA TABELA: cm_operation_checklists
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_operation_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES cm_bids(id),
  checklist_type text NOT NULL CHECK (checklist_type IN ('pre_aceite', 'pre_fechamento', 'pos_cessao')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_operation_checklists IS 'Checklists operacionais por listing/bid: pre-aceite, pre-fechamento, pos-cessao.';

CREATE INDEX IF NOT EXISTS idx_cm_checklists_listing ON cm_operation_checklists(listing_id);
CREATE INDEX IF NOT EXISTS idx_cm_checklists_bid ON cm_operation_checklists(bid_id);
CREATE INDEX IF NOT EXISTS idx_cm_checklists_type ON cm_operation_checklists(checklist_type);

ALTER TABLE cm_operation_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_checklists_select ON cm_operation_checklists FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_checklists_insert ON cm_operation_checklists FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

CREATE POLICY cm_checklists_update ON cm_operation_checklists FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

-- ════════════════════════════════════════════════════
-- 5. NOVA TABELA: cm_checklist_items
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES cm_operation_checklists(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES profiles(id),
  checked_at timestamptz,
  evidence_url text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_checklist_items IS 'Itens individuais de cada checklist. Cada item pode ter evidencia (URL) e notas.';

CREATE INDEX IF NOT EXISTS idx_cm_checklist_items_checklist ON cm_checklist_items(checklist_id);

ALTER TABLE cm_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_items_select ON cm_checklist_items FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_items_insert ON cm_checklist_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

CREATE POLICY cm_items_update ON cm_checklist_items FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

-- ════════════════════════════════════════════════════
-- 6. TRIGGERS: updated_at
-- ════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TRIGGER trg_cm_checklists_updated BEFORE UPDATE ON cm_operation_checklists
    FOR EACH ROW EXECUTE FUNCTION cm_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════
-- 7. TRIGGER: proteger mandato_v3_hash contra alteracao
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION protect_mandato_v3_hash()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.mandato_v3_hash IS NOT NULL AND NEW.mandato_v3_hash IS DISTINCT FROM OLD.mandato_v3_hash THEN
    RAISE EXCEPTION 'mandato_v3_hash e imutavel apos definido';
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_protect_mandato_hash BEFORE UPDATE ON cm_deal_room_access
    FOR EACH ROW EXECUTE FUNCTION protect_mandato_v3_hash();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════
-- 8. FUNCTION: create_checklist_from_template
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_cm_checklist(
  p_listing_id uuid,
  p_bid_id uuid DEFAULT NULL,
  p_type text DEFAULT 'pre_fechamento'
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_checklist_id uuid;
  v_items jsonb;
BEGIN
  INSERT INTO cm_operation_checklists (listing_id, bid_id, checklist_type)
  VALUES (p_listing_id, p_bid_id, p_type)
  RETURNING id INTO v_checklist_id;

  v_items := CASE p_type
    WHEN 'pre_aceite' THEN '[
      {"key":"proof_of_funds","label":"Prova de fundos verificada","sort":1},
      {"key":"kyc_pld","label":"KYC/PLD do comprador OK","sort":2},
      {"key":"valor_compativel","label":"Valor compativel com floor","sort":3},
      {"key":"mandato_v3","label":"Mandato V3 assinado","sort":4},
      {"key":"conflito_interesse","label":"Conflito de interesse verificado","sort":5}
    ]'::jsonb
    WHEN 'pre_fechamento' THEN '[
      {"key":"loi_assinada","label":"LOI assinada (comprador)","sort":1},
      {"key":"contrato_cessao","label":"Contrato de cessao minutado","sort":2},
      {"key":"procuracao_cedente","label":"Procuracao do cedente OK","sort":3},
      {"key":"cnds_atualizadas","label":"CNDs do cedente atualizadas","sort":4},
      {"key":"escritorio_notificado","label":"Escritorio vendedor notificado","sort":5},
      {"key":"comissao_definida","label":"Comissao V3 definida e aceita","sort":6},
      {"key":"forma_pagamento","label":"Forma de pagamento acordada","sort":7},
      {"key":"escrow_definida","label":"Escrow account definida (se aplicavel)","sort":8}
    ]'::jsonb
    WHEN 'pos_cessao' THEN '[
      {"key":"cartorio","label":"Contrato registrado em cartorio","sort":1},
      {"key":"intimacao","label":"Intimacao judicial realizada (protocolo)","sort":2},
      {"key":"ente_notificado","label":"Ente devedor notificado","sort":3},
      {"key":"averbacao","label":"Cessao averbada no processo","sort":4},
      {"key":"comissao_paga","label":"Comissao V3 paga","sort":5},
      {"key":"credito_transferido","label":"Credito transferido no tribunal","sort":6}
    ]'::jsonb
  END;

  INSERT INTO cm_checklist_items (checklist_id, item_key, label, sort_order)
  SELECT v_checklist_id, elem->>'key', elem->>'label', (elem->>'sort')::int
  FROM jsonb_array_elements(v_items) AS elem;

  RETURN v_checklist_id;
END;
$$;

-- ════════════════════════════════════════════════════
-- ROLLBACK SCRIPT (if needed)
-- ════════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS trg_protect_mandato_hash ON cm_deal_room_access;
-- DROP FUNCTION IF EXISTS protect_mandato_v3_hash();
-- DROP FUNCTION IF EXISTS create_cm_checklist(uuid, uuid, text);
-- DROP TABLE IF EXISTS cm_checklist_items;
-- DROP TABLE IF EXISTS cm_operation_checklists;
-- ALTER TABLE cm_deal_room_access DROP COLUMN IF EXISTS access_tier, DROP COLUMN IF EXISTS qualification_status, DROP COLUMN IF EXISTS bid_id, DROP COLUMN IF EXISTS mandato_v3_accepted, DROP COLUMN IF EXISTS mandato_v3_accepted_at, DROP COLUMN IF EXISTS mandato_v3_hash, DROP COLUMN IF EXISTS proof_of_funds_path, DROP COLUMN IF EXISTS qualification_notes, DROP COLUMN IF EXISTS qualified_by, DROP COLUMN IF EXISTS qualified_at;
-- ALTER TABLE cm_bids DROP COLUMN IF EXISTS proof_of_funds_url, DROP COLUMN IF EXISTS buyer_qualified, DROP COLUMN IF EXISTS auto_accepted;
-- ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS ask_price_floor, DROP COLUMN IF EXISTS auto_accept_enabled, DROP COLUMN IF EXISTS mandato_v3_template_id;
