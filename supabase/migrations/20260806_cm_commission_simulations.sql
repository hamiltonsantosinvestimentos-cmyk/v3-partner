-- ============================================================
-- MIGRATION: Calculadora Rapida de Comissionamento, Recorrencia
--            e Exportacao de Lamina de Fechamento (Mesa de Capitais)
-- Date: 2026-08-06
-- Scope: log de simulacoes da calculadora rapida usada pela Mesa
--        antes de uma operacao existir formalmente (pre-operacao).
--        Acesso restrito ADMIN/GESTAO/MESA_OPERACIONAL, nunca
--        exposto a Partners (ver correcao paralela em
--        /api/cm/calculator e calculadora-widget.tsx no mesmo bloco).
-- Rollback: supabase/rollbacks/20260806_cm_commission_simulations_rollback.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS cm_commission_simulations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            uuid REFERENCES cm_asset_listings(id) ON DELETE SET NULL,
  deal_label            text,
  valor_face            numeric NOT NULL CHECK (valor_face > 0),
  desagio_pct           numeric CHECK (desagio_pct >= 0 AND desagio_pct <= 100),
  is_recorrente         boolean NOT NULL DEFAULT false,
  meses_recorrencia     integer NOT NULL DEFAULT 1 CHECK (meses_recorrencia BETWEEN 1 AND 60),
  fee_total_pct         numeric NOT NULL CHECK (fee_total_pct > 0 AND fee_total_pct <= 100),
  fee_v3_pct            numeric NOT NULL CHECK (fee_v3_pct >= 0),
  buy_side_pct          numeric NOT NULL CHECK (buy_side_pct >= 0),
  sell_side_pct         numeric NOT NULL CHECK (sell_side_pct >= 0),
  deducao_bancaria_pct  numeric NOT NULL DEFAULT 6 CHECK (deducao_bancaria_pct >= 0 AND deducao_bancaria_pct <= 100),
  resultado             jsonb NOT NULL,
  created_by            uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cm_commission_simulations_split_check
    CHECK (buy_side_pct + sell_side_pct + fee_v3_pct <= 100.0001)
);

COMMENT ON TABLE cm_commission_simulations IS 'Log de simulacoes da Calculadora Rapida (Mesa de Capitais): auditoria e reimpressao de lamina sem recalcular. Acesso restrito ADMIN/GESTAO/MESA_OPERACIONAL.';
COMMENT ON COLUMN cm_commission_simulations.listing_id IS 'Ativo real vinculado, quando a simulacao ja parte de um listing existente. NULL = simulacao pre-operacao (ainda nao ha ativo cadastrado).';
COMMENT ON COLUMN cm_commission_simulations.deal_label IS 'Rotulo livre para identificar a simulacao na lamina exportada quando listing_id e NULL.';
COMMENT ON COLUMN cm_commission_simulations.fee_v3_pct IS 'Parcela do fee total pertencente a V3 Partners por estruturacao/sanitizacao.';
COMMENT ON COLUMN cm_commission_simulations.buy_side_pct IS 'Parcela do fee total alocada ao lado Compra (Grupo Compra + Intermediarios Compra).';
COMMENT ON COLUMN cm_commission_simulations.sell_side_pct IS 'Parcela do fee total alocada ao lado Venda (Grupo Venda + Intermediarios Venda).';
COMMENT ON COLUMN cm_commission_simulations.deducao_bancaria_pct IS 'Deducao compulsoria sobre os repasses (hoje 6%, BluePay/fiscal), parametrizavel por simulacao, nunca hardcoded no frontend.';
COMMENT ON COLUMN cm_commission_simulations.resultado IS 'Snapshot completo do calculo (split por grupo, valores liquidos, volume acumulado): permite reabrir/reimprimir a lamina sem recalcular.';

DROP TRIGGER IF EXISTS trg_cm_commission_simulations_updated_at ON cm_commission_simulations;
CREATE TRIGGER trg_cm_commission_simulations_updated_at
  BEFORE UPDATE ON cm_commission_simulations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE cm_commission_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_commission_simulations_select ON cm_commission_simulations FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY cm_commission_simulations_insert ON cm_commission_simulations FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY cm_commission_simulations_delete ON cm_commission_simulations FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = 'ADMIN');

CREATE INDEX IF NOT EXISTS idx_cm_commission_simulations_listing ON cm_commission_simulations(listing_id);
CREATE INDEX IF NOT EXISTS idx_cm_commission_simulations_created ON cm_commission_simulations(created_at DESC);
