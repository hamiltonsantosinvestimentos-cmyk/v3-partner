-- Cockpit de Compliance (Bolsa de Ativos), Fase 4 -- Síntese de IA + Dossiê
-- de Risco em PDF. Colunas nullable em cm_asset_listings + tabela nova de
-- quórum de assinatura (1 Sócio ADMIN + Dr. Luis Athaydes, regra confirmada
-- por João em 22/08/2026, mesmo espírito de contract_template_reviews).

ALTER TABLE cm_asset_listings
  ADD COLUMN IF NOT EXISTS risk_dossier_text          text,
  ADD COLUMN IF NOT EXISTS risk_dossier_generated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS risk_dossier_pdf_path       text,
  ADD COLUMN IF NOT EXISTS risk_dossier_hash           text,
  ADD COLUMN IF NOT EXISTS risk_dossier_finalized_at   timestamptz;

CREATE TABLE IF NOT EXISTS cm_risk_dossier_signoffs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  signer_id    uuid NOT NULL REFERENCES profiles(id),
  signer_name  text NOT NULL,
  signer_role  text NOT NULL CHECK (signer_role IN ('socio_admin', 'juridico')),
  signed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_risk_dossier_signoffs_listing ON cm_risk_dossier_signoffs(listing_id);

ALTER TABLE cm_risk_dossier_signoffs ENABLE ROW LEVEL SECURITY;

-- Mesma allowlist de 5 pessoas do Cockpit (gate real fica na aplicação via
-- hasComplianceDashboardAccess; RLS aqui é defesa em profundidade, mesmo
-- padrão de lgpd_processor_signoffs).
CREATE POLICY cm_risk_dossier_signoffs_select ON cm_risk_dossier_signoffs
  FOR SELECT USING (get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_risk_dossier_signoffs_insert ON cm_risk_dossier_signoffs
  FOR INSERT WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));

COMMENT ON TABLE cm_risk_dossier_signoffs IS 'Quórum de fechamento do Dossiê de Risco (Cockpit de Compliance, Fase 4): fecha com 1 assinatura socio_admin (João/Hamilton/Robson) + 1 juridico (Dr. Luis Athaydes). Gate real e emissão do PDF ficam na rota /api/cm/listings/[id]/compliance-dossier/signoff.';
