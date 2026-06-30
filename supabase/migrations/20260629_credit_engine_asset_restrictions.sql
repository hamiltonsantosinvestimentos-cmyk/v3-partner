CREATE TABLE IF NOT EXISTS public.asset_restrictions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Vínculo
  credit_profile_id   UUID REFERENCES public.credit_profiles(id) ON DELETE CASCADE,
  subject_cpf_cnpj    TEXT NOT NULL,

  -- Tipo de restrição
  restriction_type    TEXT NOT NULL CHECK (restriction_type IN (
    'penhora','hipoteca','alienacao_fiduciaria','pnh',
    'protesto','cheque_sem_fundo','divida_ativa','debito_detran','outro'
  )),

  -- Dados da restrição
  descricao           TEXT,
  valor               NUMERIC(18,2),
  data_ocorrencia     DATE,
  data_vencimento     DATE,
  credor              TEXT,
  numero_referencia   TEXT,

  -- Status
  status              TEXT NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo','baixado','cancelado','desconhecido')),

  -- Fonte e dados brutos
  fonte               TEXT NOT NULL CHECK (fonte IN (
    'serasa','spc','detran','trf','pgfn','ceis','outro'
  )),
  raw_data            JSONB DEFAULT '{}',

  -- Impacto no score
  score_impact        INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ar_profile   ON public.asset_restrictions(credit_profile_id);
CREATE INDEX IF NOT EXISTS idx_ar_cpf_cnpj ON public.asset_restrictions(subject_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_ar_type     ON public.asset_restrictions(restriction_type);
CREATE INDEX IF NOT EXISTS idx_ar_status   ON public.asset_restrictions(status);

ALTER TABLE public.asset_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_restrictions_select" ON public.asset_restrictions
  FOR SELECT USING (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role,
      'MESA_OPERACIONAL'::user_role, 'FINANCEIRO'::user_role
    ])
  );

CREATE POLICY "asset_restrictions_insert" ON public.asset_restrictions
  FOR INSERT WITH CHECK (
    get_user_role() = ANY (ARRAY[
      'ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role
    ])
  );

CREATE POLICY "asset_restrictions_update" ON public.asset_restrictions
  FOR UPDATE USING (
    get_user_role() = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role])
  );

CREATE POLICY "asset_restrictions_delete" ON public.asset_restrictions
  FOR DELETE USING (get_user_role() = 'ADMIN'::user_role);
