-- ============================================================
-- MIGRATION: Dead-Letter de Intake n8n (W11/W2/W6)
-- Date: 2026-08-02
-- Scope: item 4 do plano de hardening pos W-GUARDIAN (snapshot
--        a2961a7c-9d01-4d61-8904-2c4f482baaf7, 26/07/2026), aprovado
--        por Joao em 02/08/2026. Workflows de intake externo (W11
--        Upload Notify, W2 Intake de Deals, W6 Buy-Side Demand)
--        tinham nos com continueOnFail:true sem verificacao
--        subsequente -- payload malformado podia falhar
--        silenciosamente sem nenhuma trilha de auditoria (mesmo
--        anti-padrao ja corrigido no W-Cessao-Anchor em 28/06/2026
--        e no W-GOV-02 em 02/08/2026).
--
-- LGPD: tabela retem copia temporaria do payload bruto que ja
-- trafega hoje por W11/W2/W6 sob a mesma base legal de execucao
-- contratual (LGPD Art. 7, inc. V) das tabelas de destino
-- (ma_deals, deal_intakes, investor_profiles). Nao introduz nova
-- categoria de coleta -- e auditoria operacional de erro, mesmo
-- principio da tabela execution_errors ja existente em producao.
-- Sign-off: ver 01_Juridico/2026-08-02_LGPD-SignOff_Dead-Letter-Intake.html
--
-- Rollback:
--   DROP TABLE IF EXISTS n8n_intake_dead_letter CASCADE;
-- ============================================================

CREATE TABLE IF NOT EXISTS n8n_intake_dead_letter (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name   text NOT NULL,
  node_name       text NOT NULL,
  execution_id    text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message   text NOT NULL,
  severity        text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  resolved        boolean NOT NULL DEFAULT false,
  resolved_by     uuid REFERENCES profiles(id),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE n8n_intake_dead_letter IS 'Fila de erro (dead-letter) para workflows n8n de intake externo (W11/W2/W6). Todo payload que falhar num no com continueOnFail cai aqui para auditoria e retentativa manual, em vez de desaparecer silenciosamente.';
COMMENT ON COLUMN n8n_intake_dead_letter.severity IS 'critical = disparou o disjuntor (N falhas consecutivas em janela curta); warning = falha isolada.';

CREATE INDEX IF NOT EXISTS idx_n8n_dead_letter_workflow_created ON n8n_intake_dead_letter(workflow_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_dead_letter_unresolved ON n8n_intake_dead_letter(resolved) WHERE resolved = false;

DROP TRIGGER IF EXISTS trg_n8n_dead_letter_updated_at ON n8n_intake_dead_letter;

ALTER TABLE n8n_intake_dead_letter ENABLE ROW LEVEL SECURITY;

CREATE POLICY n8n_dead_letter_select ON n8n_intake_dead_letter FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

CREATE POLICY n8n_dead_letter_update ON n8n_intake_dead_letter FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'))
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));
