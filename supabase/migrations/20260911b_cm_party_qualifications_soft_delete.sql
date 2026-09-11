-- ============================================================
-- MIGRATION: cm_party_qualifications soft delete individual
-- Date: 2026-09-11
-- Contexto: Joao reportou que a minuta "NCNDA V3 PARTNERS MODELO DR LUIS
-- 2026-09-03" segue mostrando 3 envolvidos de qualificacao antecipada
-- (Iuri Nathan Dalvi, Icaro Vinicius Celestino, Planeta Carbono) que nao
-- deveriam mais estar ali, e nao existia nenhum jeito de excluir um
-- envolvido individualmente -- nem botao na tela, nem rota DELETE. Pedido
-- explicito: link de exclusao individual (nao o lote inteiro), reutilizavel,
-- porque esse tipo de dado errado/obsoleto pode se repetir com frequencia.
--
-- Soft delete (nunca hard delete) -- mesmo padrao ja usado em
-- operation_contracts/ma_deals/crm_leads/operational_tickets este mes.
-- ============================================================

ALTER TABLE cm_party_qualifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE cm_party_qualifications ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

COMMENT ON COLUMN cm_party_qualifications.deleted_at IS
  'Soft delete individual de um envolvido de qualificacao antecipada -- DELETE /api/cm/qualifications/party/[id]. Toda leitura ativa (listagem, geracao de contrato, calculo de lote completo) filtra deleted_at IS NULL. Bloqueado pela rota quando o lote ja foi consumido por um contrato real (consumido_por_contract_id NOT NULL).';
