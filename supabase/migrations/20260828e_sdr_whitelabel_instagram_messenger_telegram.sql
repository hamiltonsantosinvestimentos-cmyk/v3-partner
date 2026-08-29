-- Estende o white label do SDR (partner_sdr_connections, ver
-- 20260823_sdr_whitelabel_partner.sql) pra Instagram, Messenger e Telegram,
-- cada partner com a própria conexão — mesmo princípio de design do
-- WhatsApp (a V3 nunca guarda credencial em nome do partner sem ele saber,
-- e cada canal isolado por partner_id nas tabelas já existentes).
--
-- Instagram e Messenger compartilham UMA conexão (mesma Página do Facebook —
-- IG Profissional só existe vinculado a uma Página), conectada via OAuth
-- "Conectar com Facebook" (Facebook Login for Business). Telegram é
-- independente (bot próprio do partner, sem OAuth, sem gate da Meta).

ALTER TABLE partner_sdr_connections
  -- Página do Facebook conectada via OAuth (Meta) — alimenta Messenger e,
  -- quando há IG Profissional vinculado, Instagram também.
  ADD COLUMN IF NOT EXISTS meta_page_id text,
  ADD COLUMN IF NOT EXISTS meta_page_name text,
  ADD COLUMN IF NOT EXISTS meta_page_access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS messenger_status text NOT NULL DEFAULT 'desconectado'
    CHECK (messenger_status IN ('desconectado', 'conectado')),
  ADD COLUMN IF NOT EXISTS instagram_business_account_id text,
  ADD COLUMN IF NOT EXISTS instagram_username text,
  ADD COLUMN IF NOT EXISTS instagram_status text NOT NULL DEFAULT 'desconectado'
    CHECK (instagram_status IN ('desconectado', 'conectado')),
  -- Resultado intermediário do OAuth quando a conta do Facebook do partner
  -- administra MAIS DE UMA Página — fica pendente até ele escolher qual
  -- conectar em /api/partner/sdr/meta-oauth/pages (POST). Cada item já vem
  -- com o próprio access_token de Página criptografado (formato
  -- lib/crypto/secret.ts), nunca em texto puro.
  ADD COLUMN IF NOT EXISTS meta_pending_pages jsonb,
  ADD COLUMN IF NOT EXISTS meta_pending_at timestamptz,
  -- Bot do Telegram do partner (token colado manualmente — não passa por OAuth).
  ADD COLUMN IF NOT EXISTS telegram_bot_token_encrypted text,
  ADD COLUMN IF NOT EXISTS telegram_bot_username text,
  ADD COLUMN IF NOT EXISTS telegram_webhook_secret text,
  ADD COLUMN IF NOT EXISTS telegram_status text NOT NULL DEFAULT 'desconectado'
    CHECK (telegram_status IN ('desconectado', 'conectado'));

-- Índice pra resolver rapidamente "de qual partner é essa Página?" quando o
-- webhook do Instagram/Messenger chega (entry.id = Page ID ou IG Business
-- Account ID) — ver comentário equivalente em app/api/sdr/webhook/route.ts
-- pra sessão OpenWA.
CREATE INDEX IF NOT EXISTS idx_partner_sdr_connections_meta_page_id
  ON partner_sdr_connections (meta_page_id) WHERE meta_page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_sdr_connections_ig_account_id
  ON partner_sdr_connections (instagram_business_account_id) WHERE instagram_business_account_id IS NOT NULL;
