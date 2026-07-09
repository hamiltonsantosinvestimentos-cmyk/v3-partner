-- ============================================================
-- MIGRATION: Bloco de Notas por Deal com mencao @ (Bolsa de Ativos) — v1.7.1
-- Date: 2026-07-09
-- Scope: nova tabela cm_deal_notes
-- Rollback: DROP TABLE IF EXISTS cm_deal_notes;
-- ============================================================

CREATE TABLE IF NOT EXISTS cm_deal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_deal_notes IS 'Bloco de anotacoes exclusivo por ativo da Bolsa de Ativos. Mencao a usuario (@) dispara notificacao in-app (notifications) e email (Resend) para o usuario marcado.';
COMMENT ON COLUMN cm_deal_notes.mentioned_user_ids IS 'IDs de profiles marcados com @ na nota — selecionados via autocomplete na UI, nao parseados do texto livre, para garantir precisao no disparo de notificacao.';

ALTER TABLE cm_deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_deal_notes_select ON cm_deal_notes FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY cm_deal_notes_insert ON cm_deal_notes FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE INDEX IF NOT EXISTS idx_cm_deal_notes_listing ON cm_deal_notes(listing_id);
