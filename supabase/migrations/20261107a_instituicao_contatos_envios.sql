-- Encaminhar proposta para Instituição por e-mail (BRIEF docs/briefs/2026-11-06_encaminhar-proposta-instituicao.md)
-- Contatos das instituições (vários e-mails, UF do gerente), registro dos envios, situação por
-- destinatário (webhook do Resend) e log bruto dos eventos. Tudo fechado para anon e authenticated:
-- acesso só pelas rotas de servidor, depois de conferir o papel (ADMIN, GESTAO, MESA_OPERACIONAL).

begin;

create table if not exists public.instituicao_contatos (
  id              uuid primary key default gen_random_uuid(),
  instituicao_id  uuid not null references public.instituicoes(id) on delete cascade,
  nome            text check (nome is null or char_length(nome) <= 120),
  email           text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  uf              text check (uf is null or uf ~ '^[A-Z]{2}$'),
  cargo           text not null default 'Gerente de atendimento' check (char_length(cargo) <= 80),
  telefone        text check (telefone is null or telefone ~ '^\+[1-9][0-9]{9,14}$'),
  principal       boolean not null default false,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists instituicao_contatos_email_uq on public.instituicao_contatos (instituicao_id, lower(email));
create index if not exists instituicao_contatos_inst_idx on public.instituicao_contatos (instituicao_id);

create table if not exists public.credit_proposal_envios (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references public.credit_desk_proposals(id) on delete cascade,
  instituicao_id    uuid references public.instituicoes(id) on delete set null,
  instituicao_nome  text not null,
  destinatarios     text[] not null default '{}',
  assunto           text not null,
  mensagem          text check (mensagem is null or char_length(mensagem) <= 2000),
  documentos        jsonb not null default '[]'::jsonb,
  partes            int not null default 1 check (partes >= 1),
  resend_ids        text[] not null default '{}',
  status            text not null default 'enviando' check (status in ('enviando','enviado','parcial','falha')),
  erro              text,
  enviado_por       uuid references public.profiles(id),
  enviado_por_nome  text,
  enviado_em        timestamptz not null default now()
);
create index if not exists credit_proposal_envios_prop_idx on public.credit_proposal_envios (proposal_id, enviado_em desc);
create index if not exists credit_proposal_envios_data_idx on public.credit_proposal_envios (enviado_em desc);

create table if not exists public.credit_proposal_envio_destinatarios (
  id                uuid primary key default gen_random_uuid(),
  envio_id          uuid not null references public.credit_proposal_envios(id) on delete cascade,
  email             text not null,
  nome              text,
  fora_do_cadastro  boolean not null default false,
  parte             int not null default 1,
  resend_id         text unique,
  status            text not null default 'enviado' check (status in ('enviado','entregue','aberto','atrasado','devolvido','spam','falha')),
  motivo            text,
  enviado_em        timestamptz,
  entregue_em       timestamptz,
  aberto_em         timestamptz,
  devolvido_em      timestamptz,
  -- Reenvio (e-mail corrigido): a tentativa antiga aponta para a nova e sai do cálculo da situação.
  substituido_por   uuid references public.credit_proposal_envio_destinatarios(id),
  atualizado_em     timestamptz not null default now()
);
create index if not exists credit_proposal_envio_dest_envio_idx on public.credit_proposal_envio_destinatarios (envio_id);

create table if not exists public.email_eventos (
  id           uuid primary key default gen_random_uuid(),
  svix_id      text not null unique,
  resend_id    text,
  tipo         text not null,
  destinatario text,
  ocorrido_em  timestamptz,
  recebido_em  timestamptz not null default now()
);
create index if not exists email_eventos_resend_idx on public.email_eventos (resend_id);

-- Contatos que já existiam no cadastro viram os primeiros contatos.
-- O campo contato_email às vezes traz mais de um e-mail ("a@x.com.br/  b@x.com.br") ou texto junto
-- ("a@x.com.br nome"): separa por espaço, ; , / | e importa só o que é e-mail. O primeiro e-mail
-- válido da instituição vira o principal e recebe o contato_nome. Campo sem nenhum e-mail fica de
-- fora (cadastrar à mão). O campo email entra depois, sem repetir, e só vira principal se for o único.
insert into public.instituicao_contatos (instituicao_id, nome, email, principal)
select v.instituicao_id, case when v.n = 1 then v.contato_nome end, v.email, v.n = 1
from (
  select i.id as instituicao_id, nullif(trim(i.contato_nome), '') as contato_nome, lower(t.tok) as email,
         row_number() over (partition by i.id order by t.ord) as n
  from public.instituicoes i
  cross join lateral regexp_split_to_table(coalesce(i.contato_email, ''), '[\s;,/|]+') with ordinality as t(tok, ord)
  where t.tok ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
) v
on conflict do nothing;
insert into public.instituicao_contatos (instituicao_id, email, principal)
select i.id, lower(trim(i.email)),
       not exists (select 1 from public.instituicao_contatos c where c.instituicao_id = i.id)
from public.instituicoes i
where nullif(trim(i.email), '') is not null
  and trim(i.email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
on conflict do nothing;

alter table public.instituicao_contatos                enable row level security;
alter table public.credit_proposal_envios              enable row level security;
alter table public.credit_proposal_envio_destinatarios enable row level security;
alter table public.email_eventos                       enable row level security;

revoke all on public.instituicao_contatos                from anon, authenticated;
revoke all on public.credit_proposal_envios              from anon, authenticated;
revoke all on public.credit_proposal_envio_destinatarios from anon, authenticated;
revoke all on public.email_eventos                       from anon, authenticated;

commit;
