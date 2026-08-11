update operation_contracts
set parties = (
  select jsonb_agg(
    case when elem->>'role' = 'closer'
      then jsonb_set(elem, '{doc}', '"CNPJ 15.133.730/0001-38 · CPF 100.040.226-61"')
      else elem
    end
  )
  from jsonb_array_elements(parties) as elem
)
where contract_code = 'V3C-PAR-2026-0037';

select contract_code, parties from operation_contracts where contract_code = 'V3C-PAR-2026-0037';
