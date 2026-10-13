-- Mandato de Crédito (13/10/2026, pedido do Hamilton): sai a letra (b) da
-- cláusula 3.7 nas minutas PF e PJ (taxa de 0,20% sobre cada valor antecipado).
-- A 3.7 fica só com a Remuneração de Sucesso sobre o limite aprovado.
-- Vale para os mandatos gerados daqui para frente; os já enviados não mudam.
-- As minutas continuam aprovadas (decisão comercial dos sócios, sem passar de
-- novo pela revisão jurídica da Central de Contratos); a versão sobe em 1.

update contract_templates
set body_text_raw = replace(
      replace(
        body_text_raw,
        $a$Nas operações de antecipação de recebíveis, (a) a Remuneração de Sucesso$a$,
        $a$Nas operações de antecipação de recebíveis, a Remuneração de Sucesso$a$
      ),
      $b$, sendo devida na Data da Concretização; e (b) a CONTRATANTE pagará ainda à CONTRATADA <strong>0,20% (zero vírgula vinte por cento)</strong> sobre cada valor efetivamente antecipado no âmbito desse limite e de suas renovações, em até 2 (dois) dias úteis de cada antecipação.</p>$b$,
      $b$, sendo devida na Data da Concretização.</p>$b$
    ),
    version = coalesce(version, 0) + 1
where template_name in ('Mandato de Crédito (Cliente PF)', 'Mandato de Crédito (Cliente PJ)')
  and body_text_raw like '%(zero vírgula vinte por cento)%';

-- Conferência: as duas devem voltar com tem_0_20 = false.
select template_name, version, approval_status,
       body_text_raw like '%0,20%%' as tem_0_20
from contract_templates
where template_name like 'Mandato de Crédito (Cliente %';
