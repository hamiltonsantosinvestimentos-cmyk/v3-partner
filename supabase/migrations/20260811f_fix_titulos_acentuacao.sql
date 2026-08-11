update operation_contracts set contract_title = 'Contrato de Parceria Comercial e Intermediação de Negócios, Home Cash'
where contract_code = 'V3C-PAR-2026-0038';

update contract_templates set template_name = 'Contrato de Parceria Comercial e Intermediação de Negócios, Home Cash'
where template_name = 'Contrato de Parceria Comercial e Intermediacao de Negocios, Home Cash';

update operation_contracts set contract_title = 'Contrato de Parceria Comercial, Closer & Partner PRO, Iris Rodrigues da Silva'
where contract_code = 'V3C-PAR-2026-0037';

select contract_code, contract_title from operation_contracts where contract_code in ('V3C-PAR-2026-0037','V3C-PAR-2026-0038');
