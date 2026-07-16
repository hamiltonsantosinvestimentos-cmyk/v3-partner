-- crm_leads.credit_proposal_id foi criado sem ON DELETE, o que bloqueia a
-- exclusão de propostas em credit_desk_proposals quando existe um lead
-- vinculado (erro de foreign key, mascarado no front-end que já removia o
-- card da tela otimisticamente antes de confirmar a resposta da API).
ALTER TABLE crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_credit_proposal_id_fkey;

ALTER TABLE crm_leads
  ADD CONSTRAINT crm_leads_credit_proposal_id_fkey
    FOREIGN KEY (credit_proposal_id)
    REFERENCES credit_desk_proposals(id)
    ON DELETE SET NULL;
