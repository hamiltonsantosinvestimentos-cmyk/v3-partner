-- Gestao da assinatura do add-on de Atendimento IA WhatsApp: hoje so existia
-- addon_ativo (true/false) e addon_solicitado_em/addon_ativado_em -- sem jeito
-- de pausar, cancelar, ou saber se o partner pagou o mes ou esta atrasado.
--
-- addon_ativo continua exatamente como esta (todas as rotas de API que
-- checam "if (!conexao?.addon_ativo) return 403" continuam funcionando sem
-- mudanca nenhuma) -- addon_status e so uma camada descritiva por cima, pro
-- painel admin, que a aplicacao mantem sincronizada com addon_ativo:
--   'ativo'    -> addon_ativo = true
--   'pausado'  -> addon_ativo = false (bloqueia igual "nao contratado", mas
--                 a sessao WhatsApp e a config da IA ficam guardadas)
--   'cancelado'-> addon_ativo = false (definitivo, mas registra quando)
--   'nao_contratado' -> nunca pediu, ou pediu e ainda nao foi ativado

ALTER TABLE partner_sdr_connections
  ADD COLUMN IF NOT EXISTS addon_status text NOT NULL DEFAULT 'nao_contratado'
    CHECK (addon_status IN ('nao_contratado','ativo','pausado','cancelado')),
  ADD COLUMN IF NOT EXISTS addon_proxima_cobranca date,
  ADD COLUMN IF NOT EXISTS addon_ultimo_pagamento_em date,
  ADD COLUMN IF NOT EXISTS addon_pausado_em timestamptz,
  ADD COLUMN IF NOT EXISTS addon_cancelado_em timestamptz;

-- Backfill: reconstroi addon_status a partir do que ja existia, sem mudar
-- nenhum comportamento (todo partner ja ativo continua ativo).
UPDATE partner_sdr_connections
  SET addon_status = 'ativo'
  WHERE addon_ativo = true AND addon_status = 'nao_contratado';
