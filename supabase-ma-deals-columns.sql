-- ============================================================
-- MIGRAÇÃO: Adiciona colunas faltantes em ma_deals
-- Execute no Supabase > SQL Editor
-- ============================================================

-- 1. Adiciona colunas que faltam na tabela ma_deals
ALTER TABLE public.ma_deals
  ADD COLUMN IF NOT EXISTS asset_data  JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS comments    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS location    TEXT;

-- 2. Adiciona valores que faltam no enum deal_stage
--    (IOI = Indicação de Interesse, PROPOSAL = Proposta/Estruturação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'IOI'
      AND enumtypid = 'public.deal_stage'::regtype
  ) THEN
    ALTER TYPE public.deal_stage ADD VALUE 'IOI' AFTER 'QUALIFICATION';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PROPOSAL'
      AND enumtypid = 'public.deal_stage'::regtype
  ) THEN
    ALTER TYPE public.deal_stage ADD VALUE 'PROPOSAL' AFTER 'IOI';
  END IF;
END $$;

-- 3. Garante que crm_leads tem a coluna metadata (caso não tenha sido executado antes)
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Confirmação
SELECT 'Migração concluída com sucesso!' AS status;
