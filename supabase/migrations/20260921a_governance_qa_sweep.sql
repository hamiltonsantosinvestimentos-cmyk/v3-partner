-- Varredura sistemática de governança (v3-governance-qa), aprovada por João em
-- 21/09/2026 após o piloto de 3 funcionalidades (3/3 BLOQUEADO, 26 achados,
-- 2 bugs sistêmicos em bibliotecas compartilhadas corrigidos no mesmo dia,
-- PR #158). Objetivo: inventariar as funcionalidades do portal, rodar a
-- auditoria do agente @v3-governance-qa numa rotina diária (~4/dia, 45 dias
-- para cobrir tudo) e manter uma agenda de correção rastreável, sem gravar
-- os achados soltos em texto de sessão.
--
-- Três tabelas, nesta ordem de dependência: features -> audit_runs -> findings.

CREATE TABLE IF NOT EXISTS governance_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text NOT NULL, -- ex: "Central de Contratos", "Bolsa de Ativos", "Mesa M&A", "Mesa de Crédito"
  kind text NOT NULL CHECK (kind IN ('route', 'page', 'component', 'lib_compartilhada')),
  paths text[] NOT NULL, -- arquivos reais que compõem a funcionalidade (rota + componente + lib), nunca 1 caminho fixo genérico
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_auditoria', 'auditado', 'corrigido')),
  last_audit_run_id uuid, -- FK adicionada depois de governance_audit_runs existir (ver ALTER abaixo)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES governance_features(id) ON DELETE CASCADE,
  run_date date NOT NULL DEFAULT current_date,
  verdict text NOT NULL CHECK (verdict IN ('LIBERADO', 'BLOQUEADO')),
  findings_count int NOT NULL DEFAULT 0,
  total_tokens int,
  duration_ms int,
  raw_report text NOT NULL, -- relatório completo no formato da skill, para auditoria/replay
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE governance_features
  ADD CONSTRAINT governance_features_last_audit_run_fk
  FOREIGN KEY (last_audit_run_id) REFERENCES governance_audit_runs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS governance_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid NOT NULL REFERENCES governance_audit_runs(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES governance_features(id) ON DELETE CASCADE,
  rule_id text NOT NULL, -- ex: "1.3", "2.1" -- ID da regra do checklist v3-governance-qa
  severity text NOT NULL DEFAULT 'bloqueante' CHECK (severity IN ('bloqueante', 'sugestao')),
  summary text NOT NULL,
  file_path text,
  line_hint text, -- número de linha ou trecho -- guardado como texto porque a linha muda a cada edição
  excerpt text,
  correction_required text NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_correcao', 'corrigido', 'aceito_com_ressalva')),
  pr_url text,
  scheduled_for date, -- a agenda de correção pedida por João
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_findings_feature ON governance_findings(feature_id);
CREATE INDEX IF NOT EXISTS idx_governance_findings_status ON governance_findings(status);
CREATE INDEX IF NOT EXISTS idx_governance_findings_scheduled ON governance_findings(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_governance_audit_runs_feature ON governance_audit_runs(feature_id);

-- Reaproveita o trigger já padrão do projeto (20260502000001_deal_intakes.sql),
-- nunca duplicar a função (REUSE > ADAPT > CREATE).
CREATE TRIGGER trg_governance_features_updated_at
  BEFORE UPDATE ON governance_features
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_governance_findings_updated_at
  BEFORE UPDATE ON governance_findings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: só ADMIN/GESTAO enxergam e escrevem pela tela. A rotina agendada e a
-- rota de ingestão gravam via service role (bypassa RLS por padrão do
-- Supabase), nunca com a chave anon.
ALTER TABLE governance_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY governance_features_admin_gestao ON governance_features
  FOR ALL USING (get_user_role() IN ('ADMIN', 'GESTAO')) WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE POLICY governance_audit_runs_admin_gestao ON governance_audit_runs
  FOR ALL USING (get_user_role() IN ('ADMIN', 'GESTAO')) WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE POLICY governance_findings_admin_gestao ON governance_findings
  FOR ALL USING (get_user_role() IN ('ADMIN', 'GESTAO')) WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));
