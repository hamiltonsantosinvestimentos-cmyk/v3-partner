-- Nome de exibição dos anexos das propostas de crédito, gerado por leitura com IA.
-- BRIEF: docs/briefs/2026-11-09_nomear-documentos-propostas.md (go com override do Hamilton, 09/11/2026).
-- Só a service role lê e grava: RLS ligada, nenhuma política, acesso de anon e authenticated revogado.
-- Guarda o nome BASE (sem o sufixo de desempate, calculado só na exibição). Não guarda CPF, CNPJ nem conteúdo.

create table public.credit_document_names (
  storage_path  text primary key,
  proposal_id   uuid not null references public.credit_desk_proposals(id) on delete cascade,
  nome_exibicao text check (nome_exibicao is null or char_length(nome_exibicao) <= 120),
  tipo          text,
  periodo       text check (periodo is null or periodo ~ '^[0-9]{4}(-[0-9]{4})?$'),
  titular       text check (titular is null or char_length(titular) <= 100),
  confianca     numeric(3,2) check (confianca is null or (confianca >= 0 and confianca <= 1)),
  status        text not null check (status in ('ok', 'sem_leitura', 'ignorado', 'erro')),
  tentativas    int  not null default 1,
  modelo        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index credit_document_names_proposal_idx on public.credit_document_names (proposal_id);

alter table public.credit_document_names enable row level security;
revoke all on public.credit_document_names from anon, authenticated;

comment on table public.credit_document_names is
  'Nome de exibição dos anexos de credit_desk_proposals.documents, gerado por leitura com IA (BRIEF 2026-11-09). Só service role.';
