-- =============================================================================
-- MELHORIA: sync_ma_documents_from_deal reaproveita safe_uuid() e autocura
-- pasta ausente via create_deal_folder(), em vez de so alertar e pular
-- =============================================================================
--
-- CONTEXTO
--   Ao investigar security-audit full (07/08/2026), foi achada uma funcao
--   pre-existente, orfa (nunca anexada a nenhum trigger):
--   sync_ma_documents_from_jsonb(). Ela resolve o mesmo problema que
--   sync_ma_documents_from_deal() (criada em 20260807c nesta mesma sessao),
--   e revela dois achados reais:
--
--   1. safe_uuid(text) ja existe no banco, validado, IMMUTABLE, fazendo
--      exatamente o cast seguro de uploaded_by que eu escrevi na mao dentro
--      da minha propria funcao. Duplicacao evitavel -- violacao do
--      principio REUSE > ADAPT > CREATE que e regra do proprio agente.
--   2. ma_documents ja tinha UNIQUE (bucket, storage_path)
--      (ma_documents_bucket_storage_path_key) antes desta sessao, ao lado
--      da UNIQUE (deal_id, doc_id) adicionada em 20260807c. As duas
--      convivem sem conflito estrutural.
--
--   A funcao orfa faz uma coisa melhor que a minha (autocura: cria a pasta
--   raiz automaticamente quando nao encontra nenhuma) e uma coisa pior
--   (joga TODO documento na pasta raiz do deal, sem separar por categoria
--   em subpasta -- perde a taxonomia MPS de 7 subpastas que e o proposito
--   inteiro da governanca de documentos). Por isso nao e simplesmente
--   ativada no lugar da minha: o ponto forte dela e absorvido, o ponto
--   fraco nao.
--
-- O QUE ESTA MIGRATION FAZ
--   1. uploaded_by passa a usar safe_uuid() em vez de regex duplicada.
--   2. Quando NENHUMA pasta existe para o deal (nao so a subpasta
--      especifica da categoria), a funcao chama create_deal_folder() de
--      verdade -- que ja tem search_path fixado (20260807d parte 2, fix
--      anterior nesta mesma sessao) e cria as 7 subpastas corretas, nao
--      so a raiz. Fecha o gap que hoje exigiu correcao manual em 8 deals.
--   3. sync_ma_documents_from_jsonb() marcada como obsoleta via COMMENT,
--      permanece no banco (decisao de manter ou remover fica para o dono
--      original, nao e desta migration). Continua sem trigger, portanto
--      inofensiva.
--
-- SEGURANCA
--   Mesma assinatura, mesmo trigger (trg_sync_ma_documents), CREATE OR
--   REPLACE. O unico comportamento novo e a autocura -- estritamente
--   aditivo: onde antes a funcao pulava o documento e alertava, agora ela
--   resolve e segue. Nenhum documento que ja sincronizava corretamente
--   muda de comportamento.
-- =============================================================================

create or replace function public.sync_ma_documents_from_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc jsonb;
  v_current_doc_ids text[];
  v_folder_id uuid;
  v_folder_suffix text;
  v_category text;
  v_has_any_folder boolean;
  v_client text;
begin
  select coalesce(array_agg(d ->> 'doc_id'), '{}')
    into v_current_doc_ids
    from jsonb_array_elements(coalesce(new.documents, '[]'::jsonb)) d
   where d ->> 'doc_id' is not null;

  delete from public.ma_documents
   where deal_id = new.id
     and doc_id <> all(v_current_doc_ids);

  -- Autocura: se o deal nao tem NENHUMA pasta ainda (nem a raiz), cria a
  -- arvore completa de 7 subpastas via create_deal_folder(), em vez de
  -- pular todo documento com UPLOAD_MISROUTED. Só tenta quando ha v3_code
  -- (create_deal_folder exige codigo real) e um responsavel para atribuir
  -- como criador da pasta.
  select exists (
    select 1 from public.folder_registry fr where fr.deal_code = new.v3_code
  ) into v_has_any_folder;

  if not v_has_any_folder and new.v3_code is not null
     and coalesce(new.assigned_to, new.created_by) is not null
     and jsonb_array_length(coalesce(new.documents, '[]'::jsonb)) > 0
  then
    v_client := regexp_replace(
      coalesce(nullif(trim(new.target_company), ''), new.v3_code),
      '[^a-zA-Z0-9._-]+', '_', 'g'
    );
    begin
      perform public.create_deal_folder(
        'MA', new.v3_code, v_client, coalesce(new.assigned_to, new.created_by)
      );
    exception when others then
      -- Autocura e best-effort: se falhar por qualquer motivo (ex: nome de
      -- pasta colide com o padrao MPS de um jeito nao previsto), cai no
      -- comportamento antigo (loga e pula por documento), nunca derruba a
      -- transacao do deal inteiro.
      insert into public.folder_governance_log
        (event_type, user_id, target_path, severity, details)
      values
        ('FOLDER_CREATED', coalesce(new.assigned_to, new.created_by),
         'MA/' || new.v3_code, 'warning',
         jsonb_build_object(
           'reason', 'autocura via create_deal_folder falhou dentro de sync_ma_documents_from_deal',
           'sqlerrm', sqlerrm, 'deal_id', new.id
         ));
    end;
  end if;

  for v_doc in
    select elem from jsonb_array_elements(coalesce(new.documents, '[]'::jsonb)) as elem
     where elem ->> 'doc_id' is not null
  loop
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
      insert into public.folder_governance_log
        (event_type, user_id, target_path, severity, details)
      values
        ('UPLOAD_MISROUTED', safe_uuid(v_doc ->> 'uploaded_by'),
         coalesce(new.v3_code, new.id::text) || '/' || v_folder_suffix,
         'warning',
         jsonb_build_object(
           'reason', 'folder_id nao resolvido apos tentativa de autocura',
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
       safe_uuid(v_doc ->> 'uploaded_by'),
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
  'Mantem ma_documents espelhada de ma_deals.documents (JSONB), resolvendo folder_id contra folder_registry pela categoria do documento. Autocura arvore de pasta ausente via create_deal_folder(). Reaproveita safe_uuid() para cast seguro de uploaded_by.';

comment on function public.sync_ma_documents_from_jsonb() is
  'OBSOLETA — nao anexada a nenhum trigger desde antes de 07/08/2026 (confirmado via pg_trigger). Resolvia o mesmo problema que sync_ma_documents_from_deal(), com uma diferenca real: gravava todo documento na pasta RAIZ do deal, sem separar por categoria nas 7 subpastas MPS. Mantida no banco para preservar historico de autoria; decisao de remover pertence a quem a escreveu, nao a esta migration.';
