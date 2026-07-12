ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS credit_proposal_id uuid REFERENCES credit_desk_proposals(id);
