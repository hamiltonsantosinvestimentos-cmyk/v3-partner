-- =============================================================================
-- QUALIFICACAO ANTECIPADA VINCULADA A MINUTA (SINGLE-USE)
-- =============================================================================
--
-- CONTEXTO
--   Diretriz de Joao (02/09/2026, P1): o BackOffice precisa adiantar a
--   coleta de KYC enquanto o Juridico ainda revisa a minuta, sem esperar o
--   contrato ser gerado. A qualificacao nasce atrelada a MINUTA
--   (contract_templates), nao a um contrato/listing ja existente.
--
-- ACHADO-CHAVE (evita redesenhar o mecanismo de heranca de dados)
--   POST /api/contracts/generate JA aceita qualification_batch_id e ja
--   puxa os dados do lote pra montar variaveis e o bloco de prosa juridica
--   -- esse mecanismo nao muda. So falta a origem "vinculado a minuta" e a
--   busca automatica na hora de gerar.
--
-- DECISAO DE NEGOCIO (Opcao A, confirmada por Joao): minutas sao
--   reutilizaveis para multiplas operacoes/clientes distintos neste
--   modelo de negocio (M&A e Estruturacao). Um lote antecipado e
--   estritamente single-use -- risco real de vazamento de dado entre
--   deals diferentes (LGPD, sigilo de parceiros) se ficasse reaproveitavel
--   (Opcao B, descartada). `consumido_por_contract_id` marca o lote como
--   gasto assim que o primeiro contrato o consome; o proximo contrato
--   gerado pela mesma minuta nasce limpo, exigindo nova qualificacao.
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 2 colunas novas, nullable, em cm_qualification_batches.
--   Nenhum lote historico afetado (template_id/consumido_por_contract_id
--   ficam NULL para todos os lotes existentes).
-- =============================================================================

alter table public.cm_qualification_batches
  add column if not exists template_id uuid references public.contract_templates(id),
  add column if not exists consumido_por_contract_id uuid references public.operation_contracts(id);

comment on column public.cm_qualification_batches.template_id is
  'Qualificação antecipada (02/09/2026): lote criado a partir da tela de Minuta, antes de qualquer contrato existir. Nullable -- lotes antigos (listing_id/operation_contract_id/demand_id) continuam sem isso.';
comment on column public.cm_qualification_batches.consumido_por_contract_id is
  'Single-use (decisão de negócio de João, 02/09/2026): assim que um contrato herda os dados deste lote (POST /api/contracts/generate), este campo é gravado e o lote nunca mais é reutilizado por outro contrato da mesma minuta -- evita vazamento de dado (CPF/RG/endereço) de um cliente/deal para outro.';
