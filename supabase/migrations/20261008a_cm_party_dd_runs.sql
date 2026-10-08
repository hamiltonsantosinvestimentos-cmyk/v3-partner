-- Aba Due Diligence na Ficha de Qualificacao, Entrega 1 (08/10/2026).
-- BRIEF: 06_Operacional/SOPs/2026-10-08_Operacional_BRIEF-Aba-Due-Diligence-Ficha-Qualificacao_v1.md
--
-- cm_party_dd_runs: uma linha por consulta feita pela aba. Guarda o documento consultado em
-- coluna text canonica (CPF 11, CNPJ 14, letras em maiusculas, sem pontuacao), o resumo exibivel
-- (result_summary, nunca nome ou CPF de socio) e o numero do contrato/NCNDA de origem.
-- raw_data fica NULL nesta entrega (resultado bruto de PF so depois do parecer de compliance);
-- descarte do bruto aos 12 meses sera feito por job agendado na Entrega 3.
--
-- Acesso: somente service role (RLS ligado, sem policy). O gate da aba e por usuario em
-- user_feature_access (feature due_diligence_qualificacao), concedida abaixo aos mesmos usuarios
-- do cockpit de compliance (3 socios ADMIN + analista de mesa).

CREATE TABLE IF NOT EXISTS public.cm_party_dd_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.cm_party_qualifications(id),
  contract_code text,
  tool text NOT NULL CHECK (tool IN ('receita', 'blacklist', 'escavador', 'datajud', 'scr_cnpj')),
  document_value text NOT NULL,
  document_kind text NOT NULL CHECK (document_kind IN ('cpf', 'cnpj')),
  status text NOT NULL CHECK (status IN ('ok', 'sem_dados', 'nao_consultado')),
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_data jsonb,
  reuse_reason text,
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cm_party_dd_runs_party_idx ON public.cm_party_dd_runs (party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cm_party_dd_runs_doc_idx ON public.cm_party_dd_runs (document_value, tool, created_at DESC);

ALTER TABLE public.cm_party_dd_runs ENABLE ROW LEVEL SECURITY;

-- Seed do gate: mesmos usuarios do cockpit de compliance da Bolsa (decisao de Joao, 08/10/2026).
INSERT INTO public.user_feature_access (user_id, feature, access_level)
SELECT u.user_id, 'due_diligence_qualificacao', u.access_level
FROM public.user_feature_access u
WHERE u.feature = 'bolsa_compliance_dashboard'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_feature_access x
    WHERE x.user_id = u.user_id AND x.feature = 'due_diligence_qualificacao'
  );

-- ROLLBACK (manual, so se necessario): remover as linhas de user_feature_access com
-- feature = 'due_diligence_qualificacao' e depois a tabela cm_party_dd_runs (sem dados de
-- terceiros alem do resumo das consultas).
