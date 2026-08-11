update operation_contracts
set parties = (
  select jsonb_agg(
    case when elem->>'role' = 'v3_partners'
      then jsonb_set(elem, '{name}', '"V3 Partners Soluções Ltda"')
      else elem
    end
  )
  from jsonb_array_elements(parties) as elem
)
where contract_code in ('V3C-PAR-2026-0037', 'V3C-PAR-2026-0038');

select contract_code, parties from operation_contracts where contract_code in ('V3C-PAR-2026-0037','V3C-PAR-2026-0038');
