-- BRIEF Mesa M&A, RLS de leitura de ma_deals (30/10/2026; "go" do João em 30/10/2026;
-- parecer do Robson (Compliance) registrado no BRIEF).
-- Problema: a política ma_select era (auth.uid() IS NOT NULL), ou seja, qualquer usuário logado
-- lia todos os deals direto pelo banco. A API já filtrava por partner; o banco não impunha.
-- Nova regra: dono do deal (assigned_to, created_by ou originator_profile_id) e perfis da
-- equipe (ADMIN, GESTAO, MESA_OPERACIONAL, FINANCEIRO) leem. Escrita não muda.
-- Impacto medido no código: só as páginas /ma/[id] e /ma/[id]/criativos leem com sessão do
-- usuário; o resto usa chave de serviço. Políticas dependentes (ma_document_requests e
-- ma_documents_update) continuam cobertas.
--
-- Estado anterior (snapshot de pg_policies em 30/10/2026):
--   ma_select  SELECT  roles {public}  USING (auth.uid() IS NOT NULL)
-- Rollback: ver 20261030a_ma_deals_rls_leitura_rollback.sql.txt

drop policy if exists ma_select on public.ma_deals;

create policy ma_select on public.ma_deals
  for select
  using (
       assigned_to = auth.uid()
    or created_by = auth.uid()
    or originator_profile_id = auth.uid()
    or public.get_user_role() in ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL', 'FINANCEIRO')
  );
