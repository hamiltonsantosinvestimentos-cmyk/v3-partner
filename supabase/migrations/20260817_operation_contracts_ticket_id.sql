-- Permite gerar contratos (NDA, etc.) pela Central de Contratos a partir de
-- um ticket da Mesa Operacional, do mesmo jeito que ja funciona para
-- listing_id, bid_id, deal_id e credit_proposal_id.

ALTER TABLE public.operation_contracts
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.operational_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operation_contracts_ticket_id ON public.operation_contracts (ticket_id) WHERE ticket_id IS NOT NULL;
