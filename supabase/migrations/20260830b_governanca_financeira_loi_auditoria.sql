-- Governança Financeira e Notificações (BRIEF 2 do Fast-Track, 30/08/2026)
-- Ver: 06_Operacional/SOPs/2026-08-30_Operacional_BRIEF-Fast-Track-Contratos-Simples-Agente-IA_v1.html
--
-- 3 peças, decisão explícita de João:
-- 1. Notificação proativa pros 3 sócios: sem coluna nova, é lógica pura em
--    analysis-callback + um helper novo (lib/socios-notify.ts).
-- 2. Quórum soberano (3/3 sempre fecha, 2/3 só abaixo de R$50 mil, jurídico
--    obrigatório acima): sem coluna nova, valor_operacao_estimado já existe
--    em contract_templates desde 20260830. Lógica pura em review/route.ts.
-- 3. LOI casada + auditoria: colunas novas abaixo.

-- Valor real da operação + par de LOI (compra/venda casados por valor).
-- Nenhuma coluna NOT NULL sem default: contratos existentes (não-LOI, ou
-- LOI antigas antes desta trava) ficam com tudo NULL, comportamento
-- idêntico ao de hoje, sem quebra retroativa.
ALTER TABLE operation_contracts
  ADD COLUMN IF NOT EXISTS valor_operacao NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS loi_side TEXT NULL
    CHECK (loi_side IN ('compra', 'venda')),
  ADD COLUMN IF NOT EXISTS loi_matched_contract_id UUID NULL
    REFERENCES operation_contracts(id),
  ADD COLUMN IF NOT EXISTS loi_matching_status TEXT NULL
    CHECK (loi_matching_status IN ('casada', 'nao_casada')),
  ADD COLUMN IF NOT EXISTS loi_override_justification TEXT NULL;

COMMENT ON COLUMN operation_contracts.valor_operacao IS
  'Valor real declarado da operação no momento da geração do contrato. Usado pela trava de LOI casada (compra/venda) e disponível para a governança financeira completa (Fases C-G) usar no futuro.';
COMMENT ON COLUMN operation_contracts.loi_side IS
  'Só relevante para contract_code da série V3C-LOI: compra ou venda. NULL para qualquer outra série.';
COMMENT ON COLUMN operation_contracts.loi_matched_contract_id IS
  'Para uma LOI de venda, aponta para a LOI de compra casada (valor igual ou superior) que autoriza a emissão sem risco de exposição para a V3.';
COMMENT ON COLUMN operation_contracts.loi_matching_status IS
  'casada = par de compra com valor suficiente confirmado no momento da geração. nao_casada = emitida sem par (ou par insuficiente), exige justificativa e aprovação unânime dos 3 sócios (contract_approvals) antes do envio para assinatura.';
COMMENT ON COLUMN operation_contracts.loi_override_justification IS
  'Preenchida pela Mesa quando loi_matching_status=nao_casada, obrigatória para a geração prosseguir mesmo sem par casado.';

-- Auditoria dedicada, permanente, das decisões sobre minutas do Agente de
-- IA (Fast-Track). Separada da timeline operacional de contract_notes de
-- propósito (mesmo critério já usado em outras tabelas de governança deste
-- sistema): é um registro de compliance, não um comentário de Mesa.
CREATE TABLE IF NOT EXISTS contract_ai_agent_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES contract_templates(id),
  event_type   TEXT NOT NULL
    CHECK (event_type IN ('analise_concluida', 'analise_erro', 'voto_registrado', 'minuta_aprovada', 'minuta_reprovada')),
  actor_id     UUID NULL REFERENCES profiles(id),
  actor_name   TEXT NOT NULL,
  detail       JSONB NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE contract_ai_agent_audit_log IS
  'Registro permanente e imutável de cada decisão tomada sobre minutas geradas pelo Agente Revisor de Riscos (Fast-Track), para rastreabilidade de compliance. actor_id NULL = evento do próprio agente (análise concluída/erro), preenchido = voto humano.';
COMMENT ON COLUMN contract_ai_agent_audit_log.detail IS
  'Snapshot do evento: laudo_risco no momento da análise, decision/comment no voto, placar de quórum no fechamento. Nunca editado depois de gravado.';

ALTER TABLE contract_ai_agent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_ai_agent_audit_log_select ON contract_ai_agent_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'GESTAO'))
  );
-- Sem policy de INSERT/UPDATE/DELETE para authenticated: só a service role
-- (chamada a partir das rotas server-side) escreve aqui, nunca o client.

CREATE INDEX IF NOT EXISTS idx_contract_ai_audit_template ON contract_ai_agent_audit_log(template_id);

-- Rollback:
-- ALTER TABLE operation_contracts DROP COLUMN IF EXISTS valor_operacao, DROP COLUMN IF EXISTS loi_side, DROP COLUMN IF EXISTS loi_matched_contract_id, DROP COLUMN IF EXISTS loi_matching_status, DROP COLUMN IF EXISTS loi_override_justification;
-- DROP TABLE IF EXISTS contract_ai_agent_audit_log;
