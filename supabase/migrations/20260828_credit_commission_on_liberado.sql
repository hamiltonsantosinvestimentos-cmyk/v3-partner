-- ============================================================
-- MIGRATION: Comissões de crédito geradas ao liberar o recurso
-- Date: 2026-08-28
-- Scope: quando uma proposta de crédito entra no estágio LIBERADO ("Recurso
--        Liberado") na Mesa Operacional, o backend passa a criar automaticamente
--        os registros de comissão (licenciado + indicação 10%) na tabela
--        commissions, com status AGUARDANDO_AUTORIZACAO. ADMIN/FINANCEIRO
--        autorizam o pagamento e definem a data prevista na aba Comissões.
--
-- Rollback:
--   ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
--   ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
--     CHECK (status IN ('A_PAGAR','PAGA','CANCELADA'));
--   ALTER TABLE commissions DROP COLUMN IF EXISTS authorized_by;
--   ALTER TABLE commissions DROP COLUMN IF EXISTS authorized_at;
--   DROP INDEX IF EXISTS uq_commissions_credito_licenciado;
-- ============================================================

-- ── 1. Novo status AGUARDANDO_AUTORIZACAO ──
-- Estado inicial das comissões geradas na liberação do recurso: só vira
-- A_PAGAR depois que ADMIN/FINANCEIRO autoriza e informa a data prevista.
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions
  ADD CONSTRAINT commissions_status_check
  CHECK (status IN ('AGUARDANDO_AUTORIZACAO', 'A_PAGAR', 'PAGA', 'CANCELADA'));

-- ── 2. Autoria da autorização de pagamento ──
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz;

-- ── 3. Idempotência ──
-- Garante no máximo UMA comissão de licenciado por proposta de crédito, mesmo
-- que a proposta saia e volte para LIBERADO. A comissão de indicação (10%)
-- tem is_referral_commission = true e fica de fora deste índice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_commissions_credito_licenciado
  ON commissions (operation_id)
  WHERE operation_type = 'CREDITO'
    AND is_referral_commission = false
    AND operation_id IS NOT NULL;

-- ── 4. Conferência ──
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'commissions_status_check';
-- SELECT code, partner_id, operation_type, operation_code, commission_value, status, authorized_by, authorized_at
--   FROM commissions WHERE operation_type = 'CREDITO' ORDER BY created_at DESC LIMIT 20;
