-- ============================================================
-- V3 PARTNER — Migration: Módulo de Criativos M&A
-- Execute no painel Supabase > SQL Editor
-- ADDITIVE ONLY — zero breaking changes no schema existente
-- ============================================================

-- ============================================================
-- 1. Adicionar colunas em ma_deals (IF NOT EXISTS = seguro)
-- ============================================================
ALTER TABLE public.ma_deals
  ADD COLUMN IF NOT EXISTS slug         TEXT,
  ADD COLUMN IF NOT EXISTS location     TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS asset_data   JSONB NOT NULL DEFAULT '{}';

-- Índice único no slug (apenas quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_deals_slug
  ON public.ma_deals(slug) WHERE slug IS NOT NULL;

-- ============================================================
-- 2. Tabela: creative_jobs
--    Rastreia cada disparo de geração de criativos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creative_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       UUID        NOT NULL REFERENCES public.ma_deals(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING','PROCESSING','DONE','ERROR')),
  progress      INT         NOT NULL DEFAULT 0
                            CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_by    UUID        REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER creative_jobs_updated_at
  BEFORE UPDATE ON public.creative_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. Tabela: creative_files
--    Armazena cada arquivo gerado (PDF, PNG, JPG)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creative_files (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID        NOT NULL REFERENCES public.ma_deals(id) ON DELETE CASCADE,
  job_id       UUID        REFERENCES public.creative_jobs(id) ON DELETE SET NULL,
  file_type    TEXT        NOT NULL
               CHECK (file_type IN ('cim','teaser','linkedin_post','linkedin_story')),
  language     TEXT        NOT NULL DEFAULT 'pt-br'
               CHECK (language IN ('pt-br','en')),
  format       TEXT        NOT NULL
               CHECK (format IN ('pdf','png','jpg')),
  storage_path TEXT        NOT NULL,
  public_url   TEXT,
  file_size_kb INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. RLS — Row Level Security nas novas tabelas
-- ============================================================
ALTER TABLE public.creative_jobs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_files ENABLE ROW LEVEL SECURITY;

-- creative_jobs: ADMIN/GESTAO/MESA veem tudo; criador vê os seus
CREATE POLICY "creative_jobs_select" ON public.creative_jobs
  FOR SELECT USING (
    public.get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL')
    OR created_by = auth.uid()
  );

CREATE POLICY "creative_jobs_insert" ON public.creative_jobs
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL')
  );

CREATE POLICY "creative_jobs_update" ON public.creative_jobs
  FOR UPDATE USING (
    public.get_user_role() IN ('ADMIN','GESTAO')
  );

-- creative_files: todos autenticados podem visualizar e baixar
CREATE POLICY "creative_files_select" ON public.creative_files
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "creative_files_insert" ON public.creative_files
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL')
  );

-- ============================================================
-- 5. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_creative_jobs_deal   ON public.creative_jobs(deal_id);
CREATE INDEX IF NOT EXISTS idx_creative_jobs_status ON public.creative_jobs(status);
CREATE INDEX IF NOT EXISTS idx_creative_files_deal  ON public.creative_files(deal_id);
CREATE INDEX IF NOT EXISTS idx_creative_files_type  ON public.creative_files(file_type, language);
CREATE INDEX IF NOT EXISTS idx_ma_deals_location    ON public.ma_deals(location);
