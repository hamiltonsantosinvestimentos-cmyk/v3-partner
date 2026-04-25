-- Adiciona coluna de extensão de trial aos perfis
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
