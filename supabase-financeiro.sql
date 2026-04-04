-- ============================================================
-- V3 PARTNER — Tabela Financeiro
-- Execute no Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.financeiro_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,
  data       JSONB NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER financeiro_records_updated_at
  BEFORE UPDATE ON public.financeiro_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financeiro_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_select" ON public.financeiro_records
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));

CREATE POLICY "fin_insert" ON public.financeiro_records
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));

CREATE POLICY "fin_update" ON public.financeiro_records
  FOR UPDATE USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));

CREATE POLICY "fin_delete" ON public.financeiro_records
  FOR DELETE USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO'));

CREATE INDEX IF NOT EXISTS idx_fin_type ON public.financeiro_records(type);
