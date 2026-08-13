-- =============================================================================
-- BUY-SIDE INTAKE: recorrencia de compra + partner de origem + fix de visibilidade
-- =============================================================================
--
-- CONTEXTO
--   Joao reportou que compradores cadastrados via /intake/buy/[token] (Dr.
--   Athaydes, precatorios) nao apareciam em nenhum painel para validacao.
--   Investigado antes de codar (nao presumido): os 4 registros reais testados
--   tinham 0 linhas em investor_demand_documents (documento nunca persistiu) e
--   0 linhas em demand_matches (0 listings em ativo_vitrine no momento + cron
--   n8n W-CM-Match falhando). O unico painel que le investor_demand_documents
--   (/api/cm/kyc-documents) so mostra o documento se ja existir um
--   demand_matches ligando o comprador a um listing especifico -- nunca havia
--   uma tela "ver todos os compradores cadastrados + documentos deles" sem
--   depender do motor de matching ter rodado com sucesso.
--
-- ESTA MIGRATION (BRIEF aprovado por Joao, "go")
--   3 colunas novas em investor_demands, todas nullable, 100% aditivo:
--   - purchase_frequency_type: compra unica ou recorrente mensal
--   - recurrence_months: por quantos meses, so relevante se recorrente
--   - origin_partner_id: qual partner originou esse comprador (FK profiles),
--     capturado via ?partner={profiles.id} na URL do link publico -- mesmo
--     padrao ja usado no link de indicacao da Analise de Credito (?ref=),
--     nunca string livre tipo "JOAO_LEMOS" (evita duplicidade por digitacao).
--
-- NAO COBERTO NESTA MIGRATION (ver app/api e components, mesmo PR)
--   Fix do gate de intake_locked bloqueando upload de documento pos-envio,
--   endpoint GET novo em /api/cm/investor-demands, endpoint /api/cm/kyc-
--   documents aceitando demand_id direto, painel novo na Mesa de Capitais.
--   Fix do workflow n8n W-CM-Match fica fora desta migration (infra externa).
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 0 DROP, 0 UPDATE em dado existente. Nenhuma das 3 colunas
--   e dado pessoal sensivel novo -- investor_demands ja coleta CPF/CNPJ desde
--   sempre, coberto pelo sign-off LGPD de execucao contratual ja existente da
--   Bolsa de Ativos (mesma base, nenhuma finalidade nova de tratamento).
-- =============================================================================

alter table public.investor_demands
  add column if not exists purchase_frequency_type text
    check (purchase_frequency_type in ('SINGLE_PURCHASE', 'RECURRENT_MONTHLY')),
  add column if not exists recurrence_months integer
    check (recurrence_months is null or (recurrence_months between 1 and 60)),
  add column if not exists origin_partner_id uuid references public.profiles(id);

comment on column public.investor_demands.purchase_frequency_type is
  'SINGLE_PURCHASE (compra unica) ou RECURRENT_MONTHLY (recorrencia mensal). Nulo = nao informado (registros anteriores a 12/08/2026, ou Mandato de Busca generico sem ticket fechado).';
comment on column public.investor_demands.recurrence_months is
  'Quantos meses de recorrencia, 1 a 60. So preenchido quando purchase_frequency_type = RECURRENT_MONTHLY.';
comment on column public.investor_demands.origin_partner_id is
  'Partner que originou este comprador, capturado via ?partner={profiles.id} na URL do link de intake publico (mesmo padrao do ?ref= da Analise de Credito). Nulo = cadastro direto pela Mesa ou link sem atribuicao.';

create index if not exists idx_investor_demands_origin_partner on public.investor_demands(origin_partner_id) where origin_partner_id is not null;
