-- Migration: add_instituicao_feedback
-- Armazena o parecer/status que a instituição registra sobre a proposta
-- Estrutura: [{ "instituicao": "Oxigênio Capital", "status": "EM_ANALISE", "observacao": "...", "updated_at": "..." }]

alter table public.credit_desk_proposals
  add column if not exists instituicao_feedback jsonb default '[]'::jsonb;

comment on column public.credit_desk_proposals.instituicao_feedback is
  'Pareceres das instituições financeiras: [{instituicao, status, observacao, updated_at}]';
