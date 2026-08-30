-- Fast-Track de Contratos Simples (BRIEF 30/08/2026, Fases A/B/H)
-- Ver: 06_Operacional/SOPs/2026-08-30_Operacional_BRIEF-Fast-Track-Contratos-Simples-Agente-IA_v1.html
--
-- Objetivo: destravar NCNDA/minutas simples que hoje esperam revisão jurídica
-- completa do zero, mesmo quando o padrão já foi coberto por precedente
-- aprovado. O Agente Revisor de Riscos analisa o documento recebido e
-- redige uma minuta saneada; o quórum humano continua obrigatório (o
-- mecanismo de aprovação de contract_templates já existe desde 17/08/2026,
-- nenhuma mudança nele além da trava de valor abaixo).
--
-- Ajustes aplicados por decisão explícita de João (30/08/2026):
-- 1. Nenhuma coluna para "artigo de lei citado" — o agente foi instruído a
--    nomear o princípio de risco e comparar contra minuta institucional já
--    aprovada, nunca citar número de artigo (risco de alucinação jurídica).
-- 2. Arquitetura assíncrona: analysis_status existe justamente para o
--    upload devolver "processando" na hora e o n8n escrever o resultado
--    depois, evitando timeout de 60s da Vercel em upload + Claude Sonnet.
-- 3. valor_operacao_estimado é a trava manual temporária: acima de
--    R$50.000 bloqueia o caminho "2/3 sócios dispensa jurídico" na revisão
--    desta minuta (ver ajuste em app/api/contracts/templates/[id]/review/route.ts).
--    Temporária até a governança financeira completa (Fases C-G, BRIEF
--    separado) substituir isso por regra ligada ao valor real do contrato.

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'agente_ia')),
  ADD COLUMN IF NOT EXISTS laudo_risco JSONB NULL,
  ADD COLUMN IF NOT EXISTS documento_original_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT NULL
    CHECK (analysis_status IN ('processando', 'concluido', 'erro')),
  ADD COLUMN IF NOT EXISTS analysis_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS valor_operacao_estimado NUMERIC NULL;

COMMENT ON COLUMN contract_templates.origem IS
  'manual = criada por humano (fluxo original); agente_ia = gerada pelo Agente Revisor de Riscos a partir de upload de contrato recebido (Fast-Track, 30/08/2026)';
COMMENT ON COLUMN contract_templates.laudo_risco IS
  'Saída estruturada do Agente Revisor de Riscos: pontos_criticos com severidade e desvio em relação a minuta institucional aprovada. Nunca contém número de artigo de lei (decisão de 30/08/2026, risco de alucinação jurídica). NULL quando origem=manual.';
COMMENT ON COLUMN contract_templates.documento_original_path IS
  'Path no Storage do documento recebido antes da análise do agente, preservado para auditoria (nunca sobrescrito pela minuta saneada).';
COMMENT ON COLUMN contract_templates.analysis_status IS
  'Só relevante quando origem=agente_ia. processando enquanto o n8n roda o Agente Revisor em background; concluido quando laudo_risco + body_text_raw estão prontos e a minuta já entrou em em_revisao; erro se falhar (ver analysis_error). NULL para origem=manual.';
COMMENT ON COLUMN contract_templates.valor_operacao_estimado IS
  'Valor declarado pela Mesa no momento do upload (trava manual temporária, BRIEF 30/08/2026). Acima de R$50.000 força o voto do jurídico na revisão desta minuta, bloqueando o caminho de dispensa por maioria de sócios. Nunca usado como valor real do contrato gerado.';

-- Cobrança automática de qualificação pendente (aditivo, nenhuma mudança
-- de comportamento até o cron novo existir).
ALTER TABLE cm_qualification_batches
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reminder_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN cm_qualification_batches.last_reminder_sent_at IS
  'Última vez que o cron de cobrança (GET /api/cron/qualification-reminder) disparou alerta WhatsApp/e-mail para as partes pendentes deste lote.';
COMMENT ON COLUMN cm_qualification_batches.reminder_count IS
  'Quantos lembretes já foram enviados para este lote, incrementado a cada disparo do cron.';

-- Rollback:
-- ALTER TABLE contract_templates DROP COLUMN IF EXISTS origem, DROP COLUMN IF EXISTS laudo_risco, DROP COLUMN IF EXISTS documento_original_path, DROP COLUMN IF EXISTS analysis_status, DROP COLUMN IF EXISTS analysis_error, DROP COLUMN IF EXISTS valor_operacao_estimado;
-- ALTER TABLE cm_qualification_batches DROP COLUMN IF EXISTS last_reminder_sent_at, DROP COLUMN IF EXISTS reminder_count;
