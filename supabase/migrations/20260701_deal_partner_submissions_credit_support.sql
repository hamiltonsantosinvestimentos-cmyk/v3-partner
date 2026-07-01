-- Suporte a propostas de crédito em deal_partner_submissions
-- Torna deal_id nullable e adiciona proposal_id FK para credit_desk_proposals

ALTER TABLE deal_partner_submissions ALTER COLUMN deal_id DROP NOT NULL;

ALTER TABLE deal_partner_submissions
  ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES credit_desk_proposals(id) ON DELETE CASCADE;

ALTER TABLE deal_partner_submissions
  ADD CONSTRAINT chk_deal_or_proposal
  CHECK (deal_id IS NOT NULL OR proposal_id IS NOT NULL);
