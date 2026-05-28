-- Tabela para conversas do Agente SDR WhatsApp
CREATE TABLE IF NOT EXISTS public.sdr_conversas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  instance    text NOT NULL DEFAULT 'v3-sdr-whatsapp',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sdr_conversas_phone_idx ON public.sdr_conversas (phone, created_at);

ALTER TABLE public.sdr_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads sdr conversas" ON public.sdr_conversas
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'GESTAO')
  );

CREATE POLICY "service inserts sdr conversas" ON public.sdr_conversas
  FOR INSERT WITH CHECK (true);
