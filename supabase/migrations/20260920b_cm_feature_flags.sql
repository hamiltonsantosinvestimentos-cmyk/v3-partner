-- Fase 5 (20/09/2026, pedido de Joao): chave liga/desliga do gatilho automatico da reuniao
-- inicial (Etapa 2). Enquanto a base e os testes sao saneados (cards excluidos, fixtures),
-- o gatilho fica DESLIGADO e o analista dispara a reuniao manualmente pelo botao
-- "Agendar reuniao". Depois da homologacao, ligar a chave (sem novo deploy) faz o gatilho
-- voltar a ser automatico nos dois lados (venda e compra).
--
-- Tabela generica e pequena de proposito: outras chaves de rollout do modulo CM podem
-- entrar aqui sem migration nova. Leitura e escrita so pelo servidor (service role); nenhuma
-- policy para usuario final, RLS ligado.

create table if not exists public.cm_feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

alter table public.cm_feature_flags enable row level security;

insert into public.cm_feature_flags (key, enabled, description)
values (
  'meeting_autotrigger',
  false,
  'Etapa 2: dispara a reuniao inicial (transicao para reuniao_agendada e link do Google Calendar) automaticamente ao concluir o intake. Desligado = o analista agenda manualmente pelo botao Agendar Reuniao.'
)
on conflict (key) do nothing;

comment on table public.cm_feature_flags is
  'Chaves de rollout do modulo Bolsa de Ativos. Acesso so via servidor (service role).';
