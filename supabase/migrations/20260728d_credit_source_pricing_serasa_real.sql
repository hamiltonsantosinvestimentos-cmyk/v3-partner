-- Precos reais Serasa (PF/PJ, Avancado/Basico) a partir da tabela oficial do contrato PIBGO005802026
-- Fonte: 02_Financeiro/Fornecedores/Serasa/2026-07-28_Financeiro_TabelaPrecos-Serasa-Contrato-PIBGO005802026.pdf
-- Data Base da tabela: 21/07/2026. Escopo Agro fora desta rodada, API ainda nao existe (confirmado por Joao em 28/07/2026).

ALTER TABLE credit_source_pricing ADD COLUMN IF NOT EXISTS report_name TEXT;

COMMENT ON COLUMN credit_source_pricing.report_name IS 'reportName literal usado na chamada a API da Serasa, ex: RELATORIO_AVANCADO_PJ_PME. Permite achar o preco exato do relatorio realmente consultado, sem depender so de modalidade e tipo_titular, que podem repetir entre produtos comerciais diferentes.';

INSERT INTO credit_source_pricing
  (source, modalidade, tipo_titular, produto_nome, report_name, valor_tabela, valor_unitario_final, status, vigente_desde, observacoes)
SELECT * FROM (VALUES
  ('serasa', 'avancada', 'PJ', 'Relatorio Avancado PJ PME', 'RELATORIO_AVANCADO_PJ_PME', 28.90::numeric, 28.90::numeric, 'contratado', '2026-07-21'::date,
    'SKU exato da tabela oficial do contrato, cod 6660, RELATORIO AVANCADO PJ PME. Corresponde ao reportName tecnico ja usado no no Serasa do W-CREDIT.'),
  ('serasa', 'simples', 'PJ', 'Serasa Relatorio Basico PJ', 'RELATORIO_BASICO_PJ_PME', 8.98::numeric, 8.98::numeric, 'contratado', '2026-07-21'::date,
    'Mapeamento por nome mais proximo da tabela oficial, cod 5229, SERASA RELATORIO BASICO PJ. Nao existe SKU literal RELATORIO BASICO PJ PME na tabela. Confirmar com a Serasa se este preco corresponde exatamente ao reportName tecnico RELATORIO_BASICO_PJ_PME antes de tratar como definitivo.'),
  ('serasa', 'avancada', 'PF', 'Serasa Relatorio Avancado PF', 'RELATORIO_AVANCADO_TOP_SCORE_PF_PME', 18.76::numeric, 18.76::numeric, 'contratado', '2026-07-21'::date,
    'Mapeamento por nome mais proximo da tabela oficial, cod 5280, SERASA RELATORIO AVANCADO PF. reportName tecnico e RELATORIO_AVANCADO_TOP_SCORE_PF_PME, nome comercial nao bate literal. Confirmar com a Serasa antes de tratar como definitivo.'),
  ('serasa', 'simples', 'PF', 'Serasa Relatorio Basico PF', 'RELATORIO_BASICO_PF_PME', 8.88::numeric, 8.88::numeric, 'contratado', '2026-07-21'::date,
    'Mapeamento por nome mais proximo da tabela oficial, cod 5228, SERASA RELATORIO BASICO PF. reportName tecnico e RELATORIO_BASICO_PF_PME. Confirmar com a Serasa antes de tratar como definitivo.')
) AS v(source, modalidade, tipo_titular, produto_nome, report_name, valor_tabela, valor_unitario_final, status, vigente_desde, observacoes)
WHERE NOT EXISTS (
  SELECT 1 FROM credit_source_pricing csp
  WHERE csp.source = v.source AND csp.report_name = v.report_name
);

-- Nota operacional: a tabela oficial do contrato PIBGO005802026 tem CONSUMO MINIMO de
-- R$1.020,00/mes, fixo, independente de volume de consultas. Nao persistido em linha
-- propria aqui (nao se encaixa no formato por relatorio/unidade desta tabela); registrado
-- em cofre-credenciais-v3.md (Secao 12) e no wiki de correspondencia Serasa.

-- Escopo Agro (AGRO SCORE, AGRO CONSULTA PRODUTOR, DADOS DE CREDITO AGRO etc) aparece na
-- tabela oficial sob o mesmo contrato PME V7, mas nao foi cadastrado nesta migration: API
-- de Agro ainda nao existe (confirmado por Joao em 28/07/2026), sem consumidor de codigo
-- para esses reportNames hoje. Cadastrar quando a integracao Agro for de fato implementada.

-- Rollback:
-- DELETE FROM credit_source_pricing WHERE report_name IN
--   ('RELATORIO_AVANCADO_PJ_PME','RELATORIO_BASICO_PJ_PME','RELATORIO_AVANCADO_TOP_SCORE_PF_PME','RELATORIO_BASICO_PF_PME');
-- ALTER TABLE credit_source_pricing DROP COLUMN IF EXISTS report_name;
