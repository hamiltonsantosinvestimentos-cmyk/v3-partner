-- ════════════════════════════════════════════════════════════════
-- FORJA JURIDICO + DISPARO INSTITUCIONAL DE E-MAILS (Etapa 7, 21/08/2026)
-- ════════════════════════════════════════════════════════════════
-- Contexto: BRIEF aprovado por Joao na sessao. Duas pecas novas:
--   1. Parecer Preliminar Executivo (tese interna, nunca publica) por ativo
--   2. Log de auditoria de todo e-mail institucional disparado a partir
--      de um ativo (Solicitacao de Documentos, Link de Qualificacao,
--      Aviso de Minuta NCNDA, Convocacao de Alinhamento)
--
-- Nomeei a tabela cm_communications_log (nao deal_communications_log,
-- nome do prompt original) para bater com a convencao real: as outras
-- 17 tabelas desta vertical sao todas cm_*, nenhuma deal_*.

-- ── 1. Parecer Preliminar Executivo em cm_asset_listings ──────────
-- Mesmo padrao ja usado por public_narrative/public_narrative_generated_at
-- na mesma tabela, mas NUNCA confundir os dois: public_narrative e
-- anonimizado, so classe imovel, pra vitrine publica de compradores.
-- internal_thesis e o parecer interno completo, cita nome/CPF/processo,
-- nunca sai da Mesa/Governanca.
alter table public.cm_asset_listings
  add column if not exists internal_thesis text,
  add column if not exists internal_thesis_generated_at timestamptz;

comment on column public.cm_asset_listings.internal_thesis is
  'Parecer Preliminar Executivo (Forja Juridico, 21/08/2026): sintese interna de cadastro + certidoes/laudos (OCR) + transcricao de audio + due diligence Escavador. NUNCA anonimo, NUNCA exposto na vitrine publica -- ver public_narrative para o equivalente externo.';

-- ── 2. cm_communications_log: dominio novo, nao existia em lugar nenhum ──
create table if not exists public.cm_communications_log (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.cm_asset_listings(id) on delete cascade,
  template_key text not null check (template_key in (
    'solicitacao_documentos', 'link_qualificacao', 'aviso_minuta_ncnda', 'convocacao_alinhamento'
  )),
  sender_key text not null check (sender_key in ('juridico', 'athaydes')),
  sender_email text not null,
  recipient_email text not null,
  subject text not null,
  -- Snapshot do HTML realmente enviado (pos brand-gate), pra auditoria real
  -- do que saiu, nao do que foi digitado antes da correcao automatica.
  body_html text not null,
  brand_gate_violations jsonb not null default '[]'::jsonb,
  status text not null default 'enviado' check (status in ('enviado', 'falhou')),
  error_message text,
  resend_message_id text,
  sent_by uuid not null references auth.users(id),
  sent_at timestamptz not null default now()
);

comment on table public.cm_communications_log is
  'Log de auditoria de e-mails institucionais disparados pela Forja Juridico (21/08/2026). Dominio novo, nao existia em lugar nenhum antes desta migration.';

create index if not exists idx_cm_communications_log_listing on public.cm_communications_log(listing_id, sent_at desc);

alter table public.cm_communications_log enable row level security;

drop policy if exists "mesa le log de comunicacoes" on public.cm_communications_log;
create policy "mesa le log de comunicacoes" on public.cm_communications_log
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
    )
  );

-- Insert e sempre via service_role (rota server-side/n8n), nunca direto do
-- client -- mesmo padrao de cm_status_transitions e outras tabelas de log
-- desta vertical. Nenhuma policy de insert pra authenticated de proposito.
