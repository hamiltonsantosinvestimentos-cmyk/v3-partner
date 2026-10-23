-- ============================================================
-- MIGRATION: cm_party_qualifications.role_in_document -- partner_externo e interveniente_anuente
-- Date: 2026-10-23
-- Contexto: NCNDA do Projeto Roda Gigante (V3C-NDA-2026-0056). A GIROO X entra como
-- Partner Externo (parceiro estrategico, sem login nem plano na plataforma) e um socio
-- dela como Interveniente Anuente (comparece para se obrigar pessoalmente ao sigilo e a
-- nao circunvencao). Ate hoje nenhum dos dois papeis existia no dicionario nem no CHECK.
-- BRIEF: 06_Operacional/SOPs/2026-10-23_Operacional_BRIEF-Papeis-Partner-Externo-e-Interveniente-Anuente_v1.html
-- (QA de governanca liberado na rodada 3).
-- So amplia a lista aceita: nenhum valor existente sai, nenhuma coluna nova.
-- ============================================================

ALTER TABLE cm_party_qualifications DROP CONSTRAINT IF EXISTS cm_party_qualifications_role_in_document_check;
ALTER TABLE cm_party_qualifications ADD CONSTRAINT cm_party_qualifications_role_in_document_check
  CHECK (role_in_document = ANY (ARRAY[
    'parte_principal', 'intermediario_finder_venda', 'intermediario_finder_compra',
    'mandatario', 'testemunha', 'finder_originacao_venda', 'finder_originacao_compra',
    'intermediario_venda', 'intermediario_compra', 'estruturador', 'head_mesa', 'partner',
    'mandatario_1', 'mandatario_2',
    'intermediario_1', 'intermediario_2', 'intermediario_3', 'intermediario_4', 'intermediario_5',
    'intermediario_6', 'intermediario_7', 'intermediario_8', 'intermediario_9', 'intermediario_10',
    'partner_externo', 'interveniente_anuente'
  ]));
