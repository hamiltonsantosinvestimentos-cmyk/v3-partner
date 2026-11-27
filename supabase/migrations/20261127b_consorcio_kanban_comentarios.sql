-- =============================================================================
-- Kanban de Consórcio › Projetos: etapas de acompanhamento das ofertas + comentários
-- BRIEF docs/briefs/2026-11-27_kanban-consorcio-projetos.md (go mesmo assim do Hamilton, 27/11/2026)
--
-- 1. consorcio_ofertas: 3 colunas novas, nullable (etapa com default 'NOVA'; null é exibido como Nova).
-- 2. consorcio_ofertas: remove a policy de UPDATE "admin pode atualizar ofertas" (achado do QA):
--    nenhum código grava nessa tabela pela sessão do usuário (POST e aceite usam service role),
--    e a policy deixava ADMIN/GESTAO/MESA_OPERACIONAL alterarem qualquer coluna pela REST.
-- 3. consorcio_comentarios: tabela nova, só service role (RLS sem policy, revoke de anon e authenticated).
-- Reversão: 20261127b_consorcio_kanban_comentarios.rollback.sql.txt
-- =============================================================================

alter table public.consorcio_ofertas
  add column if not exists etapa text default 'NOVA',
  add column if not exists etapa_atualizada_em timestamptz,
  add column if not exists etapa_atualizada_por uuid references public.profiles(id);

do $$ begin
  alter table public.consorcio_ofertas add constraint consorcio_ofertas_etapa_ck
    check (etapa is null or etapa in ('NOVA','EM_CONTATO','NEGOCIANDO','DOCUMENTACAO','CONCLUIDA','PERDIDA'));
exception when duplicate_object then null; end $$;

drop policy if exists "admin pode atualizar ofertas" on public.consorcio_ofertas;

create table if not exists public.consorcio_comentarios (
  id               uuid primary key default gen_random_uuid(),
  alvo_tipo        text not null check (alvo_tipo in ('CONTRATACAO','OFERTA')),
  alvo_id          uuid not null,
  autor_id         uuid not null references public.profiles(id),
  texto            text not null check (char_length(texto) between 1 and 2000),
  visivel_partner  boolean not null default true,
  evento           boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists consorcio_comentarios_alvo_idx on public.consorcio_comentarios (alvo_tipo, alvo_id, created_at);
create index if not exists consorcio_comentarios_autor_idx on public.consorcio_comentarios (autor_id, created_at desc);

alter table public.consorcio_comentarios enable row level security;
revoke all on public.consorcio_comentarios from anon, authenticated;

comment on table public.consorcio_comentarios is
  'Comentários e histórico dos itens do Kanban de Consórcio › Projetos (BRIEF 2026-11-27). Só service role.';
