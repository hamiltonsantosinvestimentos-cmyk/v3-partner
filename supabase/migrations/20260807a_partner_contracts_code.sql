-- =============================================================================
-- GOVERNANCA DE NUMERACAO V3, FASE 1c
-- Numero de contrato obrigatorio em partner_contracts
-- =============================================================================
--
-- CONTEXTO
--   partner_contracts tem 35 contratos assinados desde 23/04/2026, nenhum
--   com numero proprio. E o unico tipo de contrato que esta tabela guarda
--   (schema confirmado: plano PARTNER/PARTNER_PRO, valor_mensal, contract_html
--   -- adesao de partner a rede, sempre). Corresponde exatamente a serie
--   V3C-PAR ("Adesao de Partner"), ja reservada em v3_code_series desde
--   20260805a como a UNICA serie de contrato que nao exige operacao de
--   origem: adesao a rede nao nasce de uma operacao.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Adiciona contract_code e operation_code (nullable) em partner_contracts
--   2. Backfill dos 35 contratos existentes, em ORDEM CRONOLOGICA de
--      accepted_at -- o primeiro partner a assinar recebe V3C-PAR-2026-0001,
--      preservando a leitura historica correta
--   3. contract_code passa a UNIQUE e NOT NULL (seguro fazer isso na mesma
--      migration do backfill: nenhuma linha fica sem valor entre os dois
--      passos)
--   4. operation_code recebe CHECK garantindo que permanece nulo nesta
--      tabela -- adesao de partner nao referencia operacao, e um valor aqui
--      seria erro de modelagem, nao dado legitimo
--   5. v3_code_series.V3C-PAR passa a apontar para a tabela/coluna reais, para
--      que o loop de verificacao de colisao dentro de next_v3_code() passe a
--      checar contra dado de verdade (antes o trilho existia sem alvo)
--
-- SEGURANCA
--   ALTER TABLE aditivo (colunas novas), depois backfill, depois NOT NULL --
--   nessa ordem nao ha janela em que uma linha exista sem contract_code
--   quando a constraint entra. Tabela pequena (35 linhas): sem necessidade de
--   NOT VALID + VALIDATE em separado, o custo de validar tudo de uma vez e
--   irrelevante.
-- =============================================================================

alter table public.partner_contracts
  add column if not exists contract_code text,
  add column if not exists operation_code text;

comment on column public.partner_contracts.contract_code is
  'Numero do contrato, serie V3C-PAR (Adesao de Partner). Emitido por next_v3_code(''V3C-PAR'', null) -- nunca calculado na aplicacao.';
comment on column public.partner_contracts.operation_code is
  'Sempre NULL nesta tabela: adesao de partner nao nasce de uma operacao de origem. Coluna existe para consistencia com as demais series de contrato (V3C-ORG, V3C-MAN, V3C-CES, V3C-NDA), que quando implementadas devem referenciar aqui o codigo da operacao que originou o contrato.';

-- Backfill em ordem cronologica: quem assinou primeiro recebe o menor numero.
do $$
declare
  r record;
  v_code text;
begin
  for r in
    select id from public.partner_contracts
     where contract_code is null
     order by accepted_at asc nulls last, id asc
  loop
    v_code := public.next_v3_code('V3C-PAR', null);
    update public.partner_contracts set contract_code = v_code where id = r.id;
  end loop;
end $$;

alter table public.partner_contracts
  alter column contract_code set not null;

alter table public.partner_contracts
  add constraint partner_contracts_contract_code_unique unique (contract_code);

alter table public.partner_contracts
  add constraint partner_contracts_operation_code_null_check
  check (operation_code is null);

-- Agora que a coluna real existe, o emissor passa a checar colisao contra ela.
update public.v3_code_series
   set target_table = 'partner_contracts',
       target_column = 'contract_code'
 where id = 'V3C-PAR';
