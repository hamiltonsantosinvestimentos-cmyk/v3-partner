CREATE TABLE IF NOT EXISTS public.credit_profiles (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Sujeito analisado
  subject_type         TEXT NOT NULL CHECK (subject_type IN ('PF', 'PJ')),
  subject_cpf_cnpj     TEXT NOT NULL,
  subject_name         TEXT NOT NULL,

  -- Scores por dimensão (0–100)
  score_identidade     INTEGER CHECK (score_identidade BETWEEN 0 AND 100),
  score_credito        INTEGER CHECK (score_credito BETWEEN 0 AND 100),
  score_judicial       INTEGER CHECK (score_judicial BETWEEN 0 AND 100),
  score_patrimonial    INTEGER CHECK (score_patrimonial BETWEEN 0 AND 100),
  score_comportamental INTEGER CHECK (score_comportamental BETWEEN 0 AND 100),
  score_setorial       INTEGER CHECK (score_setorial BETWEEN 0 AND 100),

  -- Score composto e tier
  score_total          INTEGER CHECK (score_total BETWEEN 0 AND 1000),
  tier                 TEXT CHECK (tier IN ('A', 'B', 'C', 'D', 'E')),

  -- Spread recomendado CDI+
  spread_min           NUMERIC(5,2),
  spread_max           NUMERIC(5,2),

  -- Tipo e status da análise
  analysis_type        TEXT NOT NULL DEFAULT 'complete'
                         CHECK (analysis_type IN ('complete', 'premium')),
  analysis_status      TEXT NOT NULL DEFAULT 'pending'
                         CHECK (analysis_status IN ('pending','processing','complete','failed','expired')),

  -- Resultado e fontes
  raw_result           JSONB DEFAULT '{}',
  sources_free         TEXT[] DEFAULT '{}',
  sources_paid         TEXT[] DEFAULT '{}',

  -- Flags e notas
  flags                JSONB DEFAULT '{}',
  analyst_notes        TEXT,

  -- Validade
  expires_at           TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),

  -- Rastreabilidade
  requested_by         UUID REFERENCES auth.users(id),
  deal_proposal_id     UUID  -- FK para credit_desk_proposals adicionada via ALTER TABLE
);

CREATE INDEX IF NOT EXISTS idx_cp_cpf_cnpj      ON public.credit_profiles(subject_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_cp_deal_proposal  ON public.credit_profiles(deal_proposal_id);
CREATE INDEX IF NOT EXISTS idx_cp_status         ON public.credit_profiles(analysis_status);
CREATE INDEX IF NOT EXISTS idx_cp_expires        ON public.credit_profiles(expires_at);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_credit_profiles_updated_at ON public.credit_profiles;
CREATE TRIGGER trg_credit_profiles_updated_at
  BEFORE UPDATE ON public.credit_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_profiles_select" ON public.credit_profiles
  FOR SELECT USING (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role,
      'MESA_OPERACIONAL'::user_role, 'FINANCEIRO'::user_role
    ])
  );

CREATE POLICY "credit_profiles_insert" ON public.credit_profiles
  FOR INSERT WITH CHECK (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role
    ])
  );

CREATE POLICY "credit_profiles_update" ON public.credit_profiles
  FOR UPDATE USING (
    get_user_role() = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role])
  );

CREATE POLICY "credit_profiles_delete" ON public.credit_profiles
  FOR DELETE USING (get_user_role() = 'ADMIN'::user_role);
