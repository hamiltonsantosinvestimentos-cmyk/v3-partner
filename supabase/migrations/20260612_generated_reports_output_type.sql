-- Distingue relatórios HTML (CCR/export) de mapas mentais (agente Mapa Mental)
-- gerados via generated_reports, sem criar nova tabela.
alter table generated_reports
  add column if not exists output_type text not null default 'report';

comment on column generated_reports.output_type is
  'Tipo de artefato: report (relatorio HTML padrao) | mindmap (mapa mental markmap)';
