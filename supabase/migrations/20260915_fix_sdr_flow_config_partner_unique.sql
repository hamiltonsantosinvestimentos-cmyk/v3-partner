-- Bug real, achado testando ao vivo (15/09/2026): o índice único de
-- partner_id em sdr_flow_config era PARCIAL (WHERE partner_id IS NOT NULL,
-- ver migration 20260823_sdr_whitelabel_partner.sql). Um índice parcial não
-- serve de alvo pra "ON CONFLICT (partner_id)" sem repetir o mesmo WHERE na
-- cláusula -- e o upsert de app/api/partner/sdr/automacao/route.ts nunca
-- repetia. Resultado: TODA tentativa de qualquer partner salvar a aba
-- Automação (nome do agente, contexto, regras, os 4 toggles de IA ligada/
-- desligada por canal) falhava com "there is no unique or exclusion
-- constraint matching the ON CONFLICT specification" (42P10) -- e o
-- frontend engolia o erro silenciosamente (só não mostrava "Salvo!"), então
-- parecia que a automação "ficava sempre ativa" sem nenhum aviso de erro em
-- lugar nenhum.
--
-- Índice cheio (sem WHERE) resolve: continua permitindo múltiplas linhas
-- com partner_id NULL (comportamento padrão de UNIQUE no Postgres — NULL
-- nunca "bate" com NULL), então não muda nada pra linha 'default' da V3, só
-- passa a casar com ON CONFLICT (partner_id) sem predicado.
DROP INDEX IF EXISTS idx_sdr_flow_config_partner_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_flow_config_partner_unique
  ON sdr_flow_config (partner_id);
