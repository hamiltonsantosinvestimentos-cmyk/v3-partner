-- ============================================================
-- MIGRATION: cancelar envio para assinatura (volta o contrato a rascunho)
-- Date: 2026-10-22
-- BRIEF: 06_Operacional/SOPs/2026-10-22_Operacional_BRIEF-Cancelar-Envio-Assinatura-Central-Contratos_v1.html
--        (QA de governanca LIBERADO na rodada 5 de 6)
-- Contexto: contrato em enviado_assinatura nao tinha botao de cancelamento. A rota
-- POST /api/contracts/[id]/cancel-envelope cancela o documento na ClickSign e depois chama
-- esta funcao, que volta o contrato a rascunho de forma atomica (mesmo caminho em dois passos
-- de cancel_and_edit_contract). Nao exclui o contrato e nao mexe no lote de qualificacao.
-- p_origin = 'manual' (botao, motivo obrigatorio) ou 'provedor' (cancelamento detectado na
-- ClickSign pelo cron/atualizar status; ator de sistema com p_actor_id nulo).
-- audit_logs.user_id e operation_contract_versions.edited_by aceitam nulo (conferido em 22/10/2026).
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.cancel_signature_envelope(uuid, text, uuid, text, text);
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_signature_envelope(
  p_contract_id uuid,
  p_reason text,
  p_actor_id uuid,
  p_actor_name text,
  p_origin text DEFAULT 'manual'
)
RETURNS TABLE(out_envelope_id text, out_document_id text, out_provider text, out_contract_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
BEGIN
  IF p_origin NOT IN ('manual', 'provedor') THEN
    RAISE EXCEPTION 'Origem invalida' USING ERRCODE = 'P0001';
  END IF;
  IF p_origin = 'manual' AND coalesce(length(trim(p_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Motivo obrigatorio' USING ERRCODE = 'P0001';
  END IF;

  SELECT oc.id, oc.contract_code, oc.status_signature, oc.external_envelope_id,
         oc.external_document_id, oc.esignature_provider, oc.rendered_html
    INTO v
    FROM operation_contracts oc
   WHERE oc.id = p_contract_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato nao encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v.status_signature <> 'enviado_assinatura' OR v.external_envelope_id IS NULL THEN
    RAISE EXCEPTION 'Contrato nao esta enviado para assinatura' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO operation_contract_versions (contract_id, rendered_html, edited_by, edited_by_name, reason)
  VALUES (p_contract_id, v.rendered_html, p_actor_id, p_actor_name,
          'Envio cancelado: ' || coalesce(nullif(trim(p_reason), ''), 'motivo nao informado'));

  UPDATE operation_contracts SET status_signature = 'cancelado' WHERE id = p_contract_id;
  UPDATE operation_contracts
     SET status_signature = 'rascunho',
         external_envelope_id = NULL,
         external_document_id = NULL,
         sent_to_signature_at = NULL
   WHERE id = p_contract_id;

  INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, old_data, new_data)
  VALUES (p_actor_id, p_actor_name, 'contract_envelope_canceled', 'operation_contracts', p_contract_id::text,
          jsonb_build_object('envelope_id', v.external_envelope_id, 'document_id', v.external_document_id,
                             'provider', v.esignature_provider),
          jsonb_build_object('origin', p_origin, 'reason', p_reason, 'actor_name', p_actor_name));

  RETURN QUERY SELECT v.external_envelope_id, v.external_document_id, v.esignature_provider, v.contract_code;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_signature_envelope(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_signature_envelope(uuid, text, uuid, text, text) TO service_role;
