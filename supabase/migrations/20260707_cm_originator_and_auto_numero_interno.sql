-- ============================================================
-- MIGRATION: Partner de origem + numero interno automatico (Bolsa de Ativos)
-- Date: 2026-07-07
-- Scope: cm_asset_listings.originator_profile_id + generate_cm_numero_interno()
-- Rollback: ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS originator_profile_id;
--           DROP FUNCTION IF EXISTS generate_cm_numero_interno(date);
-- ============================================================

-- Partner que trouxe o ativo (comissionamento) — espelha ma_deals.originator_profile_id
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS originator_profile_id uuid REFERENCES profiles(id);

COMMENT ON COLUMN cm_asset_listings.originator_profile_id IS 'Partner que originou/trouxe o credito para a Mesa. Critico para calculo de comissionamento. Editavel a qualquer momento (ex: atribuir apos intake publico preenchido pelo cliente sem partner selecionado).';

-- Numero interno automatico, mesma logica do generate_v3_deal_code() do M&A,
-- mas apontando para cm_asset_listings com sector fixo 'BOL' (Bolsa de Ativos)
CREATE OR REPLACE FUNCTION generate_cm_numero_interno(
  p_date date DEFAULT CURRENT_DATE
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_prefix   text;
  v_next_seq int;
  v_code     text;
BEGIN
  v_prefix := 'V3-'
    || TO_CHAR(p_date, 'YYYY') || '-'
    || TO_CHAR(p_date, 'MM')   || '-'
    || 'BOL-';

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(numero_interno FROM '\d{3}$') AS int)), 0
  ) + 1
  INTO v_next_seq
  FROM cm_asset_listings
  WHERE numero_interno LIKE v_prefix || '%';

  v_code := v_prefix || LPAD(v_next_seq::text, 3, '0');

  WHILE EXISTS (SELECT 1 FROM cm_asset_listings WHERE numero_interno = v_code) LOOP
    v_next_seq := v_next_seq + 1;
    v_code := v_prefix || LPAD(v_next_seq::text, 3, '0');
  END LOOP;

  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION generate_cm_numero_interno(date) IS 'Gera numero interno automatico da Mesa para a Bolsa de Ativos, formato V3-YYYY-MM-BOL-NNN, sequencial por mes. Espelha generate_v3_deal_code() do M&A.';
