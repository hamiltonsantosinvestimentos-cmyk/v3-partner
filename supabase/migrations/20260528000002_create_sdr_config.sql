-- Tabela de configuração do Agente SDR (QR code, estado de conexão)
CREATE TABLE IF NOT EXISTS public.sdr_config (
  key         text PRIMARY KEY,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sdr_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service full access sdr config" ON public.sdr_config
  USING (true)
  WITH CHECK (true);

-- Seed inicial
INSERT INTO public.sdr_config (key, value) VALUES
  ('connection_state', 'disconnected'),
  ('qrcode', null)
ON CONFLICT (key) DO NOTHING;
