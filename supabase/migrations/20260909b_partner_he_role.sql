-- Papel PARTNER_HE ("Partner HE") — parceiro de plano enxuto (R$ 97/mês) que só
-- origina as 4 linhas da família Home Equity na Mesa de Crédito:
--   HOME EQUITY · HOMECASH · CRÉDITO NO AVAL/ RECEBIVEIS · ANTECIPAÇÃO DE CONTRATOS (CONTRATOS PUBLICOS)
-- Comissão de 50% (lib/constants.ts PLAN_COMMISSION_PCT). A trava das linhas é
-- na aplicação (modal de nova proposta + POST /api/credit-proposals).
--
-- ADD VALUE é idempotente com IF NOT EXISTS e não pode rodar dentro de um bloco
-- de transação junto com uso do valor — por isso vem sozinho neste arquivo.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PARTNER_HE';
