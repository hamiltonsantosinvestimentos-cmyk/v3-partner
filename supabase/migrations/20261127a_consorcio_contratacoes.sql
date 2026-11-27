-- =============================================================================
-- Contratação de cotas novas de consórcio (quiz em Consórcio › Projetos)
-- BRIEF docs/briefs/2026-11-27_contratar-cota-nova-em-projetos.md
--
-- Tabela nova, só service role: RLS ligada, nenhuma policy e revoke de anon e
-- authenticated. O recorte por papel fica nas rotas /api/consorcio/contratacoes
-- (exceção declarada no BRIEF, aceita no go mesmo assim do Hamilton em 27/11/2026).
-- Nenhum DROP, nenhum UPDATE em dado existente.
-- Reversão: 20261127a_consorcio_contratacoes.rollback.sql.txt
-- =============================================================================

create table if not exists public.consorcio_contratacoes (
  id                     uuid primary key default gen_random_uuid(),
  code                   text unique,
  segmento               text not null check (segmento in ('IMOVEL','VEICULO','PESADO','MOTO','SERVICO')),
  valor_credito          numeric(14,2) not null check (valor_credito > 0 and valor_credito <= 10000000),
  parcela_maxima         numeric(14,2) not null check (parcela_maxima > 0),
  prazo_meses            integer not null check (prazo_meses between 6 and 240),
  tem_lance              boolean not null default false,
  lance_valor            numeric(14,2),
  quando                 text not null check (quando in ('IMEDIATO','ATE_12_MESES','SEM_PRESSA')),
  cliente_nome           text not null,
  cliente_whatsapp       text not null,
  cliente_email          text,
  consentimento_em       timestamptz not null,
  consentimento_texto    text not null,
  status                 text not null default 'NOVA' check (status in ('NOVA','EM_COTACAO','PROPOSTA_ENVIADA','CONTRATADA','NAO_SEGUIU')),
  status_atualizado_em   timestamptz,
  status_atualizado_por  uuid references public.profiles(id),
  created_by             uuid not null references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  constraint consorcio_contratacoes_parcela_ck check (parcela_maxima <= valor_credito),
  constraint consorcio_contratacoes_lance_ck check (
    (tem_lance and lance_valor is not null and lance_valor > 0 and lance_valor < valor_credito)
    or (not tem_lance and lance_valor is null)
  )
);

create index if not exists consorcio_contratacoes_created_by_idx on public.consorcio_contratacoes (created_by);
create index if not exists consorcio_contratacoes_status_idx on public.consorcio_contratacoes (status, created_at desc);

alter table public.consorcio_contratacoes enable row level security;
revoke all on public.consorcio_contratacoes from anon, authenticated;

comment on table public.consorcio_contratacoes is
  'Pedidos de cota nova de consórcio (BRIEF 2026-11-27). Só service role; acesso por papel nas rotas /api/consorcio/contratacoes.';
