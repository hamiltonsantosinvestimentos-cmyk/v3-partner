-- ─── Sprint 6: Bucket de documentos — Mesa de Crédito ─────────────────────
-- Execute este script no SQL Editor do Supabase (uma única vez)

-- 1. Cria o bucket privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credit-documents',
  'credit-documents',
  false,
  52428800, -- 50 MB por arquivo
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies de acesso (a API usa service role e bypassa RLS,
--    mas estas policies protegem acesso direto não autorizado)
CREATE POLICY "Autenticados podem fazer upload de documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'credit-documents');

CREATE POLICY "Autenticados podem visualizar documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'credit-documents');

CREATE POLICY "Autenticados podem deletar documentos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'credit-documents');
