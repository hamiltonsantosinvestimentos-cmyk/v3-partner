-- ============================================================
-- MIGRATION: Due Diligence de Ativos (Escavador) — Bolsa de Capitais
-- Date: 2026-08-01
-- Scope: historico de checagens de due diligence por ativo (cm_asset_listings),
--        a pedido de Joao para Dr. Luis Athaydes Homem (GESTAO) e Taisa Pedroso
--        (MESA_OPERACIONAL) fazerem due diligence de precatorios/direito
--        creditorio direto no ativo, reaproveitando a integracao Escavador ja
--        em producao no Credit Engine (app/api/kyc/escavador/route.ts).
--
-- LGPD: uso do Escavador dentro da Bolsa de Ativos autorizado por Robson Lino
-- em 01/08/2026 — ver 01_Juridico/2026-08-01_LGPD-SignOff_Bolsa-de-Ativos-
-- Due-Diligence-Escavador.html (Ref. LGPD-2026-08-01-001).
--
-- Rollback:
--   DROP TABLE IF EXISTS cm_due_diligence_records CASCADE;
-- ============================================================

CREATE TABLE IF NOT EXISTS cm_due_diligence_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  tool          text NOT NULL CHECK (tool IN ('escavador')),
  query_type    text NOT NULL CHECK (query_type IN ('cpf', 'cnpj', 'nome')),
  query_value   text NOT NULL,
  result        jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by  uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_due_diligence_records IS 'Historico de checagens de due diligence por ativo da Bolsa de Ativos (hoje: Escavador). Registro de auditoria — nunca deletar.';
COMMENT ON COLUMN cm_due_diligence_records.query_value IS 'CPF/CNPJ ou nome consultado — mesmo dado ja coletado em cm_asset_listings.seller_cpf_cnpj.';
COMMENT ON COLUMN cm_due_diligence_records.result IS 'Resposta completa da API Escavador (envolvido, total_processos, match_tipo, processos[]).';

CREATE INDEX IF NOT EXISTS idx_cm_due_diligence_records_listing ON cm_due_diligence_records(listing_id);

ALTER TABLE cm_due_diligence_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_due_diligence_records_select ON cm_due_diligence_records FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_due_diligence_records_insert ON cm_due_diligence_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));
