-- P0 achado durante teste real do BRIEF 2 (Governança Financeira/LOI/
-- Auditoria), 30/08/2026, fora do escopo original, corrigido pela
-- severidade e ligação direta com a dor relatada por João nesta mesma
-- sessão ("contrato simples trava sem razão").
--
-- check_contract_quorum() (trigger em contract_approvals, dispara desde
-- sempre) referenciava 'em_revisao' num WHERE status_signature IN (...).
-- O enum contract_signature_status NUNCA teve esse valor (só rascunho,
-- enviado_assinatura, assinado, recusado, expirado, cancelado) — Postgres
-- rejeita o literal no parse da query, então TODO segundo voto 'aprovado'
-- em QUALQUER contrato (não só LOI) derrubava com erro 500, sempre,
-- desde que esta função foi criada. Confirmado ao vivo: inserir a 2a
-- aprovação de teste bateu exatamente nesse erro.
--
-- Fix: remove o literal inválido. status_signature só pode legitimamente
-- estar em 'rascunho' nesse ponto do fluxo (contrato já enviado nunca
-- volta a receber voto por este trigger).

CREATE OR REPLACE FUNCTION public.check_contract_quorum()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  approve_count integer;
BEGIN
  IF NEW.decision = 'aprovado' THEN
    SELECT count(*) INTO approve_count
    FROM contract_approvals
    WHERE contract_id = NEW.contract_id AND decision = 'aprovado';

    -- Quorum: 2 de 3 socios (ou 3/3 quando loi_matching_status=nao_casada,
    -- reforçado em app/api/contracts/[id]/send/route.ts, que é a barreira
    -- real; este trigger só sincroniza status/approved_by).
    IF approve_count >= 2 THEN
      UPDATE operation_contracts
      SET status_signature = 'enviado_assinatura',
          approval_count = approve_count,
          approved_by = ARRAY(
            SELECT approver_id FROM contract_approvals
            WHERE contract_id = NEW.contract_id AND decision = 'aprovado'
          )
      WHERE id = NEW.contract_id AND status_signature = 'rascunho';
    ELSE
      UPDATE operation_contracts
      SET approval_count = approve_count
      WHERE id = NEW.contract_id;
    END IF;
  ELSIF NEW.decision = 'reprovado' THEN
    UPDATE operation_contracts
    SET status_signature = 'rascunho', approval_count = 0, approved_by = '{}'
    WHERE id = NEW.contract_id;
    -- Limpa aprovacoes anteriores para forcar nova rodada
    DELETE FROM contract_approvals
    WHERE contract_id = NEW.contract_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
