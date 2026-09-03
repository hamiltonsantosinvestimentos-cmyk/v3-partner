-- =============================================================================
-- FIX: contract_templates.origem nunca aceitou agente_ia_estruturador
-- =============================================================================
--
-- P0 REAL, achado ao testar o Agente Estruturador de Contratos ao vivo em
-- producao (03/09/2026). A migration 20260902b partiu de uma suposicao
-- ERRADA: que contract_templates.origem era coluna de texto livre, sem
-- CHECK constraint no banco (baseado em types/supabase.ts mostrar so
-- `string`, sem enum). Isso so cobre ENUM real do Postgres, nao CHECK
-- constraints sobre coluna TEXT -- e a coluna JA tinha um CHECK desde a
-- migration do Fast-Track (20260830_fast_track_contratos_simples.sql):
--   CHECK (origem IN ('manual', 'agente_ia'))
-- Toda tentativa de criar minuta com origem='agente_ia_estruturador'
-- (Agente 1) falhava com 500 real:
--   "new row for relation contract_templates violates check constraint
--    contract_templates_origem_check"
-- Confirmado real via teste direto contra a API de producao antes de
-- escrever este fix, nao presumido: origem='agente_ia' passa (constraint
-- existe e bate com o texto acima), origem='agente_ia_estruturador' falha.
--
-- SEGURANCA EM PRODUCAO
--   So amplia a lista de valores aceitos, nenhum dado existente e tocado.
--   Nome de constraint confirmado pela mensagem de erro real da API
--   (nome default do Postgres para CHECK de coluna sem nome explicito).
-- =============================================================================

alter table public.contract_templates
  drop constraint if exists contract_templates_origem_check;

alter table public.contract_templates
  add constraint contract_templates_origem_check
  check (origem in ('manual', 'agente_ia', 'agente_ia_estruturador'));

comment on column public.contract_templates.origem is
  'manual = criada por humano (fluxo original); agente_ia = Agente Revisor e Sanitizador de Riscos (Fast-Track, 30/08/2026, a partir de upload de contrato recebido); agente_ia_estruturador = Agente Estruturador de Contratos (02/09/2026, a partir de intencao de negocio em texto livre, sempre cai em rascunho).';
