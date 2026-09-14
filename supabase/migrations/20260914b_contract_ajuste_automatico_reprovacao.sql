-- Ajuste automático de minuta ao reprovar (14/09/2026, pedido de João /
-- Dr. Athaydes): quando um revisor reprova uma minuta com comentário, o
-- sistema agora dispara sozinho um pedido de correção à IA usando o
-- comentário como instrução, em vez de esperar alguém clicar manualmente
-- em "Pedir Ajuste ao Agente" (que só existia pra minuta origem=agente_ia).
--
-- Isso passa a valer pra QUALQUER minuta (17 das 18 minutas reais hoje são
-- origem=manual, incluindo o caso real que motivou o pedido: a minuta
-- "ACORDO DE CONFIDENCIALIDADE... Rio Pardo", reprovada 2x pelo mesmo
-- motivo -- texto genérico de representação de PJ -- sem correção
-- automática nenhuma entre as rodadas).
--
-- Novo evento de auditoria "ajuste_aplicado"/"ajuste_erro" (rota nova
-- app/api/contracts/templates/[id]/revision-callback), fechando o ciclo
-- que "ajuste_solicitado" (já existente) abre.

ALTER TABLE contract_ai_agent_audit_log DROP CONSTRAINT contract_ai_agent_audit_log_event_type_check;

ALTER TABLE contract_ai_agent_audit_log ADD CONSTRAINT contract_ai_agent_audit_log_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'analise_concluida', 'analise_erro', 'voto_registrado', 'minuta_aprovada',
    'minuta_reprovada', 'estruturacao_concluida', 'estruturacao_erro',
    'ajuste_solicitado', 'ajuste_aplicado', 'ajuste_erro'
  ]::text[]));
