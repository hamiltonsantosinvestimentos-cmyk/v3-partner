-- Migration: adiciona coluna metadata em crm_leads
-- Necessário para o Bridge M&A ↔ CRM funcionar (ma_deal_id linkagem)
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Índice GIN para queries .contains("metadata", {...}) do Bridge
CREATE INDEX IF NOT EXISTS idx_crm_leads_metadata
  ON public.crm_leads USING GIN (metadata);
