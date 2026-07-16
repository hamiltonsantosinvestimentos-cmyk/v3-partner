-- Adiciona IPI e ICMS ao enum cm_asset_type (limpeza de portfolio Mesa Operacional 2026-07-15)
-- CGI/CRI/FIDC permanecem no enum (Postgres nao suporta DROP VALUE), bloqueio de uso
-- para novos cadastros fica na validacao da API (/api/cm/listings POST) e no filtro do frontend.
-- Aplicado em producao via MCP em 2026-07-15
ALTER TYPE cm_asset_type ADD VALUE IF NOT EXISTS 'ipi';
ALTER TYPE cm_asset_type ADD VALUE IF NOT EXISTS 'icms';
