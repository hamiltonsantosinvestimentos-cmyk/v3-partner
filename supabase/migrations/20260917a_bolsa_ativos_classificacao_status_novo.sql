-- ============================================================
-- MIGRATION: Bolsa de Ativos — classificação de Direito Creditório
-- (série DC com esfera) + 2 status novos no fluxo de due diligence
-- Date: 2026-09-17
-- Scope: pedido de Joao Lemos — o link de intake gerava numeração
-- ANTES da classificação existir (asset_type="precatorio" fixo em
-- /api/cm/intake/generate) e ainda rodava generate_cm_anonymous_id()
-- (funcao LEGADA), nunca migrada para issueV3Code()/next_v3_code()
-- -- violacao ativa de v3-numbering-governance.md. Investigacao real
-- tambem achou regressao: a funcao legada classificava Direito
-- Creditorio por tipo+esfera (CM-DC-FED-NNNN), mas a serie nova "BA"
-- tem segment_class='setor' (nao aceita FED/EST/MUN como classe --
-- confirmado lendo o corpo real de next_v3_code antes de assumir).
-- Fix: serie propria DC, espelhando PR (Precatorios), em vez de forcar
-- esfera dentro de BA (que quebraria a validacao real da funcao).
--
-- Fluxo de due diligence da Mesa (BRIEF aprovado por Joao 17/09/2026):
-- em_analise passa a poder virar tambem "aprovado_com_restricoes"
-- (mesma autoridade de aprovado_head, texto de restricao obrigatorio)
-- ou "reprovado" (justificativa obrigatoria, reaproveita o campo
-- p_reason que transition_cm_listing_status() ja grava em
-- cm_status_transitions, sem coluna nova).
--
-- Rollback:
--   delete from public.v3_code_series where id = 'DC';
--   -- ALTER TYPE ... DROP VALUE nao existe no Postgres. Os valores
--   -- novos do enum ficam permanentemente definidos mas sem uso se
--   -- este trabalho for revertido (mesmo tipo de decisao ja tomada em
--   -- outras migrations desta governanca).
-- ============================================================

-- 1. Serie DC (Direito Creditorio) — mesma logica de PR (Precatorios):
--    esfera classifica o ativo, nao setor economico.
insert into public.v3_code_series
  (id, label, prefix, segment_class, scope_grain, seq_width, target_table, target_column, notes)
values
  ('DC', 'Direito Creditorio', 'V3-DC', 'esfera', 'ano_mes', 3,
   'cm_asset_listings', 'anonymous_id',
   'Sucede CM-DC-FED-NNNN (funcao legada generate_cm_anonymous_id, que ja classificava direito creditorio por esfera). Serie propria em vez de forcar esfera dentro de BA porque BA tem segment_class=''setor'' e next_v3_code() recusaria FED/EST/MUN como classe dessa serie.')
on conflict (id) do nothing;

-- 2. Dois status novos no fluxo de due diligence da Bolsa de Ativos.
--    ADD VALUE nao pode ser usado na mesma transacao que uma DML/DDL
--    que referencia o valor novo -- por isso a funcao de transicao que
--    usa esses valores vive em migration separada (20260917b).
alter type public.cm_listing_status add value if not exists 'aprovado_com_restricoes' after 'aprovado_head';
alter type public.cm_listing_status add value if not exists 'reprovado' after 'aprovado_com_restricoes';
