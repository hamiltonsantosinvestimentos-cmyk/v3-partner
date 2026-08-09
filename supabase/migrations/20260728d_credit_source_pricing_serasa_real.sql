ALTER TABLE credit_source_pricing ADD COLUMN IF NOT EXISTS report_name TEXT;

COMMENT ON COLUMN credit_source_pricing.report_name IS 'reportName tecnico usado na chamada a API da Serasa, ex RELATORIO_AVANCADO_PJ_PME.';

INSERT INTO credit_source_pricing (source, modalidade, tipo_titular, produto_nome, report_name, valor_tabela, valor_unitario_final, status, vigente_desde, observacoes) SELECT 'serasa', 'avancada', 'PJ', 'Relatorio Avancado PJ PME', 'RELATORIO_AVANCADO_PJ_PME', 28.90, 28.90, 'contratado', '2026-07-21', 'SKU exato da tabela oficial, cod 6660.' WHERE NOT EXISTS (SELECT 1 FROM credit_source_pricing WHERE report_name = 'RELATORIO_AVANCADO_PJ_PME');

INSERT INTO credit_source_pricing (source, modalidade, tipo_titular, produto_nome, report_name, valor_tabela, valor_unitario_final, status, vigente_desde, observacoes) SELECT 'serasa', 'simples', 'PJ', 'Serasa Relatorio Basico PJ', 'RELATORIO_BASICO_PJ_PME', 8.98, 8.98, 'contratado', '2026-07-21', 'Mapeamento por nome mais proximo, cod 5229, confirmar com a Serasa.' WHERE NOT EXISTS (SELECT 1 FROM credit_source_pricing WHERE report_name = 'RELATORIO_BASICO_PJ_PME');

INSERT INTO credit_source_pricing (source, modalidade, tipo_titular, produto_nome, report_name, valor_tabela, valor_unitario_final, status, vigente_desde, observacoes) SELECT 'serasa', 'avancada', 'PF', 'Serasa Relatorio Avancado PF', 'RELATORIO_AVANCADO_TOP_SCORE_PF_PME', 18.76, 18.76, 'contratado', '2026-07-21', 'Mapeamento por nome mais proximo, cod 5280, confirmar com a Serasa.' WHERE NOT EXISTS (SELECT 1 FROM credit_source_pricing WHERE report_name = 'RELATORIO_AVANCADO_TOP_SCORE_PF_PME');

INSERT INTO credit_source_pricing (source, modalidade, tipo_titular, produto_nome, report_name, valor_tabela, valor_unitario_final, status, vigente_desde, observacoes) SELECT 'serasa', 'simples', 'PF', 'Serasa Relatorio Basico PF', 'RELATORIO_BASICO_PF_PME', 8.88, 8.88, 'contratado', '2026-07-21', 'Mapeamento por nome mais proximo, cod 5228, confirmar com a Serasa.' WHERE NOT EXISTS (SELECT 1 FROM credit_source_pricing WHERE report_name = 'RELATORIO_BASICO_PF_PME');
