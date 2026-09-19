-- Fase 5, sub-entrega 5.1 (19/09/2026, "go" de Joao): Kanban Unificado de 7
-- etapas. Hoje o estado 'formulario_preenchido' cobre, ao mesmo tempo, o
-- agendamento de reuniao (Etapa 2) e o periodo de qualificacao das partes
-- (Etapa 3), sem distincao visual nenhuma. Dois estados novos separam isso
-- de verdade, cada um com sua propria linha de auditoria em
-- cm_status_transitions (via transition_cm_listing_status(), atualizada na
-- migration seguinte 20260919e).
--
-- reuniao_agendada: entre intake concluido e reuniao efetivamente confirmada
-- pela Mesa. Transicao automatica assim que o formulario de intake fecha
-- (ver app/api/cm/intake/[token]/route.ts).
--
-- em_qualificacao: apos a Mesa confirmar que a reuniao aconteceu, dispara os
-- lotes de qualificacao das partes. Transita pra nda_assinado quando o NCNDA
-- e de fato assinado (mesmo gate ja existente, so a origem muda).
--
-- Enum novo precisa comitar antes de ser referenciado em qualquer funcao ou
-- linha de codigo -- por isso esta migration fica isolada, sem nenhum uso
-- dos valores novos no mesmo arquivo (regra do Postgres pra ALTER TYPE ...
-- ADD VALUE).

alter type cm_listing_status add value if not exists 'reuniao_agendada' after 'formulario_preenchido';
alter type cm_listing_status add value if not exists 'em_qualificacao' after 'reuniao_agendada';
