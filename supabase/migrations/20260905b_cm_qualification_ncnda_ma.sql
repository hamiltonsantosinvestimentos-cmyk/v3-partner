-- ============================================================
-- MIGRATION: document_type 'ncnda_ma' em cm_qualification_batches
-- Date: 2026-09-05
-- Scope: aditiva, DROP/ADD CONSTRAINT com o mesmo conjunto de valores + 1
--        novo, mesmo padrao ja usado 3 vezes neste projeto.
--
-- Contexto: BRIEF aprovado por Joao em 05/09/2026 ("Fase de Qualificacao
-- NCNDA na Mesa M&A"), arquivo
-- 2026-09-05_Operacional_BRIEF-Qualificacao-NCNDA-Mesa-MA-Central-Contratos_v1.html.
-- 'ncnda_ma' identifica o NCNDA emitido a partir do deal da Mesa M&A
-- (vertical='ma' em contract_templates/operation_contracts), tratado como
-- documento distinto de 'nda_quadripartite' (Bolsa de Ativos/Credito) para
-- rotulagem e futura filtragem, embora o texto legal reaproveite o NCNDA ja
-- aprovado da Mesa de Ativos (autorizacao explicita de Joao, mesma sessao).
-- ============================================================

ALTER TABLE cm_qualification_batches DROP CONSTRAINT IF EXISTS cm_qualification_batches_document_type_check;
ALTER TABLE cm_qualification_batches ADD CONSTRAINT cm_qualification_batches_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'nda_quadripartite'::text,
    'fpa_venda'::text,
    'fpa_compra'::text,
    'mandato'::text,
    'contrato_final'::text,
    'contrato_parceria'::text,
    'ncnda_ma'::text
  ]));

COMMENT ON COLUMN cm_qualification_batches.document_type IS
  'Tipo de instrumento do lote de qualificacao. ncnda_ma (05/09/2026): NCNDA da Mesa M&A, gerado via botao "Solicitar NCNDA" no deal, vertical=''ma''.';
