-- ============================================================
-- V3 PARTNER — Colunas faltantes em credit_desk_proposals
-- Execute no Supabase > SQL Editor
-- ============================================================

ALTER TABLE public.credit_desk_proposals
  ADD COLUMN IF NOT EXISTS stage                   TEXT NOT NULL DEFAULT 'RECEBIDO',
  ADD COLUMN IF NOT EXISTS metadata                JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS valor_credito_atual     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS comissao_mandato_perc   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS comissao_instituicao_perc NUMERIC(5,2);
