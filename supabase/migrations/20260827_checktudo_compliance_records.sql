-- ============================================================
-- MIGRATION: Fase 2 do Cockpit de Due Diligence e Compliance (Bolsa de Ativos)
-- Date: 2026-08-27
-- Scope: registro de consultas Checktudo (SCR/Dossie Juridico) por ativo + governanca
--        de sign-off LGPD por processador de dado de terceiro.
-- Ver: 06_Operacional/SOPs/2026-08-22_Operacional_BRIEF-Cockpit-Compliance-Bolsa-Ativos_v1.html
--      cofre-credenciais-v3.md, Secao 14 (Checktudo).
--
-- Decisao de design (achado real desta sessao, nao estava no BRIEF original): a tabela
-- de due diligence ja existente (cm_due_diligence_records, migration 20260801) tem RLS
-- aberto a QUALQUER conta ADMIN/GESTAO/MESA_OPERACIONAL. O Cockpit de Compliance (Fase 0,
-- 22/08) foi desenhado deliberadamente com allowlist de 5 pessoas via user_feature_access,
-- exatamente para uma conta futura com esses roles nao herdar acesso automatico. Reusar
-- cm_due_diligence_records para o Checktudo teria furado essa allowlist (dado da Checktudo
-- e mais sensivel que o do Escavador: SCR e credito bancario, Dossie tem RG/nome da
-- mae/endereco). Por isso esta migration cria uma tabela dedicada, com RLS proprio preso
-- ao mesmo gate da Fase 0, em vez de estender a tabela existente.
--
-- Rollback:
--   DROP TABLE IF EXISTS cm_compliance_checktudo_records CASCADE;
--   DROP TABLE IF EXISTS lgpd_processor_signoffs CASCADE;
--   DROP FUNCTION IF EXISTS has_compliance_dashboard_access(uuid);
-- ============================================================

-- ── Governanca de sign-off LGPD por processador de dado pessoal de terceiro ──
-- Generico (nao especifico de Checktudo) para poder ser reusado por qualquer integracao
-- futura que precise do mesmo tipo de aprovacao formal do Robson antes de ir ao ar.
CREATE TABLE IF NOT EXISTS lgpd_processor_signoffs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor       text NOT NULL,
  purpose         text NOT NULL,
  signed_off_by   uuid NOT NULL REFERENCES profiles(id),
  signoff_ref     text NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  revoked_by      uuid REFERENCES profiles(id)
);

COMMENT ON TABLE lgpd_processor_signoffs IS 'Registro formal de sign-off LGPD por processador externo de dado pessoal de terceiro (ex: Checktudo, Escavador, Serasa). Gate real de producao: nenhuma rota deve processar dado de terceiro via um processor sem linha ativa aqui.';
COMMENT ON COLUMN lgpd_processor_signoffs.processor IS 'Nome do processador externo, ex: checktudo.';
COMMENT ON COLUMN lgpd_processor_signoffs.purpose IS 'Finalidade especifica autorizada, ex: bolsa_compliance_dashboard_due_diligence. Mesmo processador pode ter sign-offs diferentes para finalidades diferentes.';
COMMENT ON COLUMN lgpd_processor_signoffs.signoff_ref IS 'Referencia do documento formal de sign-off, ex: LGPD-2026-08-27-001, mesmo padrao ja usado em 01_Juridico/.';

-- Nunca 2 sign-offs ativos ao mesmo tempo para o mesmo processor+purpose.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lgpd_processor_signoffs_active_unique
  ON lgpd_processor_signoffs(processor, purpose) WHERE active = true;

ALTER TABLE lgpd_processor_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY lgpd_processor_signoffs_select ON lgpd_processor_signoffs FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

-- Insert/update restrito a ADMIN especificamente (nao a quem tem o grant do cockpit) --
-- decisao deliberada: Taisa ou Dr. Athaydes (que tem grant de bolsa_compliance_dashboard,
-- nao role ADMIN) nao devem conseguir auto-aprovar o sign-off que libera a propria
-- ferramenta que eles usam.
CREATE POLICY lgpd_processor_signoffs_insert ON lgpd_processor_signoffs FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) = 'ADMIN');

CREATE POLICY lgpd_processor_signoffs_update ON lgpd_processor_signoffs FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) = 'ADMIN') WITH CHECK ((SELECT get_user_role()) = 'ADMIN');

-- ── Funcao reusavel para RLS do Cockpit de Compliance (mesmo gate da Fase 0) ──
CREATE OR REPLACE FUNCTION has_compliance_dashboard_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_feature_access
    WHERE user_id = p_user_id AND feature = 'bolsa_compliance_dashboard'
  );
$$;

COMMENT ON FUNCTION has_compliance_dashboard_access IS 'Mesmo gate de acesso do Cockpit de Compliance (Fase 0, 22/08/2026) via user_feature_access, exposto como funcao SQL para uso em RLS. SECURITY DEFINER com search_path fixo.';

-- ── Registro de consultas Checktudo por ativo ──
CREATE TABLE IF NOT EXISTS cm_compliance_checktudo_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  query_type        text NOT NULL CHECK (query_type IN ('cpf', 'cnpj')),
  query_value       text NOT NULL,
  querycode         integer NOT NULL CHECK (querycode IN (3090, 200, 219)),
  score             integer,
  protests_amount   numeric,
  cadastral_status  text,
  risk_flags        jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by      uuid NOT NULL REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_compliance_checktudo_records IS 'Historico de consultas Checktudo (SCR/Dossie Juridico) por ativo da Bolsa de Ativos. RLS restrito ao gate de 5 pessoas do Cockpit de Compliance (has_compliance_dashboard_access), deliberadamente diferente do role amplo ADMIN/GESTAO/MESA_OPERACIONAL usado em cm_due_diligence_records -- ver comentario no topo desta migration.';
COMMENT ON COLUMN cm_compliance_checktudo_records.score IS 'Score de risco V3, calculado na Fase 4 (Sintese IA). NULL ate la -- nao existe score pronto no SCR nem no Dossie Resumido.';
COMMENT ON COLUMN cm_compliance_checktudo_records.protests_amount IS 'Reservado para uma fonte real de protesto/negativacao. NULL para querycode 3090/200 (SCR e Dossie Resumido nao trazem esse dado); ver risk_flags.lawsuit_defendant_value para o proxy mais proximo hoje.';
COMMENT ON COLUMN cm_compliance_checktudo_records.cadastral_status IS 'Reservado para uma fonte real de situacao cadastral (RFB). NULL para querycode 3090/200.';
COMMENT ON COLUMN cm_compliance_checktudo_records.raw_payload IS 'Resposta bruta completa da Checktudo para este querycode -- auditoria e reprocessamento se o mapeamento normalizado mudar (mesma licao do incidente Serasa, 03/08/2026). Pode conter PII sensivel do consultado (RG, nome da mae, endereco no caso do querycode 219) -- acesso restrito via RLS.';

CREATE INDEX IF NOT EXISTS idx_cm_compliance_checktudo_records_listing ON cm_compliance_checktudo_records(listing_id);

ALTER TABLE cm_compliance_checktudo_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_compliance_checktudo_records_select ON cm_compliance_checktudo_records FOR SELECT TO authenticated
  USING (has_compliance_dashboard_access());

CREATE POLICY cm_compliance_checktudo_records_insert ON cm_compliance_checktudo_records FOR INSERT TO authenticated
  WITH CHECK (has_compliance_dashboard_access());
