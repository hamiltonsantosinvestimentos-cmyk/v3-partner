CREATE TABLE IF NOT EXISTS public.credit_consents (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at               TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Sujeito
  subject_cpf_cnpj         TEXT NOT NULL,
  subject_name             TEXT NOT NULL,
  subject_email            TEXT,

  -- Token de intake público
  intake_token             TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  intake_expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),

  -- Consentimento LGPD
  consented_at             TIMESTAMPTZ,
  consent_ip               TEXT,
  consent_user_agent       TEXT,
  consent_scope            TEXT[] NOT NULL DEFAULT ARRAY['credit_bureau','judicial','patrimonial'],

  -- Status
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','consented','revoked','expired')),

  -- Vínculo com proposta
  deal_proposal_id         UUID,

  -- Solicitante
  requested_by             UUID REFERENCES auth.users(id),

  -- Upload Registrato (Opção A — PDF do cliente)
  registrato_pdf_path      TEXT,
  registrato_processed_at  TIMESTAMPTZ,
  registrato_extraction_id UUID
);

CREATE INDEX IF NOT EXISTS idx_cc_intake_token    ON public.credit_consents(intake_token);
CREATE INDEX IF NOT EXISTS idx_cc_cpf_cnpj        ON public.credit_consents(subject_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_cc_deal_proposal   ON public.credit_consents(deal_proposal_id);
CREATE INDEX IF NOT EXISTS idx_cc_status          ON public.credit_consents(status);

ALTER TABLE public.credit_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_consents_select" ON public.credit_consents
  FOR SELECT USING (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role,
      'MESA_OPERACIONAL'::user_role, 'FINANCEIRO'::user_role
    ])
  );

CREATE POLICY "credit_consents_insert" ON public.credit_consents
  FOR INSERT WITH CHECK (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role
    ])
  );

CREATE POLICY "credit_consents_update" ON public.credit_consents
  FOR UPDATE USING (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role
    ])
  );

CREATE POLICY "credit_consents_delete" ON public.credit_consents
  FOR DELETE USING (get_user_role() = 'ADMIN'::user_role);
