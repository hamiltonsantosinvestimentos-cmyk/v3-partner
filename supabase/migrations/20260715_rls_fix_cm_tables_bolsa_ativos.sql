-- ============================================================
-- SECURITY FIX: RLS nas 9 tabelas cm_* sem protecao (Supabase Advisor)
-- Corrige script rascunho (user_roles/buyer_id/cm_deal_room_invites nao existem)
-- Todas as tabelas so sao acessadas via service role em /api/cm/*, confirmado
-- Aplicado em producao via MCP em 2026-07-15
-- ============================================================

ALTER TABLE IF EXISTS public.cm_asset_listings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_asset_listings' AND policyname='internal manage listings') THEN
    CREATE POLICY "internal manage listings" ON public.cm_asset_listings
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_listing_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_listing_documents' AND policyname='internal manage listing docs') THEN
    CREATE POLICY "internal manage listing docs" ON public.cm_listing_documents
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_bids ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_bids' AND policyname='internal manage bids') THEN
    CREATE POLICY "internal manage bids" ON public.cm_bids
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_tranches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_tranches' AND policyname='internal manage tranches') THEN
    CREATE POLICY "internal manage tranches" ON public.cm_tranches
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_commission_splits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_commission_splits' AND policyname='internal manage commission splits') THEN
    CREATE POLICY "internal manage commission splits" ON public.cm_commission_splits
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_risk_scores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_risk_scores' AND policyname='internal manage risk scores') THEN
    CREATE POLICY "internal manage risk scores" ON public.cm_risk_scores
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_status_transitions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_status_transitions' AND policyname='internal manage status transitions') THEN
    CREATE POLICY "internal manage status transitions" ON public.cm_status_transitions
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_buyer_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_buyer_alerts' AND policyname='internal manage buyer alerts') THEN
    CREATE POLICY "internal manage buyer alerts" ON public.cm_buyer_alerts
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cm_escrow_operations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_escrow_operations' AND policyname='admin gestao manage escrow') THEN
    CREATE POLICY "admin gestao manage escrow" ON public.cm_escrow_operations
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO'));
  END IF;
END $$;
