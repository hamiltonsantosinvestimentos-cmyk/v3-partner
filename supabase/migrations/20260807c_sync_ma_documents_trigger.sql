-- =============================================================================
-- FIX: ma_documents estava desincronizada desde 09/07/2026
-- =============================================================================
--
-- CONTEXTO
--   Joao Lemos pediu investigacao de um suposto "split-brain" no upload de
--   documentos (07/08/2026). Tres correcoes de rota ate chegar aqui, cada
--   uma verificada contra o banco real antes de seguir para a proxima:
--
--   1. Diagnostico inicial colado na conversa (bucket sem hash, sem
--      roteamento de pasta, pipeline WhatsApp ignorando governanca) nao se
--      sustentou: as 3 rotas reais de upload ja calculam SHA-256 e ja
--      consultam ma_documents para bloquear duplicata.
--
--   2. Hipotese seguinte (ma_documents e resto de backfill, JSONB e a fonte
--      real) tambem errada: o schema real mostra folder_id NOT NULL com FK
--      para folder_registry, e a descricao da tabela diz "Fase 1 do plano
--      de governanca de documentos (2026-07-10)". Ou seja, ma_documents FOI
--      desenhada para ser o registro real -- so ninguem terminou de ligar
--      as rotas de upload nela. Ultimo registro real: 09/07/2026. Documento
--      mais recente no JSONB (fonte que as rotas de fato escrevem):
--      05/08/2026, ausente da tabela.
--
--   3. Ao tentar fechar o gap dos 6 deals sem v3_code (pre-requisito para
--      resolver folder_id), create_deal_folder() falhou nos 6 com
--      FOLDER_VIOLATION -- a Fase 1a da governanca de numeracao (v3_code
--      com vertical embutida) quebrou a regex de validate_folder_path(),
--      corrigida em 20260807d antes desta migration.
--
--   Tambem encontradas 20 pares (deal_id, doc_id) duplicados dentro da
--   propria ma_documents -- o script de backfill original de 10/07 rodou a
--   mesma linha duas vezes para alguns documentos.
--
--   Achado ao validar esta migration antes de aplicar (nao em producao):
--   ma_documents.uploaded_by e uuid, mas
--   app/api/public/upload/[token]/route.ts grava o literal "external" no
--   JSONB quando o link nao tem partner associado -- caso real, ja presente
--   em pelo menos 1 deal hoje.
--
-- PRE-REQUISITO DESTA MIGRATION (ja executado fora dela)
--   Todos os 30 deals em ma_deals tem v3_code preenchido, e cada um tem
--   pasta em folder_registry (create_deal_folder ja rodado para os 6 que
--   faltavam). Sem isso, o INSERT abaixo falharia por NOT NULL em folder_id
--   para qualquer deal sem pasta.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Remove as 20 duplicatas exatas dentro de ma_documents.
--   2. Cria constraint UNIQUE (deal_id, doc_id).
--   3. Cria sync_ma_documents_from_deal(): funcao de trigger que le
--      NEW.documents (JSONB), resolve folder_id cruzando o v3_code do deal
--      com a subpasta de folder_registry correspondente a categoria do
--      documento (mapa 01_NDA..07_Closing, default 04_Due_Diligence -- o
--      mesmo default ja usado pelas rotas de upload), e faz upsert em
--      ma_documents por doc_id. Remove linhas cujo doc_id saiu do JSONB.
--   4. Trigger AFTER INSERT OR UPDATE OF documents em ma_deals -- toda
--      escrita futura em ma_deals.documents (pelas 3 rotas ja existentes,
--      sem alterar nenhuma delas) mantem ma_documents sincronizada por
--      construcao.
--   5. Resync completo, uma vez, de todos os deals -- fecha o gap
--      acumulado entre 09/07 e hoje.
--
-- O QUE ACONTECE COM DEAL SEM PASTA (defesa, nao deveria ocorrer)
--   Se algum deal futuro tiver documento no JSONB mas nao tiver pasta em
--   folder_registry (v3_code nulo, ou pasta nunca criada), a funcao GRAVA
--   um aviso em folder_governance_log com severidade 'warning' e PULA
--   aquele documento especifico -- nunca derruba a transacao inteira do
--   deal por causa de um caso nao resolvido.
--
-- SEGURANCA
--   Nenhuma das 3 rotas de upload e alterada. O trigger e puramente
--   aditivo sobre o fluxo existente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Dedup das 20 duplicatas exatas conhecidas
-- -----------------------------------------------------------------------------

delete from public.ma_documents a
using public.ma_documents b
where a.deal_id = b.deal_id
  and a.doc_id = b.doc_id
  and a.ctid > b.ctid;

-- -----------------------------------------------------------------------------
-- 2. Unicidade
-- -----------------------------------------------------------------------------

alter table public.ma_documents
  add constraint ma_documents_deal_doc_unique unique (deal_id, doc_id);

-- -----------------------------------------------------------------------------
-- 3. Funcao de sincronia (com resolucao de folder_id)
-- -----------------------------------------------------------------------------

create or replace function public.sync_ma_documents_from_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc jsonb;
  v_current_doc_ids text[];
  v_uploaded_by uuid;
  v_folder_id uuid;
  v_folder_suffix text;
  v_category text;
begin
  select coalesce(array_agg(d ->> 'doc_id'), '{}')
    into v_current_doc_ids
    from jsonb_array_elements(coalesce(new.documents, '[]'::jsonb)) d
   where d ->> 'doc_id' is not null;

  -- Remove da tabela quem saiu do JSONB (documento deletado pela rota DELETE)
  delete from public.ma_documents
   where deal_id = new.id
     and doc_id <> all(v_current_doc_ids);

  for v_doc in
    select elem from jsonb_array_elements(coalesce(new.documents, '[]'::jsonb)) as elem
     where elem ->> 'doc_id' is not null
  loop
    -- uploaded_by no JSONB pode ser "external" (upload sem partner) ou
    -- qualquer texto que nao seja UUID. Valida o formato antes de
    -- converter, grava NULL quando nao bate -- nunca deixa o INSERT falhar
    -- por causa de um valor de origem que nao e usuario do sistema.
    v_uploaded_by := case
      when (v_doc ->> 'uploaded_by') ~
           '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (v_doc ->> 'uploaded_by')::uuid
      else null
    end;

    -- Mapa categoria -> sufixo de subpasta MPS. "Due_Diligence" e o default
    -- da aplicacao (ver DocEntry.category ?? "Due_Diligence" nas 3 rotas de
    -- upload) e cobre 100% dos documentos reais hoje. As demais entradas
    -- ficam prontas para quando a UI passar a classificar em outra pasta.
    v_category := coalesce(v_doc ->> 'category', 'Due_Diligence');
    v_folder_suffix := case v_category
      when 'NDA'            then '01_NDA'
      when 'Teaser'          then '02_Teaser'
      when 'CIM'             then '03_CIM'
      when 'Due_Diligence'   then '04_Due_Diligence'
      when 'Propostas'       then '05_Propostas'
      when 'Contrato'        then '06_Contrato'
      when 'Closing'         then '07_Closing'
      else '04_Due_Diligence'
    end;

    select fr.id into v_folder_id
      from public.folder_registry fr
     where fr.deal_code = new.v3_code
       and fr.full_path like '%/' || v_folder_suffix
     limit 1;

    if v_folder_id is null then
      -- Defesa: nunca derruba a transacao do deal inteiro por causa de um
      -- documento sem pasta resolvivel. Registra e segue para o proximo.
      insert into public.folder_governance_log
        (event_type, user_id, target_path, severity, details)
      values
        ('UPLOAD_MISROUTED', v_uploaded_by, coalesce(new.v3_code, new.id::text) || '/' || v_folder_suffix,
         'warning',
         jsonb_build_object(
           'reason', 'folder_id nao resolvido durante sync_ma_documents_from_deal',
           'deal_id', new.id, 'doc_id', v_doc ->> 'doc_id', 'category', v_category
         ));
      continue;
    end if;

    insert into public.ma_documents
      (deal_id, doc_id, folder_id, file_name, storage_path, bucket, file_hash,
       category, source, file_size_bytes, uploaded_by, uploaded_at)
    values
      (new.id,
       v_doc ->> 'doc_id',
       v_folder_id,
       v_doc ->> 'file_name',
       v_doc ->> 'storage_path',
       coalesce(v_doc ->> 'bucket', 'ma-documents'),
       v_doc ->> 'file_hash',
       v_category,
       'ma_deals_documents_sync',
       nullif(v_doc ->> 'file_size_bytes', '')::bigint,
       v_uploaded_by,
       coalesce(nullif(v_doc ->> 'uploaded_at', '')::timestamptz, now()))
    on conflict (deal_id, doc_id) do update
       set folder_id       = excluded.folder_id,
           file_name       = excluded.file_name,
           storage_path    = excluded.storage_path,
           bucket          = excluded.bucket,
           file_hash       = excluded.file_hash,
           category        = excluded.category,
           uploaded_by     = coalesce(excluded.uploaded_by, public.ma_documents.uploaded_by),
           uploaded_at     = excluded.uploaded_at;
  end loop;

  return new;
end;
$$;

comment on function public.sync_ma_documents_from_deal() is
  'Mantem ma_documents espelhada de ma_deals.documents (JSONB), resolvendo folder_id contra folder_registry pela categoria do documento. Corrige a defasagem encontrada em 07/08/2026: a tabela parou de ser atualizada em 09/07/2026 porque nenhuma rota de upload escrevia nela diretamente, so no JSONB.';

-- -----------------------------------------------------------------------------
-- 4. Trigger
-- -----------------------------------------------------------------------------

drop trigger if exists trg_sync_ma_documents on public.ma_deals;

create trigger trg_sync_ma_documents
  after insert or update of documents on public.ma_deals
  for each row
  execute function public.sync_ma_documents_from_deal();

-- -----------------------------------------------------------------------------
-- 5. Resync completo (fecha o gap acumulado desde 09/07)
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select id from public.ma_deals
     where documents is not null and documents <> '[]'::jsonb
  loop
    update public.ma_deals set documents = documents where id = r.id;
  end loop;
end $$;
