-- Política de sigilo (01/11/2026), Bloco D: fim das políticas de leitura (e uma de escrita) abertas a logado ou anônimo.
-- BRIEF: 2026-11-01_Operacional_BRIEF-Seguranca-Leituras-Abertas-a-Usuario-Logado-e-Anonimo_v1.html (QA liberado na rodada indicada no próprio BRIEF).
-- 13 políticas em 12 tabelas. Todas as 71 chamadas do código às 12 tabelas usam a chave de serviço (varredura em
-- origin/main efe6a86d, 43 arquivos), que ignora a RLS. Nenhuma política nova. O que sobra em cada tabela já é só de
-- equipe ou de service_role. operational_tickets fica fora (BRIEF próprio, exige mudar código).
-- Condições do go: logs de 24 horas, ciência do Robson (recebida em 01/11/2026), ensaio por perfil, SQL mostrado e go do João.
-- Rollback: 20261101d_leituras_abertas_fechadas_rollback.sql.txt

drop policy if exists "qa_threads_anon_select" on public.deal_qa_threads;
drop policy if exists "qa_messages_anon_select" on public.deal_qa_messages;
drop policy if exists "Authenticated users can manage action items" on public.meeting_action_items;
drop policy if exists "docs_authenticated_read" on public.docs_ingeridos;
drop policy if exists "generated_reports_read" on public.generated_reports;
drop policy if exists "generated_reports_insert" on public.generated_reports;
drop policy if exists "autenticados podem ler cartas" on public.consorcio_cartas;
drop policy if exists "deal_intakes_authenticated_read" on public.deal_intakes;
drop policy if exists "dps_select_authenticated" on public.deal_partner_submissions;
drop policy if exists "portfolio_read" on public.portfolio_linhas;
drop policy if exists "ip_select_authenticated" on public.integration_partners;
drop policy if exists "mesa_sla_config_read" on public.mesa_sla_config;
drop policy if exists "authenticated read settings" on public.platform_settings;
