-- =============================================================================
-- GOVERNANCA DOCUMENTAL UNIVERSAL, FASE 2b (Consorcios)
-- =============================================================================
--
-- CONTEXTO
--   Continuacao direta da Fase 2 (Credito + Bolsa de Ativos, migration
--   20260810c). Adiado naquele bloco porque consorcio_cartas (catalogo,
--   274 linhas) nao tinha coluna de cliente e nao era a mesma unidade de
--   "deal" que M&A/Credito. Joao esclareceu as duas trilhas reais:
--
--   1. Repasse de carta contemplada: consorcio_ofertas -> so vira
--      aquisicao de verdade quando a Mesa ACEITA a oferta (nunca na oferta
--      em si, que pode nunca virar venda). Confirmado por Joao via pergunta
--      direta: aceitar cancela as outras ofertas concorrentes da mesma carta.
--   2. Contratacao de carta nova (grupos novos, administradoras diferentes):
--      consorcio_projetos -> cada projeto ja e um cliente real desde a
--      criacao, pasta nasce junto.
--
-- ACHADO REAL, NAO ESPERADO
--   consorcio_projetos NAO EXISTE como tabela em producao. app/api/consorcio/
--   projetos/route.ts sempre retornou PGRST205 (tabela nao encontrada) para
--   qualquer chamada -- confirmado via REST antes desta migration. Isso ja
--   tinha sido descoberto em 19/07/2026 (migration
--   20260719_governance_soft_delete_ma_credito_consorcio.sql, comentario:
--   "consorcio_projetos e consorcio_leads NAO existem como tabelas reais"),
--   documentado, e nunca resolvido -- nem criando a tabela, nem removendo a
--   rota morta. O schema real pretendido sobreviveu num arquivo solto na
--   raiz do repo (supabase-consorcio-tables.sql, nunca commitado como
--   migration real), reaproveitado aqui sem alteracao no formato original,
--   so acrescido de code + colunas de governanca de soft delete (mesmo
--   padrao ja aplicado em consorcio_cartas pela migration de 19/07).
--
--   consorcio_leads tem o mesmo problema (Kanban de leads da Mesa de
--   Consorcio busca tabela inexistente), mas fica fora do escopo: Joao so
--   descreveu as duas trilhas acima, nenhuma menciona "leads".
--
-- SEGURANCA EM PRODUCAO
--   CREATE TABLE nova (consorcio_projetos, antes inexistente) + ALTER
--   aditivo em consorcio_ofertas (coluna status nova, nullable com default)
--   + CREATE OR REPLACE de validate_folder_path(). Nenhum DROP, nenhum
--   UPDATE em dado existente. consorcio_ofertas tem 0 linhas reais hoje
--   (confirmado via REST antes desta migration), sem risco de backfill.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. consorcio_projetos: tabela criada pela primeira vez em producao
--    Schema identico ao pretendido original (supabase-consorcio-tables.sql),
--    mais code (emitido por issueV3Code("CS", null), mesmo padrao ja usado
--    em consorcio_cartas desde 17/06) e colunas de governanca de soft delete
--    (mesmo padrao de ma_deals/credit_desk_proposals/consorcio_cartas, 19/07).
-- -----------------------------------------------------------------------------

create table if not exists public.consorcio_projetos (
  id                     uuid primary key default gen_random_uuid(),
  code                   text unique,
  name                   text not null,
  type                   text not null default 'IMOVEL' check (type in ('IMOVEL','VEICULO','SERVICO','OUTROS')),
  credit_value           numeric not null,
  status                 text not null default 'AGUARDANDO' check (status in ('EM_ANDAMENTO','CONCLUIDO','AGUARDANDO','CANCELADO')),
  client                 text not null,
  admin                  text not null,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  v3_client_id           uuid references public.v3_clients(id),
  deleted_at             timestamptz,
  deleted_by             uuid references public.profiles(id),
  deletion_reason        text,
  deletion_status        text not null default 'none' check (deletion_status in ('none','pending_governance','approved','rejected')),
  deletion_requested_by  uuid references public.profiles(id),
  deletion_requested_at  timestamptz
);

comment on column public.consorcio_projetos.v3_client_id is
  'FK para v3_clients (Client 360), nullable. Nao populado no backfill de 10/08 porque a tabela nao existia ainda; resolveClient() deve ser chamado na criacao de projeto novo dai em diante, quando client vier acompanhado de CPF/CNPJ.';
comment on column public.consorcio_projetos.deleted_at is
  'Soft delete, quando preenchido o projeto some da Mesa de Consorcio mas fica na Lixeira por 30 dias.';

create index if not exists idx_consorcio_projetos_deleted_at on public.consorcio_projetos(deleted_at) where deleted_at is not null;

alter table public.consorcio_projetos enable row level security;

drop policy if exists "autenticados podem ler projetos" on public.consorcio_projetos;
create policy "autenticados podem ler projetos" on public.consorcio_projetos
  for select using (auth.uid() is not null);

drop policy if exists "admin pode inserir projetos" on public.consorcio_projetos;
create policy "admin pode inserir projetos" on public.consorcio_projetos
  for insert with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));

drop policy if exists "admin pode atualizar projetos" on public.consorcio_projetos;
create policy "admin pode atualizar projetos" on public.consorcio_projetos
  for update using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));

drop policy if exists "admin pode excluir projetos" on public.consorcio_projetos;
create policy "admin pode excluir projetos" on public.consorcio_projetos
  for delete using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));


-- -----------------------------------------------------------------------------
-- 2. consorcio_ofertas: coluna de status (nao existia nenhuma) + policy de
--    update, necessaria para a rota nova de aceitar/recusar oferta.
-- -----------------------------------------------------------------------------

alter table public.consorcio_ofertas
  add column if not exists status text not null default 'pendente'
    check (status in ('pendente','aceita','recusada','cancelada'));

comment on column public.consorcio_ofertas.status is
  'pendente ate a Mesa decidir. aceita dispara create_deal_folder e marca a carta VENDIDA; as demais ofertas pendentes da mesma carta viram cancelada automaticamente (decisao de Joao, 10/08/2026).';

drop policy if exists "admin pode atualizar ofertas" on public.consorcio_ofertas;
create policy "admin pode atualizar ofertas" on public.consorcio_ofertas
  for update using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])
  ));


-- -----------------------------------------------------------------------------
-- 3. validate_folder_path(): fix da regex de Consorcios, mesmo tipo de bug
--    ja corrigido em Credito na migration 20260810c. O prefixo CON-\d{4}-\d{3}
--    nao tem nenhuma relacao com o formato real emitido por issueV3Code("CS").
--    ACHADO ao testar via REST antes de aplicar (10/08): o formato real e
--    V3-CS-YYYY-MM-NNNN, nao V3-CS-YYYY-NNNN como o comentario original desta
--    migration assumia lendo 20260805a_v3_code_series.sql. A linha viva de
--    v3_code_series para CS tem scope_grain='ano_mes', divergente do arquivo
--    fonte (que diz 'ano') -- mesmo tipo de desvio arquivo-vs-producao ja
--    documentado nesta sessao para outras funcoes, aqui confirmado por
--    chamada real a next_v3_code() antes de escrever a regex, nao por leitura
--    do arquivo. MA, Credito, BolsaDeAtivos e Administracao reproduzidos
--    identicos (CREATE OR REPLACE exige o corpo inteiro).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_folder_path(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  return p_path ~ '^MA/V3-(?:[A-Z]{2,4}-)?\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+'
      or p_path ~ '^Credito/(CRED-\d{2}-\d+|V3-CRI?-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3})_.+'
      or p_path ~ '^Consorcios/(CON-\d{4}-\d{3}|V3-CS-\d{4}-(0[1-9]|1[0-2])-\d{4})_.+'
      or p_path ~ '^BolsaDeAtivos/V3-(BA|PR)-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+'
      or p_path ~ '^Administracao/(Documento_Cadastro|Financeiro|Juridico)';
end;
$function$;
