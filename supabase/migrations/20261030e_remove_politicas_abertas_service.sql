-- Contenção de segurança, camada 2 (30/10/2026).
-- Defeito: políticas feitas para a chave de serviço ("service_role_all", "service full access")
-- foram criadas com o papel {public} e USING (true). O papel public inclui anon e authenticated,
-- então qualquer usuário logado lia (e nas políticas FOR ALL, escrevia) em tabelas como
-- sdr_conversas, sdr_leads, partner_contracts, partner_subscriptions e partner_registrations.
-- A chave de serviço (service_role) tem BYPASSRLS e NÃO precisa de política; essas políticas só
-- abriam a tabela a todos. Levantamento no código (30/10/2026): as leituras e escritas nessas
-- tabelas usam chave de serviço (webhooks do SDR, rotas /api/*, lib/sdr-agent.ts). Única leitura
-- por sessão de usuário entre as tabelas abaixo: creative_jobs, lido no navegador por
-- components/ma/criativos-panel.tsx (mantida para authenticated).
-- Políticas legítimas que permanecem: sdr_leads (partner_or_staff, sdr_closer_own),
-- sdr_conversas (partner_or_staff_select, sdr_closer_own), partner_subscriptions
-- ("partner sees own subscriptions"), academy_badges e academy_certificates (leitura do próprio
-- usuário), academy_video_overrides (leitura por usuário autenticado).
-- Tabelas sem consumidor no código (people_hub_members, disc_assessments) ficam sem política:
-- só a chave de serviço acessa até alguém confirmar o uso.
-- partner_registrations mantém insert_public (cadastro público); select_admin e update_admin
-- abertos são removidos.
-- Fora desta camada, de propósito (camada 2B): INSERT abertos em document_quarantine,
-- folder_governance_log, partner_service_orders, analise_link_opens, marketplace_suppliers,
-- deal_qa_*, e academy_yt_links / marketplace_product_reviews (leitura pública).
-- Decisão do João (30/10/2026): SDR e CLOSER não leem tudo; o espaço deles é o CRM de prospecção
-- (prospeccao_leads, prospeccao_followups, prospeccao_historico, que não mudam). As políticas
-- "partner_or_staff" de sdr_leads e sdr_conversas liberavam leitura total também a SDR e CLOSER;
-- passam a liberar só ADMIN e GESTAO. SDR e CLOSER seguem vendo apenas os leads atribuídos a eles
-- (responsavel_id), pelas políticas sdr_closer_own já existentes. O partner segue vendo o que é dele.
-- Rollback: ver 20261030e_remove_politicas_abertas_service_rollback.sql.txt

drop policy if exists "service_role_all" on public.partner_contracts;
drop policy if exists "service full access" on public.partner_subscriptions;
drop policy if exists "select_admin" on public.partner_registrations;
drop policy if exists "update_admin" on public.partner_registrations;
drop policy if exists "service_role_all" on public.sdr_leads;
drop policy if exists "service_role_all" on public.sdr_conversas;
drop policy if exists "service inserts sdr conversas" on public.sdr_conversas;
drop policy if exists "service_role_all" on public.sdr_campanha_contatos;
drop policy if exists "service_role_all" on public.sdr_campanhas;
drop policy if exists "service full access sdr_config" on public.sdr_config;
drop policy if exists "service_role_all" on public.sdr_config;
drop policy if exists "service full access sdr flow config" on public.sdr_flow_config;
drop policy if exists "service full access sdr flow stages" on public.sdr_flow_stages;
drop policy if exists "service_role_all" on public.sdr_optouts;
drop policy if exists "service_role full access" on public.instituicoes;
drop policy if exists "service_role full access" on public.instituicoes_linhas;
drop policy if exists "ph_members_delete" on public.people_hub_members;
drop policy if exists "ph_members_insert" on public.people_hub_members;
drop policy if exists "ph_members_select" on public.people_hub_members;
drop policy if exists "ph_members_update" on public.people_hub_members;
drop policy if exists "people_hub_assessment_insert" on public.disc_assessments;
drop policy if exists "ph_assessment_select" on public.disc_assessments;
drop policy if exists "service insert badges" on public.academy_badges;
drop policy if exists "Service inserts certificates" on public.academy_certificates;
drop policy if exists "service can delete overrides" on public.academy_video_overrides;
drop policy if exists "service can upsert overrides" on public.academy_video_overrides;
drop policy if exists "service can update overrides" on public.academy_video_overrides;

-- creative_jobs: a leitura segue necessária ao painel de criativos (navegador, usuário logado),
-- mas deixa de ser aberta a anon.
drop policy if exists "creative_jobs_select" on public.creative_jobs;
create policy creative_jobs_select on public.creative_jobs
  as permissive for select to authenticated using (true);

-- SDR e CLOSER deixam de ler todos os leads e conversas do agente de WhatsApp.
alter policy "sdr_leads_partner_or_staff" on public.sdr_leads
  using (
    (partner_id = auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['ADMIN'::user_role, 'GESTAO'::user_role])
    )
  );

alter policy "sdr_conversas_partner_or_staff_select" on public.sdr_conversas
  using (
    (partner_id = auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['ADMIN'::user_role, 'GESTAO'::user_role])
    )
  );
