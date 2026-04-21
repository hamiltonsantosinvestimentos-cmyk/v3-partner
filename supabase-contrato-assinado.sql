-- Migration: IPs das assinaturas, email V3 e URL do contrato finalizado
-- Executar no Supabase SQL Editor

ALTER TABLE contratos_mandato
  ADD COLUMN IF NOT EXISTS v3_ip_address          TEXT,
  ADD COLUMN IF NOT EXISTS v3_email               TEXT,
  ADD COLUMN IF NOT EXISTS testemunha_ip_address  TEXT,
  ADD COLUMN IF NOT EXISTS testemunha2_ip_address TEXT,
  ADD COLUMN IF NOT EXISTS contrato_url           TEXT;

-- Bucket para contratos assinados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contratos',
  'contratos',
  false,
  10485760, -- 10 MB
  ARRAY['text/html', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autenticados visualizam contratos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contratos');

CREATE POLICY "Autenticados fazem upload de contratos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos');
