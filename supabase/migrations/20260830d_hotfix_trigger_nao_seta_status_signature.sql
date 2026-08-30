-- Hotfix imediato (30/08/2026), pedido explícito de João após revisar o
-- relatório do BRIEF 2: a trigger check_contract_quorum() setava
-- status_signature = 'enviado_assinatura' assim que o quórum de sócios
-- fechava (2+ aprovações), SEM o envelope da ClickSign ter sido criado.
-- Risco real de deadlock: send/route.ts só aceita reenviar contrato com
-- status IN ('rascunho', 'aprovado') — se o quórum fechasse antes do
-- clique em "Enviar para Assinatura", o contrato ficaria marcado como
-- "enviado" pra sempre, sem envelope real existir, e sem caminho pra
-- corrigir por essa rota.
--
-- Achado real ao investigar (não suposição): app/api/contracts/[id]/
-- send/route.ts JÁ estava correto quanto aos itens 2 e 3 deste hotfix —
-- só seta status_signature='enviado_assinatura' depois de
-- `result.ok` (a ClickSign confirmar), e se `!result.ok` retorna 502 sem
-- tocar no status, permitindo retry. O gap real era só a trigger
-- competindo com esse fluxo por fora.
--
-- Fix: a trigger só sincroniza approval_count/approved_by (contagem de
-- votos), nunca mais muda status_signature. Quem manda no status
-- continua sendo exclusivamente send/route.ts (após confirmação real da
-- ClickSign) e o webhook/sync de assinatura (contratos assinados).

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

    -- Só sincroniza contagem/lista de aprovadores. O quórum atingido
    -- HABILITA o envio (a UI/rota de aprovação já expõe isso), nunca
    -- executa o envio sozinho nem muda o status de assinatura.
    UPDATE operation_contracts
    SET approval_count = approve_count,
        approved_by = ARRAY(
          SELECT approver_id FROM contract_approvals
          WHERE contract_id = NEW.contract_id AND decision = 'aprovado'
        )
    WHERE id = NEW.contract_id;
  ELSIF NEW.decision = 'reprovado' THEN
    UPDATE operation_contracts
    SET approval_count = 0, approved_by = '{}'
    WHERE id = NEW.contract_id;
    -- Limpa aprovacoes anteriores para forcar nova rodada
    DELETE FROM contract_approvals
    WHERE contract_id = NEW.contract_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
