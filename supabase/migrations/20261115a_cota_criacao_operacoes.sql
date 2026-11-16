-- Cota, bloqueio e rastro de criação de operações (BRIEF 15/11/2026, QA liberado na rodada 5).
-- Motivo: em 12/11/2026 uma conta de partner criou 584 operações em 22 minutos, copiando anúncios
-- de portal. O app não tinha limite de criação nem exigia conteúdo mínimo.
--
-- Objetos novos (nada existente é alterado, tudo backward compatible):
--   creation_quota_config       uma linha: limites e as duas chaves (IP e bloqueio automático), ambas DESLIGADAS.
--   ma_deal_creation_log        contadores e negações por ator (usuário ou token), com IP só se a chave ligar.
--   partner_creation_controls   bloqueio manual/automático e exceção de limite por usuário.
--   reserve_creation_slot()     verifica e reserva a vaga em uma operação atômica; devolve a negação, nunca levanta erro.
--   release_creation_slot()     devolve a vaga se a criação falhar depois da reserva.
-- Política de sigilo: as três tabelas ficam sem política para qualquer perfil externo (RLS ligada, nenhuma
-- política, revoke all de anon e authenticated). Só a chave de serviço, pela API, lê e escreve.
-- Rollback: 20261115a_cota_criacao_operacoes_rollback.sql.txt

create table if not exists public.creation_quota_config (
  id                         boolean primary key default true check (id),
  hora                       int     not null default 10  check (hora between 1 and 1000),
  dia                        int     not null default 20  check (dia between 1 and 10000),
  intervalo_s                int     not null default 60  check (intervalo_s between 0 and 3600),
  token_hora                 int     not null default 3   check (token_hora between 1 and 1000),
  token_dia                  int     not null default 10  check (token_dia between 1 and 10000),
  token_intervalo_s          int     not null default 10  check (token_intervalo_s between 0 and 3600),
  ip_registro_ativo          boolean not null default false,
  bloqueio_automatico_ativo  boolean not null default false,
  ip_retencao_dias           int     not null default 90  check (ip_retencao_dias between 1 and 3650),
  log_retencao_meses         int     not null default 12  check (log_retencao_meses between 1 and 120),
  updated_by                 uuid,
  updated_at                 timestamptz not null default now()
);
insert into public.creation_quota_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.ma_deal_creation_log (
  id          uuid primary key default gen_random_uuid(),
  actor_kind  text not null check (actor_kind in ('user', 'token')),
  actor_id    text not null,
  via         text not null,
  outcome     text not null check (outcome in ('ok', 'negado_intervalo', 'negado_hora', 'negado_dia', 'negado_bloqueio', 'cancelado')),
  ip          inet,
  created_at  timestamptz not null default now()
);
create index if not exists ma_deal_creation_log_ator_idx on public.ma_deal_creation_log (actor_kind, actor_id, created_at desc);
create index if not exists ma_deal_creation_log_created_idx on public.ma_deal_creation_log (created_at);

create table if not exists public.partner_creation_controls (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  blocked_until  timestamptz,
  block_reason   text,
  blocked_by     uuid,
  override_hora  int check (override_hora is null or override_hora between 1 and 1000),
  override_dia   int check (override_dia is null or override_dia between 1 and 10000),
  updated_at     timestamptz not null default now()
);

-- updated_at pelo gatilho padrão que já existe no banco (a tabela de log é só de inclusão, sem updated_at).
drop trigger if exists trg_creation_quota_config_updated_at on public.creation_quota_config;
create trigger trg_creation_quota_config_updated_at before update on public.creation_quota_config
  for each row execute function public.set_updated_at();
drop trigger if exists trg_partner_creation_controls_updated_at on public.partner_creation_controls;
create trigger trg_partner_creation_controls_updated_at before update on public.partner_creation_controls
  for each row execute function public.set_updated_at();

alter table public.creation_quota_config      enable row level security;
alter table public.ma_deal_creation_log       enable row level security;
alter table public.partner_creation_controls  enable row level security;
revoke all on public.creation_quota_config      from anon, authenticated;
revoke all on public.ma_deal_creation_log       from anon, authenticated;
revoke all on public.partner_creation_controls  from anon, authenticated;

-- Verifica e reserva em uma operação. O advisory lock serializa o mesmo ator, então requisições
-- paralelas não passam todas pelo "ainda tem cota".
-- Devolve sempre um jsonb: {allowed, reason, retry_after_seconds, blocked_until, log_id, alerta_cota}.
-- Em erro interno devolve reason = 'erro_interno' (allowed nulo) em vez de levantar exceção, porque um
-- raise desfaria a gravação da negação e do bloqueio. Quem decide o que fazer com o erro é a rota.
create or replace function public.reserve_creation_slot(
  p_actor_kind text,
  p_actor_id   text,
  p_via        text,
  p_ip         inet default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg          public.creation_quota_config%rowtype;
  ctrl         public.partner_creation_controls%rowtype;
  v_uid        uuid;
  v_role       text;
  v_now        timestamptz := now();
  v_lim_hora   int;
  v_lim_dia    int;
  v_intervalo  int;
  v_n_hora     int;
  v_n_dia      int;
  v_ultimo     timestamptz;
  v_mais_ant_h timestamptz;
  v_mais_ant_d timestamptz;
  v_ip         inet;
  v_log        uuid;
  v_retry      int;
  v_outcome    text;
  v_alerta     boolean := false;
  v_parceria   boolean := (p_via = 'parceria');
begin
  if p_actor_kind not in ('user', 'token') or coalesce(btrim(p_actor_id), '') = '' or coalesce(btrim(p_via), '') = '' then
    return jsonb_build_object('allowed', false, 'reason', 'invalido');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_kind || ':' || p_actor_id));

  select * into cfg from public.creation_quota_config where id;
  if not found then
    return jsonb_build_object('allowed', null, 'reason', 'erro_interno');
  end if;

  if p_actor_kind = 'user' then
    v_uid := p_actor_id::uuid;
    select role::text into v_role from public.profiles where id = v_uid;
    -- Nega por padrão: só estes papéis são isentos. Papel desconhecido, ausente ou futuro sofre a cota.
    if v_role in ('ADMIN', 'GESTAO', 'MESA', 'MESA_OPERACIONAL') then
      return jsonb_build_object('allowed', true, 'reason', 'isento', 'log_id', null);
    end if;
    select * into ctrl from public.partner_creation_controls where user_id = v_uid;
    v_lim_hora  := coalesce(ctrl.override_hora, cfg.hora);
    v_lim_dia   := coalesce(ctrl.override_dia, cfg.dia);
    v_intervalo := cfg.intervalo_s;
    v_ip        := case when cfg.ip_registro_ativo then p_ip else null end;
  else
    -- Cliente externo de link público: limites próprios, sem papel, sem bloqueio de pessoa, nunca grava IP.
    v_lim_hora  := cfg.token_hora;
    v_lim_dia   := cfg.token_dia;
    v_intervalo := cfg.token_intervalo_s;
    v_ip        := null;
  end if;

  -- (a) Bloqueio vigente. Não renova nem prolonga o prazo. A adesão de parceria nunca é barrada por aqui.
  if p_actor_kind = 'user' and not v_parceria and ctrl.blocked_until is not null and ctrl.blocked_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (ctrl.blocked_until - v_now)))::int);
    if not exists (
      select 1 from public.ma_deal_creation_log
      where actor_kind = p_actor_kind and actor_id = p_actor_id and outcome = 'negado_bloqueio' and created_at > v_now - interval '1 hour'
    ) then
      insert into public.ma_deal_creation_log (actor_kind, actor_id, via, outcome, ip) values (p_actor_kind, p_actor_id, p_via, 'negado_bloqueio', v_ip);
    end if;
    return jsonb_build_object('allowed', false, 'reason', 'bloqueado', 'retry_after_seconds', v_retry, 'blocked_until', ctrl.blocked_until);
  end if;

  -- (b) Intervalo mínimo desde o último cadastro aceito. Só devolve a negação, nunca bloqueia.
  select max(created_at) into v_ultimo from public.ma_deal_creation_log
   where actor_kind = p_actor_kind and actor_id = p_actor_id and outcome = 'ok';
  if v_ultimo is not null and v_intervalo > 0 and v_ultimo > v_now - make_interval(secs => v_intervalo) then
    v_retry := greatest(1, ceil(extract(epoch from (v_ultimo + make_interval(secs => v_intervalo) - v_now)))::int);
    if not exists (
      select 1 from public.ma_deal_creation_log
      where actor_kind = p_actor_kind and actor_id = p_actor_id and outcome = 'negado_intervalo' and created_at > v_now - interval '1 hour'
    ) then
      insert into public.ma_deal_creation_log (actor_kind, actor_id, via, outcome, ip) values (p_actor_kind, p_actor_id, p_via, 'negado_intervalo', v_ip);
    end if;
    return jsonb_build_object('allowed', false, 'reason', 'intervalo', 'retry_after_seconds', v_retry);
  end if;

  -- (c) Cota da hora e do dia (conta só 'ok', somando todas as vias do mesmo ator). A adesão de parceria
  -- só sofre o intervalo, nunca a cota nem o bloqueio.
  if not v_parceria then
    select count(*), min(created_at) into v_n_hora, v_mais_ant_h from public.ma_deal_creation_log
     where actor_kind = p_actor_kind and actor_id = p_actor_id and outcome = 'ok' and created_at > v_now - interval '1 hour';
    select count(*), min(created_at) into v_n_dia, v_mais_ant_d from public.ma_deal_creation_log
     where actor_kind = p_actor_kind and actor_id = p_actor_id and outcome = 'ok' and created_at > v_now - interval '24 hours';

    if v_n_hora >= v_lim_hora or v_n_dia >= v_lim_dia then
      v_outcome := case when v_n_dia >= v_lim_dia then 'negado_dia' else 'negado_hora' end;
      v_retry := greatest(
        case when v_n_hora >= v_lim_hora then ceil(extract(epoch from (v_mais_ant_h + interval '1 hour' - v_now)))::int else 0 end,
        case when v_n_dia  >= v_lim_dia  then ceil(extract(epoch from (v_mais_ant_d + interval '24 hours' - v_now)))::int else 0 end,
        1);
      -- Aviso interno (alerta A): só na primeira recusa por hora ou dia de cada ator em 24 horas.
      v_alerta := not exists (
        select 1 from public.ma_deal_creation_log
        where actor_kind = p_actor_kind and actor_id = p_actor_id and outcome in ('negado_hora', 'negado_dia') and created_at > v_now - interval '24 hours'
      );
      -- Grava a negação no máximo uma vez por hora por ator e resultado (robô insistente não enche a tabela).
      if not exists (
        select 1 from public.ma_deal_creation_log
        where actor_kind = p_actor_kind and actor_id = p_actor_id and outcome = v_outcome and created_at > v_now - interval '1 hour'
      ) then
        insert into public.ma_deal_creation_log (actor_kind, actor_id, via, outcome, ip) values (p_actor_kind, p_actor_id, p_via, v_outcome, v_ip);
      end if;
      -- Bloqueio automático de 24 horas fixas: só com a chave ligada e só para usuário (nunca token).
      if cfg.bloqueio_automatico_ativo and p_actor_kind = 'user' then
        insert into public.partner_creation_controls (user_id, blocked_until, block_reason, blocked_by, updated_at)
        values (v_uid, v_now + interval '24 hours',
                case when v_outcome = 'negado_dia' then 'cota_diaria_excedida' else 'cota_horaria_excedida' end, null, v_now)
        on conflict (user_id) do update
          set blocked_until = excluded.blocked_until, block_reason = excluded.block_reason, blocked_by = null, updated_at = v_now;
        return jsonb_build_object('allowed', false, 'reason', 'bloqueio_automatico', 'retry_after_seconds', 86400,
                                  'blocked_until', v_now + interval '24 hours', 'alerta_cota', v_alerta);
      end if;
      return jsonb_build_object('allowed', false, 'reason', case when v_outcome = 'negado_dia' then 'dia' else 'hora' end,
                                'retry_after_seconds', v_retry, 'alerta_cota', v_alerta);
    end if;
  end if;

  -- (d) Reserva a vaga.
  insert into public.ma_deal_creation_log (actor_kind, actor_id, via, outcome, ip)
  values (p_actor_kind, p_actor_id, p_via, 'ok', v_ip) returning id into v_log;
  return jsonb_build_object('allowed', true, 'reason', 'ok', 'log_id', v_log);

exception when others then
  return jsonb_build_object('allowed', null, 'reason', 'erro_interno');
end
$fn$;

-- Devolve a vaga quando a criação falha depois da reserva: a linha vira 'cancelado' e não conta na cota.
create or replace function public.release_creation_slot(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.ma_deal_creation_log set outcome = 'cancelado' where id = p_log_id and outcome = 'ok';
end
$fn$;

revoke execute on function public.reserve_creation_slot(text, text, text, inet) from public, anon, authenticated;
revoke execute on function public.release_creation_slot(uuid)                   from public, anon, authenticated;
grant  execute on function public.reserve_creation_slot(text, text, text, inet) to service_role;
grant  execute on function public.release_creation_slot(uuid)                   to service_role;
