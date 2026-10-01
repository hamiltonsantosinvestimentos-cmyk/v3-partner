-- =============================================================================
-- BACKFILL DOS CODIGOS FECHADOS (BRIEF 30/09/2026, Fase 1A)
-- =============================================================================
-- Preenche SO as colunas novas. Os textos originais (marital_status, nationality) NAO sao
-- tocados. Idempotente: so atualiza onde o codigo ainda e nulo.
-- Grafias ambiguas ou erradas NAO sao alteradas e ficam para decisao de Joao:
--   marital_status = 'mg'     (sigla de estado no campo errado)
--   nationality    = 'brasil' (nao e gentilico)
-- =============================================================================

update public.cm_party_qualifications
set marital_status_code = case
  when lower(btrim(marital_status)) in ('solteiro(a)', 'solteiro', 'solteira') then 'solteiro'
  when lower(btrim(marital_status)) in ('casado(a)', 'casado', 'casada') then 'casado'
  when lower(btrim(marital_status)) in ('divorciado(a)', 'divorciado', 'divorciada') then 'divorciado'
  when lower(btrim(marital_status)) in ('viúvo(a)', 'viuvo(a)', 'viúvo', 'viuvo', 'viúva', 'viuva') then 'viuvo'
  when lower(btrim(marital_status)) in ('união estável', 'uniao estavel', 'união estavel', 'uniao estável') then 'uniao_estavel'
  else null
end
where marital_status_code is null and marital_status is not null;

update public.cm_party_qualifications
set nationality_code = 'br'
where nationality_code is null
  and lower(btrim(nationality)) in ('brasileiro(a)', 'brasileiro', 'brasileira');

update public.cm_party_qualifications
set email_convite = email
where email_convite is null and email is not null;
