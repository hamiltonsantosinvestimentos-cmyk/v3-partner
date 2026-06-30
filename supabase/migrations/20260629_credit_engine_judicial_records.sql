CREATE TABLE IF NOT EXISTS public.judicial_records (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Vínculo
  credit_profile_id    UUID REFERENCES public.credit_profiles(id) ON DELETE CASCADE,
  subject_cpf_cnpj     TEXT NOT NULL,

  -- Dados do processo
  numero_processo      TEXT NOT NULL,
  tribunal             TEXT,
  vara                 TEXT,
  classe_processual    TEXT,
  assunto              TEXT,
  polo                 TEXT CHECK (polo IN ('ativo','passivo','outro')),

  -- Valor e movimentação
  valor_causa          NUMERIC(18,2),
  status_processo      TEXT,
  data_distribuicao    DATE,
  ultima_movimentacao  DATE,

  -- Fonte e dados brutos
  fonte                TEXT NOT NULL DEFAULT 'jusbrasil'
                         CHECK (fonte IN ('jusbrasil','cnj_datajud','tj_manual','outro')),
  raw_data             JSONB DEFAULT '{}',

  -- Severidade para scoring
  severity             TEXT CHECK (severity IN ('low','medium','high','critical')),

  -- Deduplicação por hash do processo + sujeito
  processo_hash        TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_jr_profile    ON public.judicial_records(credit_profile_id);
CREATE INDEX IF NOT EXISTS idx_jr_cpf_cnpj  ON public.judicial_records(subject_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_jr_severity  ON public.judicial_records(severity);
CREATE INDEX IF NOT EXISTS idx_jr_hash      ON public.judicial_records(processo_hash);

ALTER TABLE public.judicial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "judicial_records_select" ON public.judicial_records
  FOR SELECT USING (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role,
      'MESA_OPERACIONAL'::user_role, 'FINANCEIRO'::user_role
    ])
  );

CREATE POLICY "judicial_records_insert" ON public.judicial_records
  FOR INSERT WITH CHECK (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role
    ])
  );

CREATE POLICY "judicial_records_update" ON public.judicial_records
  FOR UPDATE USING (
    get_user_role() = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role])
  );

CREATE POLICY "judicial_records_delete" ON public.judicial_records
  FOR DELETE USING (get_user_role() = 'ADMIN'::user_role);
