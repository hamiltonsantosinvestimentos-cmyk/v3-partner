-- =============================================================================
-- NOVA SERIE: Tokenizacao (Smart Contract / Registro em Blockchain)
-- =============================================================================
--
-- CONTEXTO
--   Joao Lemos apontou, na correcao do dicionario de setores (06/08/2026),
--   que a lista de mesas/verticais da V3 estava incompleta: faltava
--   Tokenizacao ao lado de M&A, Credito (CR/CRI), Consorcio e Bolsa de
--   Ativos.
--
--   Investigado antes de desenhar: Tokenizacao NAO e uma vertical que origina
--   operacao propria como as demais. E um SERVICO aplicado sobre operacoes de
--   outras origens:
--     - M&A (tokenizar participacao/ativo de um deal)
--     - Bolsa de Ativos (tokenizar um listing ja numerado em V3-BA-...)
--     - Captacao internacional (tokenizar instrumento de captacao cross-border)
--     - Terceirizacao: cliente externo sem NENHUMA operacao V3 por tras
--   O que importa registrar e o artefato on-chain: smart contract e o
--   registro em blockchain, nao a operacao de origem.
--
-- POR QUE SERIE PROPRIA E NAO SUB-NUMERACAO DE BA
--   O caso de terceirizacao (cliente externo, sem listing em Bolsa de Ativos)
--   nao teria onde existir se o codigo de tokenizacao fosse embutido dentro
--   da serie BA. Mesmo desenho ja aplicado aos contratos (V3C-*): a operacao
--   de origem, quando existe, e referenciada por COLUNA com constraint, nunca
--   por texto dentro do codigo -- porque o codigo de tokenizacao pode nao ter
--   nenhuma operacao de origem para referenciar.
--
-- ESTADO REAL, HONESTO
--   Nenhuma tabela de tokenizacao/smart contract existe hoje no portal
--   (confirmado: tokenizacoes, tokenizations, smart_contracts,
--   blockchain_tokens -- nenhuma existe). Esta migration reserva a serie,
--   no mesmo padrao ja usado para CRI (Credito Internacional) em
--   20260805a: o trilho fica pronto e sem uso ate a feature de tokenizacao
--   ser especificada e construida (BRIEF proprio, fora do escopo desta
--   correcao de numeracao).
--
-- SEGURANCA
--   Apenas um INSERT em v3_code_series (tabela ja existe desde 20260805a).
--   Nenhuma tabela nova, nenhum ALTER. Idempotente via ON CONFLICT DO NOTHING.
-- =============================================================================

insert into public.v3_code_series
  (id, label, prefix, segment_class, scope_grain, seq_width, target_table, target_column, notes)
values
  ('TOK', 'Tokenização (Smart Contract / Blockchain)', 'V3-TOK', 'none', 'ano_mes', 3,
   null, null,
   'Servico aplicado sobre operacoes de M&A, Bolsa de Ativos ou captacao internacional, e tambem oferecido a terceiros (terceirizacao) sem nenhuma operacao V3 de origem. Por isso nao usa segmento de setor: o token pode representar ativos de qualquer setor, ou nenhum. Quando a feature real for construida, a operacao de origem (quando existir) deve ser referenciada por coluna nullable (origin_vertical + origin_operation_code), nunca por texto dentro do codigo -- mesmo padrao dos contratos V3C-*. Serie reservada em 06/08/2026, sem tabela/fluxo implementado ainda.')
on conflict (id) do nothing;
