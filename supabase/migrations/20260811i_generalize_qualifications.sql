-- Generaliza a esteira de qualificacao de partes (nascida pra Bolsa de
-- Ativos, 28/07) para qualquer contrato da Central de Contratos. O papel
-- 'testemunha' ja existia desde a criacao original, so nunca foi usado fora
-- da Bolsa de Ativos porque o vinculo era travado em listing_id.

alter table cm_qualification_batches
  add column if not exists operation_contract_id uuid references operation_contracts(id) on delete cascade;

alter table cm_qualification_batches drop constraint if exists cm_qualification_batches_document_type_check;
alter table cm_qualification_batches add constraint cm_qualification_batches_document_type_check
  check (document_type in ('nda_quadripartite','fpa_venda','fpa_compra','mandato','contrato_final','contrato_parceria'));

create index if not exists idx_cm_qual_batches_operation_contract on cm_qualification_batches(operation_contract_id);
