-- Chat Partners v2 (26/10/2026): leitura (✓✓), responsável pela conversa, alerta de SLA,
-- anexos, cartão de proposta, avisos automáticos, notas internas e respostas prontas.
-- Tudo aditivo (colunas novas nullable + tabelas novas). Rodar no SQL Editor do Supabase.

-- ── 1. Mensagens: anexos, proposta vinculada e tipo ─────────────────────────
alter table public.chat_messages
  add column if not exists anexos jsonb,          -- [{ path, nome, tipo, tamanho }] no bucket chat-anexos
  add column if not exists proposta_id uuid,      -- cartão da proposta (credit_desk_proposals.id)
  add column if not exists tipo text not null default 'mensagem';  -- 'mensagem' | 'sistema'

create index if not exists chat_messages_room_created_idx on public.chat_messages (room_id, created_at desc);
create index if not exists chat_messages_proposta_idx on public.chat_messages (proposta_id) where proposta_id is not null;

-- ── 2. Estado de cada conversa (uma linha por sala) ─────────────────────────
create table if not exists public.chat_conversas (
  room_id           text primary key,
  mesa_lido_ate     timestamptz,                  -- até onde a Mesa leu
  partner_lido_ate  timestamptz,                  -- até onde o partner leu (✓✓)
  responsavel_id    uuid,
  responsavel_nome  text,
  sla_alertado_em   timestamptz,                  -- último alerta de SLA enviado
  updated_at        timestamptz not null default now()
);

-- ── 3. Notas internas (a Mesa vê, o partner nunca vê) ──────────────────────
-- Tabela separada de chat_messages de propósito: o widget do partner lê chat_messages
-- em tempo real, então nota interna lá dentro vazaria.
create table if not exists public.chat_notas_internas (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  autor_id    uuid,
  autor_nome  text,
  conteudo    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists chat_notas_internas_room_idx on public.chat_notas_internas (room_id, created_at desc);

-- ── 4. Respostas prontas (/atalho no campo de mensagem) ─────────────────────
create table if not exists public.chat_respostas_prontas (
  id          uuid primary key default gen_random_uuid(),
  atalho      text not null unique,
  titulo      text not null,
  texto       text not null,
  criado_por  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.chat_respostas_prontas (atalho, titulo, texto) values
  ('docs-pf', 'Documentos pessoa física', 'Para seguir com a análise de pessoa física precisamos de: RG ou CNH, CPF, comprovante de residência atualizado (até 90 dias), comprovante de renda (3 últimos holerites ou extratos) e certidão de estado civil. Pode mandar por aqui mesmo.'),
  ('docs-pj', 'Documentos pessoa jurídica', 'Para pessoa jurídica precisamos de: contrato social e última alteração, cartão CNPJ, faturamento dos últimos 12 meses assinado pelo contador, último balanço/DRE e documentos dos sócios (RG/CNH, CPF e comprovante de residência). Pode mandar por aqui mesmo.'),
  ('prazo-analise', 'Prazo da análise', 'Com a documentação completa, a análise leva em média de 3 a 5 dias úteis. Avisamos por aqui assim que a proposta mudar de etapa.'),
  ('comissao', 'Comissão', 'A comissão é gerada automaticamente quando o recurso é liberado ao cliente e fica disponível na aba Comissões após a autorização do financeiro. Qualquer dúvida sobre valores, me chama aqui.'),
  ('recebido', 'Documento recebido', 'Recebemos, obrigado! Já anexei à proposta e seguimos com a análise.'),
  ('pendencia', 'Pendência', 'Identificamos uma pendência na proposta. Pode verificar a aba Documentos da proposta e nos enviar o que falta? Assim conseguimos seguir.')
on conflict (atalho) do nothing;

-- RLS: as rotas usam service role; ninguém acessa estas tabelas direto pelo navegador.
alter table public.chat_conversas enable row level security;
alter table public.chat_notas_internas enable row level security;
alter table public.chat_respostas_prontas enable row level security;
drop policy if exists "mesa le conversas" on public.chat_conversas;
create policy "mesa le conversas" on public.chat_conversas for select
  using (get_user_role()::text in ('ADMIN','GESTAO','MESA_OPERACIONAL'));
drop policy if exists "mesa le notas" on public.chat_notas_internas;
create policy "mesa le notas" on public.chat_notas_internas for select
  using (get_user_role()::text in ('ADMIN','GESTAO','MESA_OPERACIONAL'));
drop policy if exists "mesa le respostas" on public.chat_respostas_prontas;
create policy "mesa le respostas" on public.chat_respostas_prontas for select
  using (get_user_role()::text in ('ADMIN','GESTAO','MESA_OPERACIONAL'));

-- ── 5. Segurança: cada partner só lê a própria conversa ─────────────────────
-- Antes: "authenticated read chat" deixava qualquer usuário logado ler TODAS as conversas
-- direto pelo banco. Agora: a Mesa lê tudo; o partner só a sala partner_<id dele>.
drop policy if exists "authenticated read chat" on public.chat_messages;
drop policy if exists "chat leitura mesa ou propria sala" on public.chat_messages;
create policy "chat leitura mesa ou propria sala" on public.chat_messages for select
  using (
    get_user_role()::text in ('ADMIN','GESTAO','MESA_OPERACIONAL')
    or room_id = 'partner_' || auth.uid()::text
  );
drop policy if exists "authenticated write chat" on public.chat_messages;
drop policy if exists "chat escrita mesa ou propria sala" on public.chat_messages;
create policy "chat escrita mesa ou propria sala" on public.chat_messages for insert
  with check (
    get_user_role()::text in ('ADMIN','GESTAO','MESA_OPERACIONAL')
    or room_id = 'partner_' || auth.uid()::text
  );

-- ── 6. Bucket privado dos anexos do chat ────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-anexos', 'chat-anexos', false, 15728640)
on conflict (id) do nothing;
