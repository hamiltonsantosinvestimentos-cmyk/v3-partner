-- ============================================================
-- SECURITY FIX: Habilitar RLS em todas as tabelas públicas
-- Gerado em 2026-05-27 em resposta ao alerta de segurança Supabase
-- Garante que NENHUMA tabela fique exposta sem Row Level Security
-- ============================================================

-- Função auxiliar para verificar role (já existe, mas garantindo)
-- get_user_role() já definida nas migrations anteriores

-- ── 1. CHAT ──────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='authenticated read chat') THEN
    CREATE POLICY "authenticated read chat" ON public.chat_messages
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='authenticated write chat') THEN
    CREATE POLICY "authenticated write chat" ON public.chat_messages
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='admin manage chat') THEN
    CREATE POLICY "admin manage chat" ON public.chat_messages
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.team_chat_rooms ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_chat_rooms' AND policyname='authenticated read rooms') THEN
    CREATE POLICY "authenticated read rooms" ON public.team_chat_rooms
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_chat_rooms' AND policyname='admin manage rooms') THEN
    CREATE POLICY "admin manage rooms" ON public.team_chat_rooms
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.team_chat_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_chat_messages' AND policyname='authenticated read team chat') THEN
    CREATE POLICY "authenticated read team chat" ON public.team_chat_messages
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_chat_messages' AND policyname='authenticated write team chat') THEN
    CREATE POLICY "authenticated write team chat" ON public.team_chat_messages
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_chat_messages' AND policyname='admin manage team chat') THEN
    CREATE POLICY "admin manage team chat" ON public.team_chat_messages
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO'));
  END IF;
END $$;

-- ── 2. PUSH SUBSCRIPTIONS ────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='user manages own push') THEN
    CREATE POLICY "user manages own push" ON public.push_subscriptions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. COMMISSIONS ───────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.commissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commissions' AND policyname='admin full commissions') THEN
    CREATE POLICY "admin full commissions" ON public.commissions
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','FINANCEIRO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commissions' AND policyname='partner reads own commissions') THEN
    CREATE POLICY "partner reads own commissions" ON public.commissions
      FOR SELECT USING (
        auth.uid() = user_id
        OR get_user_role() IN ('ADMIN','GESTAO','FINANCEIRO')
      );
  END IF;
END $$;

-- ── 4. PLATFORM SETTINGS ─────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_settings' AND policyname='authenticated read settings') THEN
    CREATE POLICY "authenticated read settings" ON public.platform_settings
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_settings' AND policyname='admin write settings') THEN
    CREATE POLICY "admin write settings" ON public.platform_settings
      FOR ALL USING (get_user_role() = 'ADMIN');
  END IF;
END $$;

-- ── 5. V3 PRINT STANDARDS ────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.v3_print_standards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='v3_print_standards' AND policyname='authenticated read print standards') THEN
    CREATE POLICY "authenticated read print standards" ON public.v3_print_standards
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='v3_print_standards' AND policyname='admin manage print standards') THEN
    CREATE POLICY "admin manage print standards" ON public.v3_print_standards
      FOR ALL USING (get_user_role() = 'ADMIN');
  END IF;
END $$;

-- ── 6. TABELAS DIVERSAS SEM RLS GARANTIDO ────────────────────────────────────

-- document_views (controle de quem viu documento)
ALTER TABLE IF EXISTS public.document_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_views' AND policyname='admin reads doc views') THEN
    CREATE POLICY "admin reads doc views" ON public.document_views
      FOR SELECT USING (get_user_role() IN ('ADMIN','GESTAO','MESA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_views' AND policyname='authenticated insert doc view') THEN
    CREATE POLICY "authenticated insert doc view" ON public.document_views
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- nda_signatures
ALTER TABLE IF EXISTS public.nda_signatures ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nda_signatures' AND policyname='admin manage nda') THEN
    CREATE POLICY "admin manage nda" ON public.nda_signatures
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nda_signatures' AND policyname='user reads own nda') THEN
    CREATE POLICY "user reads own nda" ON public.nda_signatures
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- privacy_consents
ALTER TABLE IF EXISTS public.privacy_consents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='privacy_consents' AND policyname='user manages own consent') THEN
    CREATE POLICY "user manages own consent" ON public.privacy_consents
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='privacy_consents' AND policyname='admin reads consents') THEN
    CREATE POLICY "admin reads consents" ON public.privacy_consents
      FOR SELECT USING (get_user_role() IN ('ADMIN','GESTAO'));
  END IF;
END $$;

-- meeting_action_items
ALTER TABLE IF EXISTS public.meeting_action_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_action_items' AND policyname='admin manage action items') THEN
    CREATE POLICY "admin manage action items" ON public.meeting_action_items
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_action_items' AND policyname='assigned user reads own items') THEN
    CREATE POLICY "assigned user reads own items" ON public.meeting_action_items
      FOR SELECT USING (auth.uid() = assigned_to OR get_user_role() IN ('ADMIN','GESTAO','MESA'));
  END IF;
END $$;

-- vdr_audit_trail
ALTER TABLE IF EXISTS public.vdr_audit_trail ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vdr_audit_trail' AND policyname='admin reads vdr audit') THEN
    CREATE POLICY "admin reads vdr audit" ON public.vdr_audit_trail
      FOR SELECT USING (get_user_role() IN ('ADMIN','GESTAO','MESA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vdr_audit_trail' AND policyname='service inserts vdr audit') THEN
    CREATE POLICY "service inserts vdr audit" ON public.vdr_audit_trail
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- vdr_blockchain_queue
ALTER TABLE IF EXISTS public.vdr_blockchain_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vdr_blockchain_queue' AND policyname='admin manage blockchain queue') THEN
    CREATE POLICY "admin manage blockchain queue" ON public.vdr_blockchain_queue
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO'));
  END IF;
END $$;

-- deal_sector_codes
ALTER TABLE IF EXISTS public.deal_sector_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_sector_codes' AND policyname='authenticated reads sector codes') THEN
    CREATE POLICY "authenticated reads sector codes" ON public.deal_sector_codes
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_sector_codes' AND policyname='admin manage sector codes') THEN
    CREATE POLICY "admin manage sector codes" ON public.deal_sector_codes
      FOR ALL USING (get_user_role() = 'ADMIN');
  END IF;
END $$;

-- ma_batch_reconciliations
ALTER TABLE IF EXISTS public.ma_batch_reconciliations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ma_batch_reconciliations' AND policyname='admin manage reconciliations') THEN
    CREATE POLICY "admin manage reconciliations" ON public.ma_batch_reconciliations
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO'));
  END IF;
END $$;

-- creative_files
ALTER TABLE IF EXISTS public.creative_files ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='creative_files' AND policyname='admin manage creative files') THEN
    CREATE POLICY "admin manage creative files" ON public.creative_files
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA'));
  END IF;
END $$;

-- creative_jobs
ALTER TABLE IF EXISTS public.creative_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='creative_jobs' AND policyname='admin manage creative jobs') THEN
    CREATE POLICY "admin manage creative jobs" ON public.creative_jobs
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA'));
  END IF;
END $$;

-- ── 7. SEGURANÇA EXTRA: bloquear acesso anônimo em tabelas críticas ───────────

-- Garante que anon NÃO consegue ler profiles, financeiro_records, audit_logs
-- (essas já têm RLS, mas reforçamos que não há policy permitindo anon)

-- financeiro_records — já tem RLS, garantir que anon é bloqueado
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_records' AND policyname='block anon financeiro') THEN
    -- Já existem policies para autenticados; sem policy para anon = bloqueado
    NULL;
  END IF;
END $$;

-- ── 8. VARRIMENTO GERAL: habilitar RLS em QUALQUER tabela pública restante ───
-- Isso é um safety net — tabelas já com RLS são idempotentes
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
      AND tablename NOT IN ('schema_migrations') -- excluir meta-tabelas se houver
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE 'RLS habilitado em: %', tbl;
  END LOOP;
END $$;
