-- Loop 1 (Cibersegurança), Parte B: fixa search_path nas 11 funções SECURITY
-- DEFINER que ainda não tinham essa proteção, achadas na auditoria de
-- 11/08/2026 (query real contra pg_proc, não suposição). Mesmo vetor de risco
-- documentado em create_deal_folder (07/08/2026): função SECURITY DEFINER sem
-- search_path fixo permite sequestro de schema (alguém cria um objeto do
-- mesmo nome num schema que entra antes de "public" no search_path da sessão
-- e a função passa a chamá-lo em vez do objeto real).
--
-- Nenhuma lógica interna foi alterada, só a cláusula SET search_path
-- adicionada. search_documents_rag inclui "extensions" no search_path porque
-- usa o tipo `vector` e o operador `<=>` da extensão pgvector, que no Supabase
-- normalmente vive no schema extensions, não em public.
--
-- Regra permanente: toda função SECURITY DEFINER nova ou alterada neste
-- projeto leva SET search_path (~/.claude/rules/v3-numbering-governance.md).

alter function public.get_user_role()
  set search_path = public;

alter function public.handle_new_user()
  set search_path = public;

alter function public.increment_link_revenue(p_link_id uuid, p_amount integer)
  set search_path = public;

alter function public.increment_link_uses(p_link_id uuid)
  set search_path = public;

alter function public.match_deals_for_investor(p_demand_id uuid)
  set search_path = public;

alter function public.match_investors_for_deal(p_deal_id uuid)
  set search_path = public;

alter function public.search_documents_rag(
  p_query_embedding vector,
  p_user_id uuid,
  p_vertical text,
  p_limit integer,
  p_similarity_threshold double precision
) set search_path = public, extensions;

alter function public.sync_ma_documents_from_jsonb()
  set search_path = public;

alter function public.trg_docview_to_blockchain()
  set search_path = public;

alter function public.trg_nda_to_blockchain()
  set search_path = public;

alter function public.user_can_access_team_room(p_room_id text, p_user_id uuid)
  set search_path = public;
