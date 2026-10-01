-- =============================================================================
-- QUALIFICACAO PADRONIZADA: COLUNAS, CHECKS E TIPOS DE DOCUMENTO (BRIEF 30/09/2026, Fase 1A)
-- =============================================================================
-- 100% aditivo e compativel com a producao: so colunas novas NULLABLE e CHECKs que
-- aceitam NULL. Os campos de texto antigos (marital_status, nationality, rg,
-- endereco_completo) NAO sao alterados nem removidos: continuam sendo escritos, agora
-- a partir do dicionario fechado (gravacao dupla), e registros antigos seguem validos.
--
-- Rollback (rodar manualmente, na ordem):
--   1. remover as colunas novas de cm_party_qualifications listadas abaixo;
--   2. restaurar v3_clients_document_type_check com ('CPF', 'CNPJ');
--   3. restaurar cm_party_qualification_documents_document_kind_check com
--      ('identificacao_foto', 'contrato_social').
-- Colunas novas: marital_status_code, nationality_code, id_type, id_number, id_issuer,
-- id_issuer_uf, id_country, email_convite, email_alterado_em, endereco_origem,
-- company_endereco_origem.
-- A declaracao do representante legal de menor (colunas menor_ciencia_*) NAO esta nesta migration:
-- e a sub-entrega 1D, com especificacao propria (BRIEF 5.17).
-- =============================================================================

alter table public.cm_party_qualifications
  add column if not exists marital_status_code text,
  add column if not exists nationality_code text,
  add column if not exists id_type text,
  add column if not exists id_number text,
  add column if not exists id_issuer text,
  add column if not exists id_issuer_uf text,
  add column if not exists id_country text,
  add column if not exists email_convite text,
  add column if not exists email_alterado_em timestamptz,
  add column if not exists endereco_origem text,
  add column if not exists company_endereco_origem text;

comment on column public.cm_party_qualifications.marital_status_code is
  'Estado civil em codigo fechado (casado, divorciado, solteiro, uniao_estavel, viuvo). marital_status (texto) segue gravado com o texto neutro do contrato.';
comment on column public.cm_party_qualifications.nationality_code is
  'br ou outra. nationality (texto) segue gravado com o texto do contrato (brasileiro(a) ou o texto informado em caixa baixa).';
comment on column public.cm_party_qualifications.id_type is
  'Tipo da identidade: cnh, oab, outro, passaporte, rg. rg (texto) segue gravado com a forma composta (gravacao dupla).';
comment on column public.cm_party_qualifications.id_country is
  'Pais emissor do passaporte, codigo ISO 3166-1 alfa-2.';
comment on column public.cm_party_qualifications.email_convite is
  'E-mail original do convite. email passa a ser o valor final editado pela parte e e o destinatario do link de assinatura.';
comment on column public.cm_party_qualifications.endereco_origem is
  'viacep (endereco preenchido pelo CEP) ou manual (aceito sem localizar o CEP, sujeito a conferencia da Mesa).';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cm_party_qualifications_marital_status_code_check') then
    alter table public.cm_party_qualifications add constraint cm_party_qualifications_marital_status_code_check
      check (marital_status_code is null or marital_status_code in ('casado', 'divorciado', 'solteiro', 'uniao_estavel', 'viuvo'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cm_party_qualifications_nationality_code_check') then
    alter table public.cm_party_qualifications add constraint cm_party_qualifications_nationality_code_check
      check (nationality_code is null or nationality_code in ('br', 'outra'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cm_party_qualifications_id_type_check') then
    alter table public.cm_party_qualifications add constraint cm_party_qualifications_id_type_check
      check (id_type is null or id_type in ('cnh', 'oab', 'outro', 'passaporte', 'rg'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cm_party_qualifications_id_country_check') then
    alter table public.cm_party_qualifications add constraint cm_party_qualifications_id_country_check
      check (id_country is null or id_country ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cm_party_qualifications_id_issuer_uf_check') then
    alter table public.cm_party_qualifications add constraint cm_party_qualifications_id_issuer_uf_check
      check (id_issuer_uf is null or id_issuer_uf ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cm_party_qualifications_endereco_origem_check') then
    alter table public.cm_party_qualifications add constraint cm_party_qualifications_endereco_origem_check
      check (endereco_origem is null or endereco_origem in ('viacep', 'manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cm_party_qualifications_company_endereco_origem_check') then
    alter table public.cm_party_qualifications add constraint cm_party_qualifications_company_endereco_origem_check
      check (company_endereco_origem is null or company_endereco_origem in ('viacep', 'manual'));
  end if;
end $$;

-- Client 360: passaporte como chave de identidade de estrangeiro sem CPF.
-- document_number do passaporte e "PP:<ISO2>:<NUMERO>" (lib/qualification-schema.ts); os dois
-- pontos nunca existem em CPF nem CNPJ, entao nao colide com o espaco de chaves existente.
alter table public.v3_clients drop constraint if exists v3_clients_document_type_check;
alter table public.v3_clients add constraint v3_clients_document_type_check
  check (document_type in ('CPF', 'CNPJ', 'PASSAPORTE'));

-- Anexos do instrumento de representacao (sem reaproveitamento de 12 meses, ver BRIEF 5.11).
alter table public.cm_party_qualification_documents drop constraint if exists cm_party_qualification_documents_document_kind_check;
alter table public.cm_party_qualification_documents add constraint cm_party_qualification_documents_document_kind_check
  check (document_kind in (
    'identificacao_foto', 'contrato_social',
    'mandato', 'certidao_nascimento', 'termo_curatela', 'termo_tutela', 'termo_inventariante'
  ));
