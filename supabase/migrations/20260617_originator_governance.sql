-- ================================================================
-- MPS Documentos V3 — Migration: Governanca de Originacao
-- Data: 2026-06-17
-- Autor: Dara (Data Engineer Agent)
-- Objetivo: Rastrear vertical de origem e originador de cada deal
-- Rollback: ALTER TABLE ma_deals DROP COLUMN origin_vertical, DROP COLUMN originator_profile_id;
-- ================================================================

-- 1. Colunas de governanca de originacao (nullable = backward compatible)
ALTER TABLE ma_deals
  ADD COLUMN IF NOT EXISTS origin_vertical TEXT
    CHECK (origin_vertical IN ('MA', 'Credito', 'Consorcios')),
  ADD COLUMN IF NOT EXISTS originator_profile_id UUID
    REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_ma_deals_origin_vertical
  ON ma_deals(origin_vertical) WHERE origin_vertical IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ma_deals_originator
  ON ma_deals(originator_profile_id) WHERE originator_profile_id IS NOT NULL;

COMMENT ON COLUMN ma_deals.origin_vertical IS 'Vertical MPS de origem do deal (MA, Credito, Consorcios). Determina path no bucket v3-docs-publico.';
COMMENT ON COLUMN ma_deals.originator_profile_id IS 'UUID do partner originador. Recebe auto-grant de read na pasta do deal via folder_access_grants.';

-- 2. Backfill: derivar origin_vertical do sector existente
UPDATE ma_deals SET origin_vertical = CASE
  WHEN sector ILIKE '%credito%' OR sector ILIKE '%recebiv%' THEN 'Credito'
  WHEN sector ILIKE '%consorcio%' OR sector ILIKE '%consórcio%' THEN 'Consorcios'
  ELSE 'MA'
END
WHERE origin_vertical IS NULL AND sector IS NOT NULL;

-- 3. Backfill: originator = created_by (quem cadastrou o deal)
UPDATE ma_deals SET originator_profile_id = created_by
WHERE originator_profile_id IS NULL AND created_by IS NOT NULL;

-- 4. Caso Meier: garantir que Rafael Campos (7b9dbab9) tem grant na pasta governada
DO $$
DECLARE
  v_folder_id UUID;
  v_rafael UUID := '7b9dbab9-1042-4ecd-865e-08bd0b5fc5f2';
BEGIN
  SELECT id INTO v_folder_id
  FROM folder_registry
  WHERE deal_code = 'V3-2026-05-REA-001' AND depth = 1
  LIMIT 1;

  IF v_folder_id IS NULL THEN
    SELECT create_deal_folder('MA', 'V3-2026-05-REA-001', 'Shopping_Center_do_Meier', v_rafael)
    INTO v_folder_id;
  END IF;

  INSERT INTO folder_access_grants (folder_id, user_id, permission, granted_by, reason)
  VALUES (v_folder_id, v_rafael, 'read', v_rafael, 'Originador do deal V3-2026-05-REA-001')
  ON CONFLICT (folder_id, user_id, permission) DO NOTHING;

  INSERT INTO folder_access_grants (folder_id, user_id, permission, granted_by, reason)
  VALUES (v_folder_id, v_rafael, 'write', v_rafael, 'Originador do deal V3-2026-05-REA-001')
  ON CONFLICT (folder_id, user_id, permission) DO NOTHING;
END $$;
