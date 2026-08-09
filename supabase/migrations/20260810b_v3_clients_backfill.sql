-- ============================================================================
-- ⚠️ TRAVA DE COMPLIANCE (LGPD) — NÃO APLICAR SEM SIGN-OFF DO ROBSON LINO ⚠️
--
-- Este arquivo é a Fase 1b do Registro Central de Cliente (Client 360),
-- codificado por instrução explícita de João em 08/08/2026, mas com ordem
-- explícita de NÃO rodar em produção ainda. Consolidar CPF/CNPJ que hoje
-- vive isolado por vertical é uma finalidade de tratamento nova (LGPD Art.
-- 5, XI), mesmo que cada dado isoladamente já tenha base legal na vertical
-- de origem. Aguardar parecer do Robson antes de colar este arquivo no SQL
-- Editor. Ver ~/.claude/rules/v3-numbering-governance.md e o relatório
-- 06_Operacional/SOPs/2026-08-07_Operacional_Relatorio-Governanca-...html.
--
-- Depende de 20260810a_v3_clients.sql já aplicada (tabela + colunas FK).
-- ============================================================================

-- 1) credit_desk_proposals.client_cpf_cnpj
insert into public.v3_clients (document_number, document_type, first_seen_vertical)
select distinct
  regexp_replace(client_cpf_cnpj, '\D', '', 'g'),
  case
    when length(regexp_replace(client_cpf_cnpj, '\D', '', 'g')) = 11 then 'CPF'
    when length(regexp_replace(client_cpf_cnpj, '\D', '', 'g')) = 14 then 'CNPJ'
  end,
  'credito'
from public.credit_desk_proposals
where client_cpf_cnpj is not null
  and length(regexp_replace(client_cpf_cnpj, '\D', '', 'g')) in (11, 14)
on conflict (document_number) do nothing;

update public.credit_desk_proposals p
set v3_client_id = c.id, updated_at = now()
from public.v3_clients c
where p.v3_client_id is null
  and p.client_cpf_cnpj is not null
  and c.document_number = regexp_replace(p.client_cpf_cnpj, '\D', '', 'g');

-- 2) cm_asset_listings.seller_cpf_cnpj
insert into public.v3_clients (document_number, document_type, first_seen_vertical)
select distinct
  regexp_replace(seller_cpf_cnpj, '\D', '', 'g'),
  case
    when length(regexp_replace(seller_cpf_cnpj, '\D', '', 'g')) = 11 then 'CPF'
    when length(regexp_replace(seller_cpf_cnpj, '\D', '', 'g')) = 14 then 'CNPJ'
  end,
  'bolsa_de_ativos'
from public.cm_asset_listings
where seller_cpf_cnpj is not null
  and length(regexp_replace(seller_cpf_cnpj, '\D', '', 'g')) in (11, 14)
on conflict (document_number) do nothing;

update public.cm_asset_listings l
set v3_client_id = c.id
from public.v3_clients c
where l.v3_client_id is null
  and l.seller_cpf_cnpj is not null
  and c.document_number = regexp_replace(l.seller_cpf_cnpj, '\D', '', 'g');

-- 3) credit_profiles.subject_cpf_cnpj
insert into public.v3_clients (document_number, document_type, first_seen_vertical)
select distinct
  regexp_replace(subject_cpf_cnpj, '\D', '', 'g'),
  case
    when length(regexp_replace(subject_cpf_cnpj, '\D', '', 'g')) = 11 then 'CPF'
    when length(regexp_replace(subject_cpf_cnpj, '\D', '', 'g')) = 14 then 'CNPJ'
  end,
  'credit_engine'
from public.credit_profiles
where subject_cpf_cnpj is not null
  and length(regexp_replace(subject_cpf_cnpj, '\D', '', 'g')) in (11, 14)
on conflict (document_number) do nothing;

update public.credit_profiles p
set v3_client_id = c.id
from public.v3_clients c
where p.v3_client_id is null
  and p.subject_cpf_cnpj is not null
  and c.document_number = regexp_replace(p.subject_cpf_cnpj, '\D', '', 'g');

-- 4) partner_registrations.cpf / .cnpj (pessoa física ou jurídica, nunca as duas)
insert into public.v3_clients (document_number, document_type, first_seen_vertical)
select distinct
  regexp_replace(coalesce(cpf, cnpj), '\D', '', 'g'),
  case
    when length(regexp_replace(coalesce(cpf, cnpj), '\D', '', 'g')) = 11 then 'CPF'
    when length(regexp_replace(coalesce(cpf, cnpj), '\D', '', 'g')) = 14 then 'CNPJ'
  end,
  'partners'
from public.partner_registrations
where coalesce(cpf, cnpj) is not null
  and length(regexp_replace(coalesce(cpf, cnpj), '\D', '', 'g')) in (11, 14)
on conflict (document_number) do nothing;

update public.partner_registrations r
set v3_client_id = c.id
from public.v3_clients c
where r.v3_client_id is null
  and coalesce(r.cpf, r.cnpj) is not null
  and c.document_number = regexp_replace(coalesce(r.cpf, r.cnpj), '\D', '', 'g');

-- Conferência pós-backfill (rodar manualmente após aplicar, reportar os
-- números para o relatório de status, nunca assumir sucesso pelo "no rows
-- returned" do bloco acima):
--   select count(*) from v3_clients;
--   select count(*) from credit_desk_proposals where v3_client_id is not null;
--   select count(*) from cm_asset_listings where v3_client_id is not null;
--   select count(*) from credit_profiles where v3_client_id is not null;
--   select count(*) from partner_registrations where v3_client_id is not null;
