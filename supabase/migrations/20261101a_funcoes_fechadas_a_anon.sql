-- Política de sigilo (01/11/2026), Bloco A: função SECURITY DEFINER só executa quem deve.
-- BRIEF: 2026-11-01_Operacional_BRIEF-Seguranca-Funcoes-Abertas-Escritas-Abertas-e-Chat-do-Partner_v1.html (QA liberado na rodada 2).
-- Todos os chamadores usam a chave de serviço (código varrido em 01/11/2026); service_role mantém EXECUTE.
-- has_compliance_dashboard_access e user_can_access_team_room são avaliadas por políticas: seguem para authenticated, saem do anônimo.
-- Não mexe em get_user_role (usada por quase todas as políticas) nem em funções de gatilho (não chamáveis pela API).
-- Condições do go: resposta escrita do Robson, conferência do n8n e dos logs, ensaio por perfil, SQL mostrado e go do João.
-- Rollback: 20261101a_funcoes_fechadas_a_anon_rollback.sql.txt

revoke execute on function public.search_documents_rag(vector, uuid, text, integer, double precision) from public, anon, authenticated;
revoke execute on function public.cancel_and_edit_contract(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_deal_folder(text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.next_v3_code(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.increment_link_uses(uuid) from public, anon, authenticated;
revoke execute on function public.increment_link_revenue(uuid, integer) from public, anon, authenticated;
grant execute on function public.search_documents_rag(vector, uuid, text, integer, double precision) to service_role;
grant execute on function public.cancel_and_edit_contract(uuid, text, text, uuid, text) to service_role;
grant execute on function public.create_deal_folder(text, text, text, uuid) to service_role;
grant execute on function public.next_v3_code(text, text, timestamptz) to service_role;
grant execute on function public.increment_link_uses(uuid) to service_role;
grant execute on function public.increment_link_revenue(uuid, integer) to service_role;

-- avaliadas por políticas: continuam para quem está logado
revoke execute on function public.has_compliance_dashboard_access(uuid) from public, anon;
revoke execute on function public.user_can_access_team_room(text, uuid) from public, anon;
grant execute on function public.has_compliance_dashboard_access(uuid) to authenticated, service_role;
grant execute on function public.user_can_access_team_room(text, uuid) to authenticated, service_role;
