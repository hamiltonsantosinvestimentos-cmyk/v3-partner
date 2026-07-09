-- ============================================================
-- MIGRATION: Vincula NDA real do Deal Room ao operation_contracts — v1.7.1
-- Date: 2026-07-09
-- Scope: liga o aceite de NDA da Bolsa de Ativos ao documento juridico
--        real gerado pela Central de Contratos, em vez de um texto generico
--        hardcoded no componente. Fecha risco de quebra de contrato.
-- Rollback:
--   ALTER TABLE cm_deal_room_access DROP COLUMN IF EXISTS nda_contract_id;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS deal_room_access_id;
-- ============================================================

ALTER TABLE operation_contracts
  ADD COLUMN IF NOT EXISTS deal_room_access_id uuid REFERENCES cm_deal_room_access(id);

ALTER TABLE cm_deal_room_access
  ADD COLUMN IF NOT EXISTS nda_contract_id uuid REFERENCES operation_contracts(id);

COMMENT ON COLUMN operation_contracts.deal_room_access_id IS 'Preenchido quando o contrato e o NDA real aceito via clickwrap na Deal Room (nao passa pelo fluxo de aprovacao de socios — o proprio aceite com hash+IP e a assinatura).';
COMMENT ON COLUMN cm_deal_room_access.nda_contract_id IS 'Referencia ao operation_contracts gerado a partir do template real (vertical capital_markets) no momento do aceite do NDA.';
