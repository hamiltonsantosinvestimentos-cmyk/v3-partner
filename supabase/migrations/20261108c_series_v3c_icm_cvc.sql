-- 20261108c: séries de contrato para operações de commodities (decisão de João em 08/11/2026).
-- Siglas confirmadas por João (regra de numeração: confirmar a sigla antes de gravar):
--   V3C-ICM  Contrato de Intermediação e Compliance de Commodities (contrato de cada ponta, Fase 1)
--   V3C-CVC  Contrato de Compra e Venda de Commodities com Intermediação e Monitoria (contrato único, Fase 2)
-- O NDA continua em V3C-NDA. Mesma estrutura das demais V3C: numeração por ano, 4 dígitos, sem classe.
-- Só cria as duas linhas de série; nenhum código é emitido aqui. Os dois .docx de minuta do milho ainda
-- estão fora da Central de Contratos; a série passa a valer quando entrarem lá, com minuta aprovada e pré-voo.
-- Rollback: 20261108c_series_v3c_icm_cvc_rollback.sql.txt

insert into public.v3_code_series
  (id, label, prefix, segment_class, scope_grain, seq_width, target_table, target_column, active, notes)
values
  ('V3C-ICM', 'Contrato de Intermediação e Compliance de Commodities', 'V3C-ICM', 'none', 'ano', 4,
   'operation_contracts', 'contract_code', true,
   'Contrato de cada ponta (compra e venda) da operação de commodities, Fase 1: intermediação, due diligence, compliance e monitoria. Serviço contratual da V3, distinto do mandato (V3C-MAN). Série criada a pedido de João Lemos em 08/11/2026.'),
  ('V3C-CVC', 'Contrato de Compra e Venda de Commodities com Intermediação e Monitoria', 'V3C-CVC', 'none', 'ano', 4,
   'operation_contracts', 'contract_code', true,
   'Contrato único de compra e venda da operação de commodities, Fase 2, assinado por comprador, vendedor e V3, com intermediação e monitoria. Série criada a pedido de João Lemos em 08/11/2026.')
on conflict (id) do nothing;
