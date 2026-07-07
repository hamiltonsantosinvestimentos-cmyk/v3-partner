-- ============================================================
-- MIGRATION: Documentos do comprador no intake publico (LOI/MOU + procuracao) — Bolsa de Ativos
-- Date: 2026-07-08
-- Scope: nova tabela investor_demand_documents
-- Rollback: DROP TABLE IF EXISTS investor_demand_documents;
-- ============================================================

CREATE TABLE IF NOT EXISTS investor_demand_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES investor_demands(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('loi_mou', 'procuracao', 'outro')),
  storage_path text NOT NULL,
  original_filename text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE investor_demand_documents IS 'Documentos anexados pelo comprador no Buy Intake Wizard publico — LOI/MOU e procuracao, exigidos no cadastro inicial.';

ALTER TABLE investor_demand_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY investor_demand_documents_select ON investor_demand_documents FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE INDEX IF NOT EXISTS idx_investor_demand_documents_demand ON investor_demand_documents(demand_id);
