-- ============================================================
-- MIGRATION: Seguranca Deal Room (IP+CPF por documento) + Painel KYC segregado — Bolsa de Ativos
-- Date: 2026-07-08
-- Scope: cm_deal_room_access.buyer_cpf, cm_deal_room_document_views, cm_kyc_documents
-- Rollback: ALTER TABLE cm_deal_room_access DROP COLUMN IF EXISTS buyer_cpf;
--           DROP TABLE IF EXISTS cm_deal_room_document_views;
--           DROP TABLE IF EXISTS cm_kyc_documents;
-- ============================================================

ALTER TABLE cm_deal_room_access ADD COLUMN IF NOT EXISTS buyer_cpf text;
COMMENT ON COLUMN cm_deal_room_access.buyer_cpf IS 'CPF do comprador, coletado na qualificacao (Tier 2). Obrigatorio para liberar acesso a documentos — usado no log de visualizacao e na marca dagua.';

-- Log obrigatorio de IP+CPF por documento efetivamente visualizado/baixado
CREATE TABLE IF NOT EXISTS cm_deal_room_document_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES cm_deal_room_access(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES cm_listing_documents(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  buyer_cpf text,
  user_agent text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_deal_room_document_views IS 'Trilha de auditoria obrigatoria: todo download de documento no Deal Room registra IP + CPF do visualizador. Nunca deletar — evidencia de compliance.';

ALTER TABLE cm_deal_room_document_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_deal_room_document_views_select ON cm_deal_room_document_views FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE INDEX IF NOT EXISTS idx_cm_deal_room_document_views_access ON cm_deal_room_document_views(access_id);
CREATE INDEX IF NOT EXISTS idx_cm_deal_room_document_views_document ON cm_deal_room_document_views(document_id);

-- Painel KYC segregado: documentos ficam retidos aqui ate validacao da Mesa,
-- antes de irem para cm_listing_documents (repositorio publico do Deal Room)
DO $$ BEGIN
  CREATE TYPE cm_kyc_party_type AS ENUM ('comprador', 'vendedor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cm_kyc_status AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cm_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  party_type cm_kyc_party_type NOT NULL,
  party_name text,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  original_filename text,
  status cm_kyc_status NOT NULL DEFAULT 'pendente',
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  promoted_document_id uuid REFERENCES cm_listing_documents(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_kyc_documents IS 'Painel segregado de KYC — documentos de comprador/vendedor ficam retidos aqui (pendente) ate a Mesa aprovar. Aprovacao promove o documento para cm_listing_documents (visivel no Deal Room publico).';

ALTER TABLE cm_kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_kyc_documents_select ON cm_kyc_documents FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY cm_kyc_documents_insert ON cm_kyc_documents FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY cm_kyc_documents_update ON cm_kyc_documents FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE INDEX IF NOT EXISTS idx_cm_kyc_documents_listing ON cm_kyc_documents(listing_id);
