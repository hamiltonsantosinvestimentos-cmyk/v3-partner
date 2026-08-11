-- ============================================================
-- MIGRATION: Revisao Juridica de Minutas + Edicao Pos-Envio de Contrato
-- Date: 2026-08-11
-- Scope: da vida real ao campo contract_templates.approval_status (existia
--        no schema desde antes desta sessao, nunca lido nem escrito por
--        nenhuma rota/UI, sempre "rascunho"). Pedido real de Joao: minuta
--        so pode gerar contrato depois de aprovada pelo juridico (Dr. Luis
--        Athaydes) + um segundo aprovador (compliance/Robson OU outro socio
--        diretor). Revisor pode editar o corpo direto na tela de revisao,
--        nao so aprovar/reprovar. Tambem cobre edicao pontual de um contrato
--        JA GERADO (hoje imutavel), para corrigir uma clausula reportada
--        pelo signatario via WhatsApp/e-mail e reenviar para assinatura.
--
-- Rollback:
--   DROP TABLE IF EXISTS operation_contract_versions;
--   DROP TABLE IF EXISTS contract_template_reviews;
--   ALTER TABLE contract_templates DROP CONSTRAINT IF EXISTS contract_templates_approval_status_check;
--   ALTER TABLE contract_templates DROP COLUMN IF EXISTS review_round;
-- ============================================================

-- ════════════════════════════════════════════════════
-- 1. contract_templates: approval_status ganha regra real
-- ════════════════════════════════════════════════════

ALTER TABLE contract_templates DROP CONSTRAINT IF EXISTS contract_templates_approval_status_check;
ALTER TABLE contract_templates ADD CONSTRAINT contract_templates_approval_status_check
  CHECK (approval_status IN ('rascunho', 'em_revisao', 'aprovado', 'reprovado'));

-- review_round: incrementado toda vez que a minuta volta para 'em_revisao'
-- vindo de rascunho/reprovado. Isola rodadas de revisao: uma aprovacao de
-- uma rodada anterior nunca conta para a rodada atual (evita contar
-- aprovacao velha depois de o texto ter mudado e sido reenviado).
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS review_round int NOT NULL DEFAULT 1;

-- Grandfathering: as minutas ja existentes hoje (todas em 'rascunho', nunca
-- passaram por revisao formal porque a feature nao existia) ficam aprovadas
-- direto, para nao travar geracao de contrato que ja funcionava.
UPDATE contract_templates SET approval_status = 'aprovado' WHERE approval_status = 'rascunho';

COMMENT ON COLUMN contract_templates.approval_status IS 'rascunho (autor edita) -> em_revisao (aguardando juridico+compliance/socio) -> aprovado (libera geracao de contrato) ou reprovado (volta pro autor). Editar body_text_raw de uma minuta aprovada reseta para rascunho automaticamente.';

-- ════════════════════════════════════════════════════
-- 2. TABLE: contract_template_reviews (auditoria de revisao)
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contract_template_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  review_round int NOT NULL,
  reviewer_id uuid REFERENCES profiles(id),
  reviewer_name text NOT NULL,
  reviewer_type text NOT NULL CHECK (reviewer_type IN ('juridico', 'compliance_socio')),
  decision text NOT NULL CHECK (decision IN ('aprovado', 'reprovado')),
  comment text,
  body_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contract_template_reviews IS 'Uma linha por decisao de revisao juridica de uma minuta (contract_templates). Aprovacao final exige 1 decisao aprovado de reviewer_type=juridico (Dr. Luis Athaydes) + 1 decisao aprovado de reviewer_type=compliance_socio (Robson Lino ou outro socio diretor), ambas no mesmo review_round.';

CREATE INDEX IF NOT EXISTS idx_contract_template_reviews_template ON contract_template_reviews(template_id);

ALTER TABLE contract_template_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_template_reviews_select ON contract_template_reviews FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

CREATE POLICY contract_template_reviews_insert ON contract_template_reviews FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO'));

-- ════════════════════════════════════════════════════
-- 3. TABLE: operation_contract_versions (historico de edicao pos-geracao)
-- ════════════════════════════════════════════════════
-- Hoje um contrato gerado (operation_contracts.rendered_html) e imutavel:
-- nenhuma rota jamais editou esse campo depois do INSERT original. Esta
-- tabela guarda o texto anterior sempre que a Mesa editar um contrato ja
-- gerado (ex: corrigir uma clausula apontada pelo signatario antes de
-- assinar), preservando rastreabilidade juridica de toda versao anterior.

CREATE TABLE IF NOT EXISTS operation_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES operation_contracts(id) ON DELETE CASCADE,
  rendered_html text NOT NULL,
  edited_by uuid REFERENCES profiles(id),
  edited_by_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE operation_contract_versions IS 'Snapshot do rendered_html ANTES de cada edicao pos-geracao de um contrato (operation_contracts). Gravado pela rota PATCH /api/contracts/[id]/edit-body antes de sobrescrever o texto vigente.';

CREATE INDEX IF NOT EXISTS idx_operation_contract_versions_contract ON operation_contract_versions(contract_id);

ALTER TABLE operation_contract_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY operation_contract_versions_select ON operation_contract_versions FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY operation_contract_versions_insert ON operation_contract_versions FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));
