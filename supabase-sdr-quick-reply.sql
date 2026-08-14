-- ============================================================
-- Botões de resposta rápida (simulados por texto) no SDR WhatsApp
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Opções oferecidas pela mensagem do assistente (chat 1:1 ou campanha em massa),
-- ex: [{"key":"1","label":"Tenho interesse"},{"key":"2","label":"Agendar apresentação"}]
ALTER TABLE sdr_conversas ADD COLUMN IF NOT EXISTS quick_reply_options jsonb;

-- Opções configuradas para uma campanha de envio em massa (aplicadas a todos os disparos dela)
ALTER TABLE sdr_campanhas_whatsapp ADD COLUMN IF NOT EXISTS quick_reply_options jsonb;
