-- Lembrete de agenda do Kanban de Prospecção Partners (12/10/2026).
-- O pg_cron chama a cada minuto /api/cron/lembrete-agenda-prospeccao, que manda o lembrete no
-- WhatsApp do time 10 minutos antes do horário agendado / da reunião (ver o route.ts).
-- Fica no Supabase e não no vercel.json porque o plano da Vercel só aceita cron diário.
--
-- ANTES de rodar este arquivo, grave o token no Vault (uma vez só). O token é o HMAC da
-- service role (ver tokenLembrete() no route.ts) e é entregue fora do repositório:
--   select vault.create_secret('<TOKEN>', 'lembrete_agenda_token');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotente: recria o job se já existir
select cron.unschedule('lembrete-agenda-prospeccao')
where exists (select 1 from cron.job where jobname = 'lembrete-agenda-prospeccao');

select cron.schedule(
  'lembrete-agenda-prospeccao',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://app.v3partners.com.br/api/cron/lembrete-agenda-prospeccao',
    headers := jsonb_build_object(
      'x-lembrete-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_agenda_token' limit 1)
    ),
    timeout_milliseconds := 30000
  );
  $$
);
