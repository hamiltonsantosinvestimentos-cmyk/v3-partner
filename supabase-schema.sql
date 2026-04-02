-- ============================================================
-- V3 PARTNER — Schema SQL Completo para Supabase
-- Execute este SQL no painel Supabase > SQL Editor
-- ============================================================

-- Tipos/Enums
CREATE TYPE user_role AS ENUM ('ADMIN', 'PARTNER', 'PARTNER_PRO', 'MESA_OPERACIONAL', 'GESTAO', 'FINANCEIRO');
CREATE TYPE operation_status AS ENUM ('DRAFT', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE deal_stage AS ENUM ('PROSPECTING', 'QUALIFICATION', 'DUE_DILIGENCE', 'NEGOTIATION', 'CLOSING', 'CLOSED_WON', 'CLOSED_LOST');
CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE credit_desk_level AS ENUM ('NIVEL_1', 'NIVEL_2', 'NIVEL_3');

-- ============================================================
-- Função: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: profiles (estende auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          user_role NOT NULL DEFAULT 'PARTNER',
  phone         TEXT,
  document_cpf  TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES public.profiles(id),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: sincroniza novo usuário do Supabase Auth -> profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE: split_fiscal
-- ============================================================
CREATE TABLE public.split_fiscal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  partner_id      UUID REFERENCES public.profiles(id),
  created_by      UUID REFERENCES public.profiles(id) NOT NULL,
  total_value     NUMERIC(15,2) NOT NULL,
  split_percent   NUMERIC(5,2),
  partner_revenue NUMERIC(15,2),
  status          operation_status NOT NULL DEFAULT 'DRAFT',
  due_date        DATE,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES public.profiles(id),
  notes           TEXT,
  attachments     JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER split_fiscal_updated_at
  BEFORE UPDATE ON public.split_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE: ma_deals
-- ============================================================
CREATE TABLE public.ma_deals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  buyer_name          TEXT,
  seller_name         TEXT,
  target_company      TEXT NOT NULL,
  sector              TEXT,
  deal_value          NUMERIC(15,2),
  ebitda_multiple     NUMERIC(5,2),
  revenue_ttm         NUMERIC(15,2),
  ebitda_ttm          NUMERIC(15,2),
  stage               deal_stage NOT NULL DEFAULT 'PROSPECTING',
  probability_percent INT DEFAULT 0,
  expected_close_date DATE,
  assigned_to         UUID REFERENCES public.profiles(id),
  created_by          UUID REFERENCES public.profiles(id) NOT NULL,
  status              operation_status NOT NULL DEFAULT 'DRAFT',
  documents           JSONB DEFAULT '[]',
  tags                TEXT[] DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER ma_deals_updated_at
  BEFORE UPDATE ON public.ma_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ma_deal_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID REFERENCES public.ma_deals(id) ON DELETE CASCADE,
  from_stage deal_stage,
  to_stage   deal_stage NOT NULL,
  notes      TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: operational_tickets
-- ============================================================
CREATE TABLE public.operational_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL,
  priority      ticket_priority NOT NULL DEFAULT 'MEDIUM',
  requester_id  UUID REFERENCES public.profiles(id) NOT NULL,
  assigned_to   UUID REFERENCES public.profiles(id),
  status        operation_status NOT NULL DEFAULT 'PENDING',
  resolved_at   TIMESTAMPTZ,
  resolution    TEXT,
  attachments   JSONB DEFAULT '[]',
  tags          TEXT[] DEFAULT '{}',
  due_date      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER operational_tickets_updated_at
  BEFORE UPDATE ON public.operational_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ticket_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID REFERENCES public.operational_tickets(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES public.profiles(id) NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: credit_desk_proposals (Mesa de Crédito — 3 Níveis)
-- Nível 1: Crédito Varejo (Home Equity, Aval)
-- Nível 2: Crédito Estruturado (FIDC, CRI, CRA, Debêntures)
-- Nível 3: High Ticket (operações a partir de R$ 5.000.000)
-- ============================================================
CREATE TABLE public.credit_desk_proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  client_name         TEXT NOT NULL,
  client_cpf_cnpj     TEXT,
  credit_line         TEXT NOT NULL,
  requested_value     NUMERIC(15,2) NOT NULL,
  approved_value      NUMERIC(15,2),
  current_level       credit_desk_level NOT NULL DEFAULT 'NIVEL_1',
  status              operation_status NOT NULL DEFAULT 'PENDING',
  partner_id          UUID REFERENCES public.profiles(id),
  level1_analyst_id   UUID REFERENCES public.profiles(id),
  level2_analyst_id   UUID REFERENCES public.profiles(id),
  level3_approver_id  UUID REFERENCES public.profiles(id),
  level1_notes        TEXT,
  level2_notes        TEXT,
  level3_notes        TEXT,
  level1_at           TIMESTAMPTZ,
  level2_at           TIMESTAMPTZ,
  level3_at           TIMESTAMPTZ,
  documents           JSONB DEFAULT '[]',
  created_by          UUID REFERENCES public.profiles(id) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER credit_desk_proposals_updated_at
  BEFORE UPDATE ON public.credit_desk_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Restrição: High Ticket mínimo R$ 5.000.000
ALTER TABLE public.credit_desk_proposals
  ADD CONSTRAINT check_high_ticket_min_value
  CHECK (
    current_level != 'NIVEL_3' OR requested_value >= 5000000
  );

-- ============================================================
-- TABLE: ai_conversations
-- ============================================================
CREATE TABLE public.ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT NOT NULL DEFAULT 'info',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_deal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_desk_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper: pega o role do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ---- Policies: profiles ----
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (public.get_user_role() = 'ADMIN');
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.get_user_role() = 'ADMIN');

-- ---- Policies: split_fiscal ----
CREATE POLICY "split_select" ON public.split_fiscal
  FOR SELECT USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
  );
CREATE POLICY "split_insert" ON public.split_fiscal
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "split_update" ON public.split_fiscal
  FOR UPDATE USING (
    public.get_user_role() IN ('ADMIN', 'GESTAO')
    OR created_by = auth.uid()
  );

-- ---- Policies: ma_deals ----
CREATE POLICY "ma_select" ON public.ma_deals
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ma_insert" ON public.ma_deals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ma_update" ON public.ma_deals
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO')
  );

-- ---- Policies: operational_tickets ----
CREATE POLICY "tickets_select" ON public.operational_tickets
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_insert" ON public.operational_tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_update" ON public.operational_tickets
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR requester_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'MESA_OPERACIONAL', 'GESTAO')
  );

-- ---- Policies: credit_desk_proposals ----
CREATE POLICY "credit_select_partner" ON public.credit_desk_proposals
  FOR SELECT USING (
    partner_id = auth.uid()
    OR public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
  );
CREATE POLICY "credit_insert" ON public.credit_desk_proposals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "credit_update" ON public.credit_desk_proposals
  FOR UPDATE USING (
    public.get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
  );

-- ---- Policies: ai_conversations ----
CREATE POLICY "ai_conv_own" ON public.ai_conversations
  FOR ALL USING (user_id = auth.uid());

-- ---- Policies: notifications ----
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_split_fiscal_partner ON public.split_fiscal(partner_id);
CREATE INDEX idx_split_fiscal_status ON public.split_fiscal(status);
CREATE INDEX idx_ma_deals_stage ON public.ma_deals(stage);
CREATE INDEX idx_ma_deals_assigned ON public.ma_deals(assigned_to);
CREATE INDEX idx_tickets_status ON public.operational_tickets(status);
CREATE INDEX idx_tickets_assigned ON public.operational_tickets(assigned_to);
CREATE INDEX idx_credit_level ON public.credit_desk_proposals(current_level);
CREATE INDEX idx_credit_status ON public.credit_desk_proposals(status);
CREATE INDEX idx_credit_partner ON public.credit_desk_proposals(partner_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);
CREATE INDEX idx_ai_conv_user ON public.ai_conversations(user_id);

-- ============================================================
-- DADOS INICIAIS: criar usuário admin
-- ============================================================
-- ATENÇÃO: Execute depois de criar o usuário admin no Supabase Auth
-- Substitua 'SEU_USER_ID_AQUI' pelo UUID do usuário admin
-- UPDATE public.profiles SET role = 'ADMIN' WHERE id = 'SEU_USER_ID_AQUI';
