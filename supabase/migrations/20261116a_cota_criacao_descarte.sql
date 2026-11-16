-- Descarte do log de criação de operações (BRIEF 15/11/2026, item 1.13): o IP some depois de ip_retencao_dias e a linha
-- de contagem depois de log_retencao_meses (valores em creation_quota_config: 90 dias e 12 meses). O IP de quem teve a
-- conta excluída (perfil que deixou de existir) é apagado antes do prazo.
-- Só leitura e escrita nas tabelas da cota. Simulação por padrão: p_real = false conta e não altera nada.
-- Rollback: 20261116a_cota_criacao_descarte_rollback.sql.txt

create or replace function public.creation_log_retention(p_real boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg         public.creation_quota_config%rowtype;
  v_corte_ip  timestamptz;
  v_corte_log timestamptz;
  n_ip        int;
  n_conta     int;
  n_linhas    int;
begin
  select * into cfg from public.creation_quota_config where id;
  if not found then
    return jsonb_build_object('erro', 'sem_configuracao');
  end if;
  v_corte_ip  := now() - make_interval(days => cfg.ip_retencao_dias);
  v_corte_log := now() - make_interval(months => cfg.log_retencao_meses);

  select count(*) into n_ip from public.ma_deal_creation_log
   where ip is not null and created_at < v_corte_ip;
  select count(*) into n_conta from public.ma_deal_creation_log l
   where l.ip is not null and l.created_at >= v_corte_ip and l.actor_kind = 'user'
     and not exists (select 1 from public.profiles p where p.id::text = l.actor_id);
  select count(*) into n_linhas from public.ma_deal_creation_log where created_at < v_corte_log;

  if p_real then
    update public.ma_deal_creation_log l set ip = null
     where l.ip is not null
       and (l.created_at < v_corte_ip
            or (l.actor_kind = 'user' and not exists (select 1 from public.profiles p where p.id::text = l.actor_id)));
    delete from public.ma_deal_creation_log where created_at < v_corte_log;
  end if;

  return jsonb_build_object('real', p_real, 'ip_vencidos', n_ip, 'ip_de_conta_excluida', n_conta, 'linhas_vencidas', n_linhas);
end
$fn$;

revoke execute on function public.creation_log_retention(boolean) from public, anon, authenticated;
grant  execute on function public.creation_log_retention(boolean) to service_role;
