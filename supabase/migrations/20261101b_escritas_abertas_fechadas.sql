-- Política de sigilo (01/11/2026), Bloco B: fim das políticas de escrita com condição true.
-- BRIEF: 2026-11-01_Operacional_BRIEF-Seguranca-Funcoes-Abertas-Escritas-Abertas-e-Chat-do-Partner_v1.html (QA liberado na rodada 2).
-- Nenhuma escrita legítima usa a sessão do usuário (código varrido em 01/11/2026): as rotas gravam com a chave de
-- serviço, que ignora a RLS. Nenhuma política nova é criada. 12 políticas em 10 tabelas.
-- Condições do go: resposta escrita do Robson, conferência do n8n e dos logs, ensaio por perfil, SQL mostrado e go do João.
-- Rollback: 20261101b_escritas_abertas_fechadas_rollback.sql.txt

drop policy if exists "alo_insert" on public.analise_link_opens;
drop policy if exists "deal_intakes_authenticated_insert" on public.deal_intakes;
drop policy if exists "deal_intakes_authenticated_update" on public.deal_intakes;
drop policy if exists "qa_messages_anon_insert" on public.deal_qa_messages;
drop policy if exists "qa_threads_anon_insert" on public.deal_qa_threads;
drop policy if exists "docs_authenticated_insert" on public.docs_ingeridos;
drop policy if exists "docs_authenticated_update" on public.docs_ingeridos;
drop policy if exists "system_insert_quarantine" on public.document_quarantine;
drop policy if exists "insert_logs" on public.folder_governance_log;
drop policy if exists "suppliers_insert" on public.marketplace_suppliers;
drop policy if exists "insert_public" on public.partner_registrations;
drop policy if exists "pso_insert" on public.partner_service_orders;
