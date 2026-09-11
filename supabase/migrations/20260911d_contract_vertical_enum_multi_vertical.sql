-- ============================================================
-- MIGRATION: contract_vertical enum -- adiciona multi_vertical
-- Date: 2026-09-11
-- Contexto: P0 real achado testando o NDA Multi-Vertical (PR #118) ao vivo
-- em producao -- contract_templates.vertical e um ENUM real
-- (contract_vertical), nao texto livre. A checagem anterior so olhou
-- pg_constraint (CHECK constraints) e nao pegou isso, entao o codigo foi
-- deployado achando que "multi_vertical" seria aceito sem migration. Sem
-- este ALTER, toda tentativa de salvar/criar minuta com essa vertical
-- falha com 22P02 (invalid input value for enum).
-- ============================================================

ALTER TYPE contract_vertical ADD VALUE IF NOT EXISTS 'multi_vertical';
