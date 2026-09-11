-- ============================================================
-- MIGRATION: cm_party_qualifications.role_in_document -- intermediario_3 a 10
-- Date: 2026-09-11
-- Contexto: Joao pediu ate 10 intermediarios na qualificacao antecipada;
-- ROLE_LABELS/CHECK so tinham intermediario_1/intermediario_2 (herdado do
-- desenho original do NCNDA Mestre, 03/09/2026, quando 2 bastava). O motor
-- de prosa (party_qualifications_block) ja e dinamico por parte -- o cap
-- de 2 era so do dicionario + deste constraint, nunca do template em si.
-- ============================================================

ALTER TABLE cm_party_qualifications DROP CONSTRAINT IF EXISTS cm_party_qualifications_role_in_document_check;
ALTER TABLE cm_party_qualifications ADD CONSTRAINT cm_party_qualifications_role_in_document_check
  CHECK (role_in_document = ANY (ARRAY[
    'parte_principal', 'intermediario_finder_venda', 'intermediario_finder_compra',
    'mandatario', 'testemunha', 'finder_originacao_venda', 'finder_originacao_compra',
    'intermediario_venda', 'intermediario_compra', 'estruturador', 'head_mesa', 'partner',
    'mandatario_1', 'mandatario_2',
    'intermediario_1', 'intermediario_2', 'intermediario_3', 'intermediario_4', 'intermediario_5',
    'intermediario_6', 'intermediario_7', 'intermediario_8', 'intermediario_9', 'intermediario_10'
  ]));
