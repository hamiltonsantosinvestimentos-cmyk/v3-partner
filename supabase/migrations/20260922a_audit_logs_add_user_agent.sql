-- audit_logs nunca teve a coluna user_agent, mas lib/audit.ts sempre tentou
-- gravar esse campo -- como o catch da função engole qualquer erro, TODO
-- insert de auditoria da plataforma vinha falhando em silêncio, sem gravar
-- nada (achado ao investigar o PR "Excluir análise nos Pedidos de Partners").
-- Nullable, como toda coluna nova em tabela existente (ver CLAUDE.md).
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
