-- KYC/Due Diligence inicial de possiveis investidores, Mesa M&A > Compliance.
-- Ver Feature Spec 06_Operacional/SOPs/2026-09-16_Operacional_FeatureSpec-KYC-
-- DueDiligence-Investidores-MesaMA_v1.html.
--
-- Gate LGPD real desta feature usa a tabela ja existente lgpd_processor_signoffs
-- (criada em 20260827_checktudo_compliance_records.sql), nao uma coluna nova:
-- as rotas checam processor+purpose ativos antes de rodar qualquer consulta real
-- de CPF de terceiro, mesmo padrao ja em producao em
-- app/api/cm/listings/[id]/compliance-scan/route.ts. purpose usado aqui:
-- 'ma_investor_compliance_kyc', processors 'escavador' e 'checktudo'. Nenhum
-- sign-off ativo existe ainda para este purpose: a feature fica implementada e
-- homologavel (autoconsulta), mas bloqueada para CPF real de terceiro ate Robson
-- Lino inserir a linha (mesmo fluxo ja usado para o Cockpit de Compliance).

CREATE TABLE IF NOT EXISTS ma_investor_compliance_checks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by            UUID NOT NULL REFERENCES profiles(id),

  entity_name             TEXT NOT NULL,
  entity_doc              TEXT NOT NULL,            -- CPF, so digitos
  dd_level                TEXT CHECK (dd_level IN ('SDD','Padrão','EDD')) DEFAULT 'Padrão',
  notes                   TEXT,

  status                  TEXT NOT NULL CHECK (status IN ('processando','concluido','erro'))
                                DEFAULT 'processando',

  -- Fase 1: fontes estruturadas
  escavador_result        JSONB,
  escavador_queried_at    TIMESTAMPTZ,
  checktudo_scr_result    JSONB,
  checktudo_dossie_result JSONB,
  checktudo_queried_at    TIMESTAMPTZ,
  blacklist_match         JSONB,
  source_errors           JSONB,        -- nunca engolir erro em log so, sempre expor aqui
                                          -- (mesma licao do incidente de 03/08/2026 no Credit Engine)

  -- Fase 2: pesquisa aberta, best-effort, nunca fonte oficial
  social_summary_text     TEXT,
  social_summary_sources  JSONB,
  social_queried_at       TIMESTAMPTZ,

  -- Score
  score                   INTEGER CHECK (score BETWEEN 0 AND 100),
  risk_label              TEXT CHECK (risk_label IN ('BAIXO RISCO','RISCO MÉDIO','ALTO RISCO')),
  verdict                 TEXT CHECK (verdict IN ('Aprovado','Condicional','Bloqueado')),

  -- Vinculo Client 360 (best-effort, nunca bloqueia)
  v3_client_id            UUID REFERENCES v3_clients(id),

  -- Fase 3: PDF final
  pdf_path                TEXT,
  pdf_generated_at        TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ma_investor_compliance_checks IS
  'Due diligence/KYC inicial de possiveis investidores da Mesa M&A. Acesso: ADMIN e GESTAO.
   Patrimonio e participacao societaria nao sao colunas desta tabela: nenhuma fonte homologada
   no projeto cobre isso hoje (ver Feature Spec 2026-09-16). Nao inventar coluna para isso
   sem antes homologar uma fonte real. Gate LGPD real via lgpd_processor_signoffs
   (processor in (''escavador'',''checktudo''), purpose=''ma_investor_compliance_kyc'').';

DROP TRIGGER IF EXISTS trg_ma_investor_compliance_checks_updated_at
  ON ma_investor_compliance_checks;
CREATE TRIGGER trg_ma_investor_compliance_checks_updated_at
  BEFORE UPDATE ON ma_investor_compliance_checks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ma_investor_compliance_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY ma_investor_compliance_checks_select ON ma_investor_compliance_checks
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE POLICY ma_investor_compliance_checks_insert ON ma_investor_compliance_checks
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE POLICY ma_investor_compliance_checks_update ON ma_investor_compliance_checks
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

-- Sem policy de DELETE de proposito: e um registro de auditoria de compliance,
-- mesmo padrao ja usado em kyc_analyses e kyc_access_log.

CREATE INDEX IF NOT EXISTS idx_ma_investor_compliance_doc
  ON ma_investor_compliance_checks(entity_doc);
CREATE INDEX IF NOT EXISTS idx_ma_investor_compliance_requested_by
  ON ma_investor_compliance_checks(requested_by);
CREATE INDEX IF NOT EXISTS idx_ma_investor_compliance_created
  ON ma_investor_compliance_checks(created_at DESC);
