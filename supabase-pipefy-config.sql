-- ── Adiciona valores ao ENUM deal_stage ───────────────────────────���──────────
ALTER TYPE deal_stage ADD VALUE IF NOT EXISTS 'IOI';
ALTER TYPE deal_stage ADD VALUE IF NOT EXISTS 'PROPOSAL';

-- ── Tabela de configurações do app (Pipefy e outros) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler
CREATE POLICY "app_config_read" ON public.app_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- Apenas ADMIN e GESTAO podem escrever
CREATE POLICY "app_config_write" ON public.app_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'GESTAO')
    )
  );
