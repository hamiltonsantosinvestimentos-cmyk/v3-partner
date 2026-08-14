-- ============================================================
-- Mídia (imagem/vídeo) nas campanhas de envio em massa do WhatsApp
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE sdr_campanhas_whatsapp ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE sdr_campanhas_whatsapp ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- O bucket 'sdr-media' é criado automaticamente pela rota de upload na primeira
-- vez que for usada (mesmo padrão de app/api/profile/avatar/route.ts), não
-- precisa ser criado aqui.
