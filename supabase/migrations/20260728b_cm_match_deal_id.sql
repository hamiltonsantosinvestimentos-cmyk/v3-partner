-- ============================================================
-- MIGRATION: Match ID + vinculo obrigatorio (Fase 2A) — Bolsa de Capitais
-- Date: 2026-07-28
-- Scope: codigo legivel de operacao (MATCH-YYYY-NNN) gerado no aceite do
--        bid, propagado para cm_deal_room_access/cm_commission_splits
--        (que ja compartilham bid_id+listing_id), e guard em
--        operation_contracts contra linha orfa (sem deal_id nem listing_id).
--        Auditoria previa confirmou 0 linhas orfas em operation_contracts
--        antes desta migration.
-- Rollback:
--   ALTER TABLE operation_contracts DROP CONSTRAINT IF EXISTS chk_operation_contracts_vinculo;
--   ALTER TABLE cm_commission_splits DROP COLUMN IF EXISTS match_deal_id;
--   ALTER TABLE cm_deal_room_access DROP COLUMN IF EXISTS match_deal_id;
--   ALTER TABLE cm_bids DROP COLUMN IF EXISTS match_deal_id;
--   DROP FUNCTION IF EXISTS generate_cm_match_id(date);
-- ============================================================

-- ════════════════════════════════════════════════════
-- 1. COLUNAS NOVAS
-- ════════════════════════════════════════════════════

ALTER TABLE cm_bids ADD COLUMN IF NOT EXISTS match_deal_id text UNIQUE;
COMMENT ON COLUMN cm_bids.match_deal_id IS 'Codigo legivel da operacao (MATCH-YYYY-NNN), gerado no momento do aceite do bid. Identifica a mesma operacao em cm_deal_room_access e cm_commission_splits.';

ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS match_deal_id text;
ALTER TABLE cm_commission_splits ADD COLUMN IF NOT EXISTS match_deal_id text;

-- ════════════════════════════════════════════════════
-- 2. FUNCTION: generate_cm_match_id — espelha generate_cm_numero_interno()
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_cm_match_id(
  p_date date DEFAULT CURRENT_DATE
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_prefix   text;
  v_next_seq int;
  v_code     text;
BEGIN
  v_prefix := 'MATCH-' || TO_CHAR(p_date, 'YYYY') || '-';

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(match_deal_id FROM '\d{3}$') AS int)), 0
  ) + 1
  INTO v_next_seq
  FROM cm_bids
  WHERE match_deal_id LIKE v_prefix || '%';

  v_code := v_prefix || LPAD(v_next_seq::text, 3, '0');

  WHILE EXISTS (SELECT 1 FROM cm_bids WHERE match_deal_id = v_code) LOOP
    v_next_seq := v_next_seq + 1;
    v_code := v_prefix || LPAD(v_next_seq::text, 3, '0');
  END LOOP;

  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION generate_cm_match_id(date) IS 'Gera o codigo legivel MATCH-YYYY-NNN no aceite de um bid da Bolsa de Capitais, sequencial por ano. Espelha generate_cm_numero_interno().';

-- ════════════════════════════════════════════════════
-- 3. GUARD: operation_contracts nunca orfao (sem deal_id nem listing_id)
--    — escopado a capital_markets/ma. Verticais credito (usa
--    credit_proposal_id), institucional/clientes/talent_pool/colaboradores
--    (nenhum vinculo de deal/listing) NAO entram neste guard: auditoria em
--    app/api/contracts/generate/route.ts confirmou que essas verticais
--    legitimamente nao tem deal_id/listing_id.
-- ════════════════════════════════════════════════════
-- Auditoria em producao (2026-07-28) confirmou 0 linhas orfas em
-- capital_markets/ma — seguro adicionar o CHECK constraint escopado.

DO $$ BEGIN
  ALTER TABLE operation_contracts ADD CONSTRAINT chk_operation_contracts_vinculo
    CHECK (vertical NOT IN ('capital_markets', 'ma') OR deal_id IS NOT NULL OR listing_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
