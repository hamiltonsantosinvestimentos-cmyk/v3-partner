ALTER TABLE public.credit_desk_proposals
  ADD COLUMN IF NOT EXISTS credit_profile_id UUID NULL
    REFERENCES public.credit_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.credit_profiles
  ADD CONSTRAINT fk_credit_profiles_deal_proposal
    FOREIGN KEY (deal_proposal_id)
    REFERENCES public.credit_desk_proposals(id)
    ON DELETE SET NULL
    NOT VALID;

CREATE INDEX IF NOT EXISTS idx_cdp_credit_profile
  ON public.credit_desk_proposals(credit_profile_id);
