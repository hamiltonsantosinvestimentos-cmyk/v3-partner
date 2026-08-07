-- =============================================================================
-- GOVERNANCA DE NUMERACAO V3, FASE 1d
-- Numero de contrato obrigatorio na Central de Contratos (operation_contracts)
-- =============================================================================
--
-- CONTEXTO
--   Joao Lemos perguntou, em 07/08/2026, se a Central de Contratos (onde
--   contratos com fornecedores e novos fundos serao enviados) ja estava
--   coberta pela governanca de numeracao. Nao estava: operation_contracts
--   (motor generico por template, tela /juridico/contratos) tem 8 contratos
--   reais gravados desde 21/06/2026, nenhum numerado.
--
--   Causa raiz que teria feito o problema voltar sozinho: contract_templates
--   nao declara a que serie pertence, so tem template_name em texto livre.
--   Sem uma coluna explicita, todo template novo (fornecedor, fundo, ou
--   qualquer outro) nasceria sem numeracao ate alguem lembrar de tratar esse
--   caso -- o mesmo padrao de falha ja visto nesta governanca inteira.
--
--   Investigado antes de desenhar (nao adivinhado): os 8 contratos reais sao
--   todos NDA (vertical capital_markets). As outras 5 templates (Carta de
--   Intencao, FPA Venda, FPA Compra, Compra e Venda de Ativo Naval, Anexo de
--   Comissionamento) existem mas nunca geraram contrato.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Expande a familia V3C-* com as series que faltavam, confirmadas com
--      Joao antes de gravar: LOI (Carta de Intencao), FPA (Acordo de
--      Protecao de Honorarios), FOR (Fornecedor, novo, pedido nesta sessao),
--      FUN (Fundo, novo, pedido nesta sessao). V3C-CES passa a cobrir tanto
--      cessao de credito quanto compra-e-venda de ativo (mesma familia
--      juridica: transferencia de titularidade). V3C-NDA, V3C-MAN, V3C-ORG
--      ja existiam.
--   2. contract_templates ganha contract_series (FK para v3_code_series.id):
--      todo template passa a DECLARAR a propria serie, em vez do sistema
--      tentar adivinhar pelo nome. Um template sem serie nao gera contrato
--      (falha alto e explicito, nunca silencioso).
--   3. Backfill dos 6 templates existentes com a serie correta.
--   4. operation_contracts ganha contract_code, preenchido nos 8 contratos
--      reais em ordem cronologica.
--   5. contract_code passa a UNIQUE e NOT NULL.
--   6. v3_code_series.V3C-NDA passa a apontar para a tabela/coluna reais.
--
-- SEGURANCA
--   Aditivo + backfill antes de qualquer NOT NULL, mesmo padrao ja usado em
--   20260807a. Tabelas pequenas (6 templates, 8 contratos): validar tudo de
--   uma vez e trivial.
-- =============================================================================

insert into public.v3_code_series
  (id, label, prefix, segment_class, scope_grain, seq_width, target_table, target_column, notes)
values
  ('V3C-LOI', 'Carta de Intenção', 'V3C-LOI', 'none', 'ano', 4, null, null,
   'Carta de Intencao de Compra/Venda (LOI). Documento preliminar, distinto do contrato definitivo (V3C-CES).'),
  ('V3C-FPA', 'Acordo de Proteção de Honorários', 'V3C-FPA', 'none', 'ano', 4, null, null,
   'FPA/NCND -- protege comissionamento de partner/intermediario/finder. Distinto do contrato de compra e venda em si.'),
  ('V3C-FOR', 'Contrato de Fornecedor', 'V3C-FOR', 'none', 'ano', 4, null, null,
   'Contratos com fornecedores da V3, enviados pela Central de Contratos. Serie criada a pedido de Joao Lemos em 07/08/2026.'),
  ('V3C-FUN', 'Contrato de Fundo', 'V3C-FUN', 'none', 'ano', 4, null, null,
   'Contratos com novos fundos (parceria, co-investimento, distribuicao), enviados pela Central de Contratos. Serie criada a pedido de Joao Lemos em 07/08/2026.')
on conflict (id) do nothing;

comment on table public.v3_code_series is
  'Registro vivo da tabela de nomenclatura V3. Duas familias: verticais operacionais (MA, CR, CRI, BA, PR, CS, TOK -- ver deal_sector_codes para setor economico, dicionario separado) e contratos V3C-* (ORG generico, MAN mandato, PAR adesao de partner, CES cessao/compra-e-venda, NDA, LOI carta de intencao, FPA protecao de honorarios, FOR fornecedor, FUN fundo). Fonte unica: nunca criar entrada nova sem antes verificar sobreposicao com as existentes.';

-- -----------------------------------------------------------------------------
-- contract_templates: cada template declara a propria serie
-- -----------------------------------------------------------------------------

alter table public.contract_templates
  add column if not exists contract_series text references public.v3_code_series(id);

comment on column public.contract_templates.contract_series is
  'Serie de numeracao (v3_code_series.id) que os contratos gerados a partir deste template recebem. OBRIGATORIO para gerar contrato -- ver app/api/contracts/generate. Nunca inferir a serie pelo nome do template: declarar aqui explicitamente.';

-- Backfill dos 6 templates reais, por nome exato (nao por padrao/like, para
-- nao classificar errado um template futuro com nome parecido).
update public.contract_templates set contract_series = 'V3C-NDA' where template_name in ('NDA (Comprador Bolsa de Ativos)', 'NDA — Comprador Bolsa de Ativos');
update public.contract_templates set contract_series = 'V3C-LOI' where template_name = 'Carta de Intencao de Compra (Matching)';
update public.contract_templates set contract_series = 'V3C-CES' where template_name = 'Contrato de Compra e Venda de Ativo Naval';
update public.contract_templates set contract_series = 'V3C-FPA' where template_name in ('FPA Venda (Acordo de Protecao de Honorarios)', 'FPA Compra');
update public.contract_templates set contract_series = 'V3C-FPA' where template_name = 'Anexo FPA/NCND: Distribuição de Comissionamento';

-- Qualquer template que tenha escapado do backfill acima cai no generico, em
-- vez de ficar sem serie (nunca silencioso, mas tambem nunca bloqueante para
-- os templates que ja existiam antes desta migration).
update public.contract_templates set contract_series = 'V3C-ORG' where contract_series is null;

alter table public.contract_templates
  alter column contract_series set not null;

-- -----------------------------------------------------------------------------
-- operation_contracts: numero real por contrato gerado
-- -----------------------------------------------------------------------------

alter table public.operation_contracts
  add column if not exists contract_code text;

comment on column public.operation_contracts.contract_code is
  'Numero do contrato, emitido por next_v3_code(template.contract_series, null) no momento da geracao -- nunca calculado na rota. A operacao de origem, quando existe, ja e referenciada pelas colunas listing_id/bid_id/deal_id/credit_proposal_id/qualification_batch_id proprias desta tabela.';

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select oc.id, ct.contract_series
      from public.operation_contracts oc
      join public.contract_templates ct on ct.id = oc.template_id
     where oc.contract_code is null
     order by oc.created_at asc, oc.id asc
  loop
    v_code := public.next_v3_code(r.contract_series, null);
    update public.operation_contracts set contract_code = v_code where id = r.id;
  end loop;
end $$;

alter table public.operation_contracts
  alter column contract_code set not null;

alter table public.operation_contracts
  add constraint operation_contracts_contract_code_unique unique (contract_code);

update public.v3_code_series
   set target_table = 'operation_contracts',
       target_column = 'contract_code'
 where id = 'V3C-NDA';
