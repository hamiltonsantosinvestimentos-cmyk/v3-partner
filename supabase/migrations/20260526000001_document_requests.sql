-- 20260526000001_document_requests.sql
-- Ciclo de solicitação de documentos: Mesa → Partner
-- Gerado automaticamente pelo FORJA ao detectar campos ausentes com prioridade ALTA/MEDIA

BEGIN;

CREATE TABLE IF NOT EXISTS ma_document_requests (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id             uuid NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
  forja_snapshot_at   timestamptz,                    -- quando o FORJA foi rodado que gerou este pedido
  requested_by        uuid REFERENCES profiles(id),   -- usuário da mesa que criou/enviou
  documents           jsonb NOT NULL DEFAULT '[]',    -- array de DocRequestItem (ver abaixo)
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','partial','complete','cancelled')),
  email_sent          boolean NOT NULL DEFAULT false,
  email_sent_at       timestamptz,
  partner_email       text,                           -- email do partner no momento do envio
  notes               text,                           -- observações internas da mesa
  deadline            date,                           -- prazo para o partner entregar
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Estrutura de cada item em documents[]:
-- {
--   id: string (uuid local),
--   tipo: "DRE" | "Balanco" | "Certidao" | "Contrato Social" | "NDA" | "Laudo" | "Contrato" | "Matricula" | "Relatorio" | "Mandato",
--   descricao: string,
--   campos_ausentes: string[],
--   priority: "ALTA" | "MEDIA" | "BAIXA",
--   status: "pending" | "received" | "processed" | "rejected",
--   received_at: string | null,
--   doc_id: string | null   -- preenchido quando o partner faz upload
-- }

CREATE INDEX IF NOT EXISTS idx_doc_requests_deal   ON ma_document_requests(deal_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_status ON ma_document_requests(status);

CREATE TRIGGER trg_doc_requests_updated_at
  BEFORE UPDATE ON ma_document_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ma_document_requests ENABLE ROW LEVEL SECURITY;

-- Mesa e Admin podem criar/editar — Partners apenas leem os próprios deals (via deal_id)
CREATE POLICY "mesa_all_doc_requests" ON ma_document_requests FOR ALL
  USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL','MESA'));

CREATE POLICY "partner_read_own_deal_requests" ON ma_document_requests FOR SELECT
  USING (
    get_user_role() IN ('PARTNER','PARTNER_PRO')
    AND deal_id IN (
      SELECT id FROM ma_deals WHERE created_by = auth.uid()
    )
  );

COMMIT;
