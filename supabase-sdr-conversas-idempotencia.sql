-- ============================================================
-- Idempotência do webhook do SDR WhatsApp — evita resposta duplicada
-- da IA quando o OpenWA reentrega o mesmo evento (retry por timeout).
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE sdr_conversas ADD COLUMN IF NOT EXISTS wa_message_id text;

-- Único por telefone + id da mensagem do WhatsApp; NULL é permitido e não conflita
-- (mensagens enviadas manualmente pelo operador não têm wa_message_id).
CREATE UNIQUE INDEX IF NOT EXISTS sdr_conversas_wa_message_id_idx
  ON sdr_conversas (phone, wa_message_id)
  WHERE wa_message_id IS NOT NULL;
