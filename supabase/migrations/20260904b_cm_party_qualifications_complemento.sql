-- ============================================================
-- MIGRATION: cm_party_qualifications.endereco_complemento / company_complemento
-- Date: 2026-09-04
-- Scope: link publico de qualificacao (/intake/qualificacao/[token]) nao
--        tinha campo de complemento de endereco (apto/sala/bloco), achado
--        real reportado por Joao ao revisar um preenchimento real. Colunas
--        novas nullable, backward compatible.
-- Rollback:
--   alter table public.cm_party_qualifications
--     drop column if exists endereco_complemento,
--     drop column if exists company_complemento;
-- ============================================================

alter table public.cm_party_qualifications
  add column if not exists endereco_complemento text,
  add column if not exists company_complemento text;

comment on column public.cm_party_qualifications.endereco_complemento is
  'Complemento do endereco residencial (apto/sala/bloco), opcional. Usado por montarEndereco() em app/api/cm/qualificacao/[token]/route.ts.';
comment on column public.cm_party_qualifications.company_complemento is
  'Complemento do endereco da sede da empresa (PJ), opcional.';
