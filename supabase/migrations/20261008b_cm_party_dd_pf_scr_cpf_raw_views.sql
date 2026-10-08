-- Due Diligence, Entrega 2a (08/10/2026): consultas de pessoa fisica decisora.
-- BRIEF: scratchpad brief-e2-dd.md (REVISAO v2), plano 2026-10-08_Operacional_BRIEF-Plano-Execucao-Pendencias-Bolsa-Prazo-09-10_v1.md
--
-- 1) cm_party_dd_runs aceita tool = 'scr_cpf' (SCR detalhado do CPF da parte PF). Aditivo: so amplia o CHECK.
-- 2) cm_party_dd_raw_views: log de TODA leitura do resultado bruto (raw_data) de uma consulta. A rota grava
--    com await ANTES de devolver o dado; se a gravacao falhar o dado nao sai. O limite de taxa (30 por 10
--    minutos por usuario) e contado nesta tabela. RLS ligado, sem policy: so service role.
-- O resultado bruto de PF fica 12 meses; o job de descarte entra na Entrega 3 (primeiro vencimento possivel: 08/10/2027).

ALTER TABLE public.cm_party_dd_runs DROP CONSTRAINT IF EXISTS cm_party_dd_runs_tool_check;
ALTER TABLE public.cm_party_dd_runs
  ADD CONSTRAINT cm_party_dd_runs_tool_check
  CHECK (tool IN ('receita', 'blacklist', 'escavador', 'datajud', 'scr_cnpj', 'scr_cpf'));

CREATE TABLE IF NOT EXISTS public.cm_party_dd_raw_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.cm_party_dd_runs(id) ON DELETE CASCADE,
  viewed_by uuid NOT NULL REFERENCES public.profiles(id),
  ip text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cm_party_dd_raw_views_user_idx ON public.cm_party_dd_raw_views (viewed_by, viewed_at DESC);
CREATE INDEX IF NOT EXISTS cm_party_dd_raw_views_run_idx ON public.cm_party_dd_raw_views (run_id, viewed_at DESC);

ALTER TABLE public.cm_party_dd_raw_views ENABLE ROW LEVEL SECURITY;

-- ROLLBACK (manual, so se necessario): restaurar o CHECK de tool sem 'scr_cpf' (antes, apagar as linhas
-- com tool = 'scr_cpf') e remover a tabela cm_party_dd_raw_views.
