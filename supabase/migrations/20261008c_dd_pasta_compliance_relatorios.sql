-- Due Diligence, Entrega 3 (08/10/2026): pasta Compliance/DueDiligence, relatorios e log de aberturas.
-- BRIEF: scratchpad brief-e3-dd.md (REVISAO v2), regra do nome da pasta aprovada por Joao em 08/10/2026
-- (06_Operacional/SOPs/2026-10-08_Operacional_Regra-Nome-Pasta-Due-Diligence-e-Compliance_v1.md).
--
-- 1) folder_registry aceita a vertical 'Compliance' (as 6 atuais continuam).
-- 2) validate_folder_path ganha UMA alternativa OR: ^Compliance/DueDiligence(/V3C-NDA-AAAA-NNNN(/P-xxxxxxxx_(PJ|PF))?)?$
--    Nenhuma das alternativas existentes muda. Nenhum CPF, CNPJ ou nome entra no padrao.
-- 3) Bucket privado dd-compliance (sem policy: so service role).
-- 4) cm_party_dd_reports: um registro por relatorio gerado (arquivo no Storage), com expires_at = 12 meses.
-- 5) cm_party_dd_report_views: log de TODA abertura. report_id e uuid SEM chave estrangeira e SEM cascade, e a linha
--    grava contract_code e party_short, para o rastro sobreviver ao descarte do relatorio (retencao do log: 36 meses).
-- RLS ligado e sem policy em ambas as tabelas.

ALTER TABLE public.folder_registry DROP CONSTRAINT IF EXISTS folder_registry_vertical_check;
ALTER TABLE public.folder_registry
  ADD CONSTRAINT folder_registry_vertical_check
  CHECK (vertical = ANY (ARRAY['MA'::text, 'Credito'::text, 'Consorcios'::text, 'BolsaDeAtivos'::text, 'Administracao'::text, 'Contratos'::text, 'Compliance'::text]));

CREATE OR REPLACE FUNCTION public.validate_folder_path(p_path text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $function$
begin
  return p_path ~ '^MA/V3-(?:[A-Z]{2,4}-)?\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+'
    or p_path ~ '^Credito/(CRED-\d{2}-\d+|V3-CRI?-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3})_.+'
    or p_path ~ '^Consorcios/(CON-\d{4}-\d{3}|V3-CS-\d{4}-(0[1-9]|1[0-2])-\d{4})_.+'
    or p_path ~ '^BolsaDeAtivos/V3-(BA|PR)-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+'
    or p_path ~ '^Administracao/(Documento_Cadastro|Financeiro|Juridico)'
    or p_path ~ '^Contratos/(Contratos_de_Partners|Contratos_com_Fundos|Contratos_de_Fornecedores|Contratos_de_Contabilidade|Contratos_de_Securitizadora)'
    or p_path ~ '^Compliance/DueDiligence(/V3C-NDA-\d{4}-\d{4}(/P-[0-9a-f]{8}_(PJ|PF))?)?$';
end;
$function$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('dd-compliance', 'dd-compliance', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cm_party_dd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.cm_party_qualifications(id),
  contract_code text NOT NULL,
  folder_path text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months')
);
CREATE INDEX IF NOT EXISTS cm_party_dd_reports_party_idx ON public.cm_party_dd_reports (party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cm_party_dd_reports_expires_idx ON public.cm_party_dd_reports (expires_at);
ALTER TABLE public.cm_party_dd_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cm_party_dd_report_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  contract_code text NOT NULL,
  party_short text NOT NULL,
  viewed_by uuid NOT NULL REFERENCES public.profiles(id),
  ip text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_party_dd_report_views_user_idx ON public.cm_party_dd_report_views (viewed_by, viewed_at DESC);
CREATE INDEX IF NOT EXISTS cm_party_dd_report_views_at_idx ON public.cm_party_dd_report_views (viewed_at DESC);
ALTER TABLE public.cm_party_dd_report_views ENABLE ROW LEVEL SECURITY;

-- ROLLBACK (manual, so se necessario): remover as duas tabelas, o bucket dd-compliance (vazio) e a linha 'Compliance'
-- da CHECK; restaurar validate_folder_path sem a ultima alternativa (20260807d e anteriores).
