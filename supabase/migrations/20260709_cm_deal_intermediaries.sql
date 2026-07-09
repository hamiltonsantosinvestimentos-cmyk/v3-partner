-- ============================================================
-- MIGRATION: Cadeia de Intermediarios + Anexo FPA/NCND (Single Payout) — v1.7.1
-- Date: 2026-07-09
-- Scope: opera o modelo desenhado com o Gemini para resolver a "cordinha
--        de caranguejo" — V3 paga um unico Mandatario (Partner) por lado
--        (compra/venda), que assume obrigacao irrevogavel de repassar aos
--        demais intermediarios conforme Tabela de Distribuicao.
-- Rollback:
--   DROP TABLE IF EXISTS cm_deal_intermediaries;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS signing_token;
-- ============================================================

CREATE TABLE IF NOT EXISTS cm_deal_intermediaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('compra', 'venda')),
  mandatario_partner_id uuid NOT NULL REFERENCES profiles(id),
  intermediary_name text NOT NULL,
  intermediary_document text,
  percentage numeric NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_deal_intermediaries IS 'Cadeia de intermediarios ("cordinha de caranguejo") por lado de operacao. V3 paga um unico Mandatario, que assume obrigacao contratual (Anexo FPA/NCND) de repassar aos demais conforme percentage.';

ALTER TABLE cm_deal_intermediaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_deal_intermediaries_select ON cm_deal_intermediaries FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL')
    OR mandatario_partner_id = auth.uid()
  );

CREATE POLICY cm_deal_intermediaries_insert ON cm_deal_intermediaries FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY cm_deal_intermediaries_delete ON cm_deal_intermediaries FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE INDEX IF NOT EXISTS idx_cm_deal_intermediaries_listing ON cm_deal_intermediaries(listing_id);

ALTER TABLE operation_contracts
  ADD COLUMN IF NOT EXISTS signing_token text UNIQUE;

COMMENT ON COLUMN operation_contracts.signing_token IS 'Token publico opaco para o link de assinatura eletronica do Mandatario (/assinar/anexo/[token]) — usado apenas em contratos vertical capital_markets gerados a partir do Anexo FPA/NCND.';

ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS signature_hash text;
COMMENT ON COLUMN operation_contracts.signature_hash IS 'Hash SHA-256 amarrado ao conteudo do documento + IP + timestamp no momento da assinatura (mesmo padrao do nda_hash em cm_deal_room_access) — prova qual versao exata do texto foi aceita.';
