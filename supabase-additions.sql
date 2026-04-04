-- ============================================================
-- V3 PARTNER — Adições ao Schema
-- Execute no Supabase > SQL Editor
-- ============================================================

-- ============================================================
-- TABLE: crm_leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  document         TEXT,
  person_type      TEXT NOT NULL DEFAULT 'PJ',
  email            TEXT,
  phone            TEXT,
  segment          TEXT,
  annual_revenue   NUMERIC(15,2) DEFAULT 0,
  city             TEXT,
  state            TEXT,
  status           TEXT NOT NULL DEFAULT 'prospect',
  source           TEXT NOT NULL DEFAULT 'ativo',
  visit_date       DATE,
  next_contact     DATE,
  notes            TEXT,
  converted_to     TEXT DEFAULT '',
  converted_at     DATE,
  product_interest TEXT,
  credit_line      TEXT,
  interactions     JSONB DEFAULT '[]',
  partner_id       UUID REFERENCES public.profiles(id),
  partner_name     TEXT,
  created_by       UUID REFERENCES public.profiles(id) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- Partners vêem somente seus próprios leads; admins vêem todos
CREATE POLICY "crm_select" ON public.crm_leads
  FOR SELECT USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
  );

CREATE POLICY "crm_insert" ON public.crm_leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "crm_update" ON public.crm_leads
  FOR UPDATE USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO')
  );

-- Somente ADMIN pode deletar leads
CREATE POLICY "crm_delete_admin" ON public.crm_leads
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

CREATE INDEX idx_crm_leads_partner ON public.crm_leads(partner_id);
CREATE INDEX idx_crm_leads_status  ON public.crm_leads(status);

-- ============================================================
-- POLICIES DE DELETE — somente ADMIN
-- (ma_deals, credit_desk_proposals, operational_tickets)
-- ============================================================

-- ma_deals: somente admin pode deletar
DROP POLICY IF EXISTS "ma_delete_admin" ON public.ma_deals;
CREATE POLICY "ma_delete_admin" ON public.ma_deals
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

-- credit_desk_proposals: somente admin pode deletar
DROP POLICY IF EXISTS "credit_delete_admin" ON public.credit_desk_proposals;
CREATE POLICY "credit_delete_admin" ON public.credit_desk_proposals
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

-- operational_tickets: somente admin pode deletar
DROP POLICY IF EXISTS "tickets_delete_admin" ON public.operational_tickets;
CREATE POLICY "tickets_delete_admin" ON public.operational_tickets
  FOR DELETE USING (public.get_user_role() = 'ADMIN');

-- ============================================================
-- TABLE: financeiro_records (armazena dados do módulo Financeiro)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financeiro_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,  -- 'funcionario' | 'despesa_fixa' | 'despesa_variavel' | 'imposto'
  data       JSONB NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER financeiro_records_updated_at
  BEFORE UPDATE ON public.financeiro_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financeiro_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_select_admin" ON public.financeiro_records
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));

CREATE POLICY "fin_insert_admin" ON public.financeiro_records
  FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));

CREATE POLICY "fin_update_admin" ON public.financeiro_records
  FOR UPDATE USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO', 'GESTAO'));

CREATE POLICY "fin_delete_admin" ON public.financeiro_records
  FOR DELETE USING (public.get_user_role() IN ('ADMIN', 'FINANCEIRO'));

CREATE INDEX idx_fin_type ON public.financeiro_records(type);
