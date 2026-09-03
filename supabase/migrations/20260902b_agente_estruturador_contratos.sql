-- =============================================================================
-- AGENTE ESTRUTURADOR DE CONTRATOS (02/09/2026)
-- =============================================================================
--
-- CONTEXTO
--   Implementacao do "Agente 1: Estruturador de Contratos" (draft de
--   30/08/2026, 06_Operacional/SOPs/2026-08-30_Operacional_Draft-Agentes-
--   Juridicos-Central-Contratos_v1.html), aprovado por Joao em 02/09/2026.
--   A Mesa descreve a intencao de negocio em texto livre, o agente redige
--   a minuta completa e aponta brechas juridicas que identificou. Nunca
--   aprova a propria minuta, e a minuta cai (e permanece) em "rascunho" --
--   decisao explicita de Joao: como nasce de descricao abstrata, a Mesa
--   Operacional precisa ler e refinar antes de mandar pro juridico, nunca
--   fast-track direto pro Dr. Athaydes como o Agente 2 ja faz.
--
-- REUSE > ADAPT > CREATE
--   contract_templates.origem ja e coluna de texto livre (confirmado via
--   schema real, sem CHECK constraint no banco) -- aceita o novo valor
--   "agente_ia_estruturador" sem qualquer alteracao de tipo/constraint.
--   analysis_status/analysis_error/laudo_risco ja existem (usados pelo
--   Agente 2), reaproveitados sem mudanca. Só faltam os 2 campos abaixo,
--   de shape diferente da saida do Agente 2 (que usa laudo_risco).
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 2 colunas novas, nullable. Nenhuma minuta existente
--   afetada (ficam NULL para todo o historico).
-- =============================================================================

alter table public.contract_templates
  add column if not exists brechas_identificadas jsonb,
  add column if not exists observacoes_para_revisor text;

comment on column public.contract_templates.brechas_identificadas is
  'Agente Estruturador de Contratos (02/09/2026): lista de brechas juridicas que o agente identificou na intencao de negocio descrita pela Mesa e ja fechou proativamente na minuta gerada, formato [{clausula, risco, sugestao}]. Nullable -- só populado em minutas com origem=agente_ia_estruturador.';
comment on column public.contract_templates.observacoes_para_revisor is
  'Agente Estruturador de Contratos (02/09/2026): observacoes livres do agente para quem for revisar (ex: ambiguidade na intencao de negocio que impediu uma escolha segura de clausula). Nullable -- só populado em minutas com origem=agente_ia_estruturador.';

-- contract_ai_agent_audit_log.event_type tem CHECK explicito (migration
-- 20260830b), só aceitava os 5 valores do Agente 2. Precisa dos 3 novos
-- para o Agente 1 (estruturacao_concluida/erro) e para "Pedir Ajuste ao
-- Agente" (ajuste_solicitado, compartilhado pelos dois agentes). Postgres
-- não tem ALTER CHECK direto -- drop + add do mesmo jeito, nome default
-- de constraint unica sem nome explicito ({tabela}_{coluna}_check).
alter table public.contract_ai_agent_audit_log
  drop constraint if exists contract_ai_agent_audit_log_event_type_check;

alter table public.contract_ai_agent_audit_log
  add constraint contract_ai_agent_audit_log_event_type_check
  check (event_type in (
    'analise_concluida', 'analise_erro', 'voto_registrado', 'minuta_aprovada', 'minuta_reprovada',
    'estruturacao_concluida', 'estruturacao_erro', 'ajuste_solicitado'
  ));
