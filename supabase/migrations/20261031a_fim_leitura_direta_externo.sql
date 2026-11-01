-- Política de sigilo (31/10/2026): perfil externo (partner em qualquer plano, originador, indicador, instituição,
-- comprador, vendedor) nunca lê nem escreve o banco direto. O que ele vê vem da API da V3 (chave de serviço,
-- papel validado, colunas escolhidas). Perfil interno (ADMIN, GESTAO, MESA_OPERACIONAL e, onde já constava,
-- FINANCEIRO) mantém o acesso. BRIEF: 2026-10-31_Operacional_BRIEF-Seguranca-Fim-da-Leitura-Direta-de-Externo-ao-Banco_v1.html
-- (QA liberado na rodada 6; de acordo do Robson em 31/10/2026).
--
-- ORDEM OBRIGATÓRIA: o código deste PR (carregador do servidor, rotas e páginas pela chave de serviço) entra
-- ANTES desta migration. Aplicar depois do deploy verificado, com o SQL mostrado e o segundo go do João.
-- Rollback: 20261031a_fim_leitura_direta_externo_rollback.sql.txt (recria as políticas exatamente como estavam
-- em 31/10/2026, conferidas em pg_policies).
--
-- Escopo: só políticas, a coluna nova e o revoke de duas funções. Nenhum grant novo, nenhuma política para anon
-- ou public, nenhuma view, tabela ou função nova.

-- 1) Coluna do lado que o partner trouxe (decisão 11 do BRIEF): nullable, partner nunca escreve ---------------------
alter table public.ma_deals add column if not exists lado_originador text;
alter table public.ma_deals drop constraint if exists chk_ma_deals_lado_originador;
alter table public.ma_deals add constraint chk_ma_deals_lado_originador
  check (lado_originador is null or lado_originador in ('vendedor', 'comprador'));
comment on column public.ma_deals.lado_originador is
  'Lado do negócio que o partner originador trouxe (vendedor ou comprador). Gravado só pela Mesa (rota /api/ma/deals/[deal_id]/clientes, papel interno, com audit_logs). Nulo: o partner não vê cliente (fail-closed).';

-- 2) ma_documents: tinha leitura e inserção para qualquer usuário logado ------------------------------------------
drop policy if exists ma_documents_select on public.ma_documents;
drop policy if exists ma_documents_insert on public.ma_documents;
drop policy if exists ma_documents_update on public.ma_documents;
create policy ma_documents_select on public.ma_documents for select to authenticated
  using (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy ma_documents_insert on public.ma_documents for insert to authenticated
  with check (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy ma_documents_update on public.ma_documents for update to authenticated
  using (
    get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role])
    and exists (
      select 1 from public.ma_deals d
      where d.id = ma_documents.deal_id
        and (d.assigned_to = auth.uid() or get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role]))
    )
  );
-- ma_documents_delete_admin não muda (só ADMIN).

-- 3) ma_deals: sem ramos de dono para externo; inserção só interna -------------------------------------------------
drop policy if exists ma_select on public.ma_deals;
drop policy if exists ma_insert on public.ma_deals;
drop policy if exists ma_update on public.ma_deals;
create policy ma_select on public.ma_deals for select
  using (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role, 'FINANCEIRO'::user_role]));
create policy ma_insert on public.ma_deals for insert
  with check (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy ma_update on public.ma_deals for update
  using (
    get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role])
    or (get_user_role() = 'MESA_OPERACIONAL'::user_role and assigned_to = auth.uid())
  );
-- ma_delete_admin não muda (só ADMIN).

-- 4) Bolsa de Ativos: fica só a política interna (internal manage ...) e as de ADMIN e GESTAO ---------------------
drop policy if exists cm_listings_insert on public.cm_asset_listings;
drop policy if exists cm_listings_select on public.cm_asset_listings;
drop policy if exists cm_listings_update on public.cm_asset_listings;
drop policy if exists cm_bids_insert on public.cm_bids;
drop policy if exists cm_bids_select on public.cm_bids;
drop policy if exists cm_docs_insert on public.cm_listing_documents;
drop policy if exists cm_docs_select on public.cm_listing_documents;
drop policy if exists cm_dra_insert on public.cm_deal_room_access;
-- Mantidas: "internal manage listings", "internal manage bids", "internal manage listing docs" (ADMIN, GESTAO,
-- MESA_OPERACIONAL), cm_bids_update, cm_dra_select, cm_dra_update (ADMIN, GESTAO). A vitrine pública continua
-- pelas views anonimizadas (cm_vitrine_public e cm_vitrine_publica_imoveis), que não dependem destas políticas.

-- 5) Mesa de Crédito -------------------------------------------------------------------------------------------------
drop policy if exists credit_select_partner on public.credit_desk_proposals;
drop policy if exists credit_insert on public.credit_desk_proposals;
create policy credit_select_partner on public.credit_desk_proposals for select
  using (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy credit_insert on public.credit_desk_proposals for insert
  with check (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));

-- 6) Pedidos de documento e links de captação do M&A -----------------------------------------------------------------
drop policy if exists partner_read_own_doc_requests on public.ma_document_requests;
drop policy if exists partner_own_ma_links on public.ma_captacao_links;

-- 7) Consórcio: leitura só interna -----------------------------------------------------------------------------------
drop policy if exists "autenticados podem ler projetos" on public.consorcio_projetos;
create policy "autenticados podem ler projetos" on public.consorcio_projetos for select
  using (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));

-- 8) Criativos: o painel agora passa pela rota /api/ma/criativos (servidor) ----------------------------------------
drop policy if exists creative_jobs_insert on public.creative_jobs;
drop policy if exists creative_jobs_select on public.creative_jobs;
drop policy if exists creative_jobs_update on public.creative_jobs;
drop policy if exists creative_files_insert on public.creative_files;
drop policy if exists creative_files_select on public.creative_files;
create policy creative_jobs_select on public.creative_jobs for select
  using (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy creative_jobs_insert on public.creative_jobs for insert
  with check (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy creative_jobs_update on public.creative_jobs for update
  using (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy creative_files_select on public.creative_files for select
  using (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));
create policy creative_files_insert on public.creative_files for insert
  with check (get_user_role() = any (array['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role]));

-- 9) Funções SECURITY DEFINER que liam ma_deals fora da RLS: só a chave de serviço executa ----------------------------
do $$
declare f record;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('match_deals_for_investor', 'match_investors_for_deal')
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', f.proname, f.args);
    execute format('grant execute on function public.%I(%s) to service_role', f.proname, f.args);
    execute format('alter function public.%I(%s) set search_path = public', f.proname, f.args);
  end loop;
end $$;
