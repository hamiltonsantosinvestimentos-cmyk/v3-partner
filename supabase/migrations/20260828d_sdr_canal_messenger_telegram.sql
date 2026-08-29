-- Estende o Agente SDR pra Messenger e Telegram, no mesmo método já usado
-- pelo WhatsApp/Instagram (ver 20260819_sdr_canal_instagram.sql e
-- 20260820_sdr_ia_ativa_toggle.sql): "phone" continua sendo o identificador
-- genérico de contato por canal (PSID no Messenger, chat_id no Telegram),
-- e cada canal ganha seu próprio interruptor de IA em sdr_flow_config.

-- Os nomes dos CHECK constraints abaixo são os auto-gerados pelo Postgres
-- (<tabela>_<coluna>_check) quando a coluna foi criada com CHECK inline em
-- 20260819_sdr_canal_instagram.sql — não precisamos de nome próprio ali.
ALTER TABLE public.sdr_leads DROP CONSTRAINT IF EXISTS sdr_leads_canal_check;
ALTER TABLE public.sdr_leads
  ADD CONSTRAINT sdr_leads_canal_check
    CHECK (canal IN ('whatsapp', 'instagram', 'messenger', 'telegram'));

ALTER TABLE public.sdr_conversas DROP CONSTRAINT IF EXISTS sdr_conversas_canal_check;
ALTER TABLE public.sdr_conversas
  ADD CONSTRAINT sdr_conversas_canal_check
    CHECK (canal IN ('whatsapp', 'instagram', 'messenger', 'telegram'));

ALTER TABLE public.sdr_flow_config
  ADD COLUMN IF NOT EXISTS ia_ativa_messenger boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ia_ativa_telegram boolean NOT NULL DEFAULT true;
