-- ============================================================
-- MIGRATION: Persistencia de conversa do Assistente do Ativo — Bolsa de Capitais
-- Date: 2026-07-28
-- Scope: o Assistente do Ativo (components/cm/asset-assistant.tsx +
--        app/api/cm/assistant/route.ts) guardava as mensagens so em useState
--        no navegador — fechar o modal apagava a conversa inteira, e nem
--        durante uma sessao aberta a IA recebia o historico das perguntas
--        anteriores (cada chamada mandava so a pergunta atual). Achado real
--        reportado por Joao a pedido do Dr. Luis Athaydes (GESTAO), que
--        precisa manter uma conversa continua por ativo para acumular
--        duvidas e montar a tese comercial ao longo de varias sessoes.
--
-- Uma linha por (listing_id, user_id): conversa continua e individual por
-- pessoa por ativo, sem precisar de tela de "lista de sessoes" — reabrir o
-- assistente do mesmo ativo sempre continua a mesma thread.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_cm_asset_assistant_sessions_updated_at ON cm_asset_assistant_sessions;
--   DROP TABLE IF EXISTS cm_asset_assistant_sessions;
-- ============================================================

CREATE TABLE IF NOT EXISTS cm_asset_assistant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

COMMENT ON TABLE cm_asset_assistant_sessions IS 'Conversa continua do Assistente do Ativo (Claude Haiku), uma por (listing_id, user_id). Substitui o estado que antes vivia so no useState do componente e era perdido ao fechar o chat.';
COMMENT ON COLUMN cm_asset_assistant_sessions.messages IS 'Array JSON [{role: "user"|"assistant", content: string, ts: string}], em ordem cronologica. Enviado de volta pra Anthropic como historico real a cada nova pergunta.';

CREATE INDEX IF NOT EXISTS idx_cm_asset_assistant_sessions_listing ON cm_asset_assistant_sessions(listing_id);

DROP TRIGGER IF EXISTS trg_cm_asset_assistant_sessions_updated_at ON cm_asset_assistant_sessions;
CREATE TRIGGER trg_cm_asset_assistant_sessions_updated_at
  BEFORE UPDATE ON cm_asset_assistant_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE cm_asset_assistant_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_asset_assistant_sessions_select ON cm_asset_assistant_sessions FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_asset_assistant_sessions_insert ON cm_asset_assistant_sessions FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_asset_assistant_sessions_update ON cm_asset_assistant_sessions FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));
