-- ============================================================
-- MIGRATION: Classe de ativo "imovel" no enum cm_asset_type
-- Date: 2026-07-11
-- Scope: Fase 1 da Bolsa de Grandes Ativos Imobiliarios e Alternativos,
--        acoplada a Mesa M&A. Aplicada em producao via
--        mcp__plugin_supabase_supabase__apply_migration.
-- Rollback: valores de enum nao podem ser removidos em Postgres sem
--           recriar o tipo inteiro — se for preciso reverter, criar
--           cm_asset_type_v2 sem 'imovel' e migrar as colunas.
-- ============================================================

-- ADD VALUE roda isolado em sua propria transacao: o novo valor nao pode
-- ser referenciado (em CASE, WHERE, etc.) na mesma transacao em que foi criado.
ALTER TYPE cm_asset_type ADD VALUE IF NOT EXISTS 'imovel';
