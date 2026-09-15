-- Links de Serviço: prazo de expiração + suporte a histórico/dashboard
-- Gatilho: João pediu "permitir visualizar o histórico dos links gerados e
-- incluir um prazo de expiração", "visualizar também no deal do ativo o
-- status do link gerado" e um Dashboard de Links pra diretoria (14/09/2026).
-- Ver session-decisions.md 2026-09-14/15.
--
-- expires_at nullable: todo link já existente continua sem expiração,
-- comportamento idêntico ao de hoje (backward compatible). Novo link nasce
-- com expires_at = created_at + N dias (N escolhido pelo partner no
-- formulário, default 10, sugestão de João).

ALTER TABLE partner_service_links
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_psl_expires_at ON partner_service_links(expires_at);
