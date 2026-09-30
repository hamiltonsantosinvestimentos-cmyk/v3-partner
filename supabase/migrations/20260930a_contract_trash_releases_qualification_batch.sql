-- ============================================================
-- MIGRATION: contrato em rascunho enviado à Lixeira libera o lote de qualificação
-- Date: 2026-09-30
-- Contexto: NCNDA V3C-NDA-2026-0050 nasceu na vertical errada (Bolsa de Ativos),
-- e o lote de qualificação dele ficou consumido (single-use), travando a esteira:
-- editar/adicionar parte no lote dava 409 e não havia como regerar em outra mesa.
--
-- Regra: quando um contrato vai para a Lixeira (deleted_at deixa de ser nulo), o lote
-- que ele consumia volta a ficar disponível para a MESMA operação/minuta. Ao restaurar
-- da Lixeira, o lote volta a ser consumido por ele, exceto se outro contrato já o usou
-- (aí a restauração é barrada, para não quebrar o uso único).
-- Vale para qualquer caminho de exclusão (rota cancel-draft ou exclusão aprovada).
--
-- ⚠️ ROBSON: reabre o controle de uso único do lote (LGPD). Aplicar em produção só
-- depois do parecer dele sobre finalidade, base legal e retenção de 30 dias na Lixeira.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_operation_contracts_batch_lifecycle ON operation_contracts;
--   DROP FUNCTION IF EXISTS public.trg_operation_contracts_batch_lifecycle();
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_operation_contracts_batch_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released int := 0;
  v_other text;
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    WITH r AS (
      UPDATE cm_qualification_batches
         SET consumido_por_contract_id = NULL
       WHERE consumido_por_contract_id = NEW.id
      RETURNING id
    )
    SELECT count(*) INTO v_released FROM r;

    IF v_released > 0 THEN
      INSERT INTO audit_logs (user_id, action, entity, entity_id, old_data, new_data)
      VALUES (
        NEW.deleted_by,
        'qualification_batch_released',
        'operation_contracts',
        NEW.id::text,
        jsonb_build_object('contract_code', NEW.contract_code, 'batch_id', NEW.qualification_batch_id),
        jsonb_build_object('batches_released', v_released, 'reason', NEW.deletion_reason)
      );
    END IF;

  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND NEW.qualification_batch_id IS NOT NULL THEN
    SELECT oc.contract_code INTO v_other
      FROM cm_qualification_batches b
      JOIN operation_contracts oc ON oc.id = b.consumido_por_contract_id
     WHERE b.id = NEW.qualification_batch_id
       AND b.consumido_por_contract_id <> NEW.id;

    IF FOUND THEN
      RAISE EXCEPTION 'Não é possível restaurar: o lote de qualificação deste contrato já foi usado pelo contrato %. Cancele esse contrato antes de restaurar este.', v_other;
    END IF;

    UPDATE cm_qualification_batches
       SET consumido_por_contract_id = NEW.id
     WHERE id = NEW.qualification_batch_id
       AND consumido_por_contract_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operation_contracts_batch_lifecycle ON operation_contracts;
CREATE TRIGGER trg_operation_contracts_batch_lifecycle
  AFTER UPDATE OF deleted_at ON operation_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_operation_contracts_batch_lifecycle();
