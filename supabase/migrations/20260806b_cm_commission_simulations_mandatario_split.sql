-- ============================================================
-- MIGRATION: Calculadora Rapida Fase 2 (Mandatario/Titular +
--            Grupo de Intermediarios por lado, PDF segregado)
-- Date: 2026-08-06
-- Scope: guarda o que foi digitado (valor bruto ou percentual)
--        para o Mandatario de cada lado, para auditoria/reimpressao
--        fiel. O breakdown derivado (V3 por lado, Intermediarios,
--        liquidos) continua vivendo dentro da coluna resultado
--        (jsonb), mesmo padrao de snapshot da Fase 1, sem coluna
--        nova para cada numero derivado.
-- BREAKING (nao no schema, no formato do JSON): a partir desta
--        revisao, resultado.split (Fase 1) deixa de ser escrito.
--        O formato novo e resultado.buy_side / resultado.sell_side.
--        Sem impacto real: tabela confirmada vazia em producao
--        antes desta migration (0 linhas).
-- Rollback: supabase/rollbacks/20260806b_cm_commission_simulations_mandatario_split_rollback.sql
-- ============================================================

ALTER TABLE cm_commission_simulations
  ADD COLUMN IF NOT EXISTS buy_mandatario_input_value numeric,
  ADD COLUMN IF NOT EXISTS buy_mandatario_input_unit text CHECK (buy_mandatario_input_unit IN ('pct','valor')),
  ADD COLUMN IF NOT EXISTS sell_mandatario_input_value numeric,
  ADD COLUMN IF NOT EXISTS sell_mandatario_input_unit text CHECK (sell_mandatario_input_unit IN ('pct','valor'));

COMMENT ON COLUMN cm_commission_simulations.buy_mandatario_input_value IS 'Valor exatamente como digitado pela Mesa para o Mandatario/Titular do lado Compra (percentual do lado OU R$ direto, ver buy_mandatario_input_unit). Grupo de Intermediarios Compra nunca e digitado, e sempre o restante automatico.';
COMMENT ON COLUMN cm_commission_simulations.buy_mandatario_input_unit IS 'pct = buy_mandatario_input_value e percentual do lado Compra. valor = buy_mandatario_input_value e R$ bruto direto.';
COMMENT ON COLUMN cm_commission_simulations.sell_mandatario_input_value IS 'Mesmo campo que buy_mandatario_input_value, para o lado Venda.';
COMMENT ON COLUMN cm_commission_simulations.sell_mandatario_input_unit IS 'Mesmo campo que buy_mandatario_input_unit, para o lado Venda.';
