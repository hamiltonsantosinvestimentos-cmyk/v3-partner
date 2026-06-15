-- Adiciona contract_status / contract_signed_at em ma_deals.
-- O webhook ClickSign (app/api/ma/clicksign-webhook/route.ts) já tentava
-- gravar essas colunas para marcar o mandato/NDA como assinado, mas elas
-- nunca existiram na tabela — o UPDATE falhava silenciosamente (try/catch).
-- Esta migration corrige a lacuna e habilita o gate do Módulo Observador
-- do bp-intake (acesso de leitura liberado após contract_status = 'SIGNED').

ALTER TABLE ma_deals
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz;

COMMENT ON COLUMN ma_deals.contract_status IS 'PENDING | SIGNED — atualizado via webhook ClickSign ao fechar o mandato/NDA';
COMMENT ON COLUMN ma_deals.contract_signed_at IS 'Timestamp da assinatura do contrato via ClickSign';
