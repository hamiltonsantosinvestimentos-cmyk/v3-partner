-- Rastreio de progresso passo a passo do quiz público /seja-partner.
-- Append-only: 1 linha por (sessão, passo) na primeira vez que o passo é
-- alcançado. Permite montar o funil (quantas sessões chegaram em cada etapa)
-- e ver onde as pessoas abandonam. Sem PII — só um id de sessão aleatório.

CREATE TABLE IF NOT EXISTS public.quiz_progress (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL,
  quiz        text NOT NULL DEFAULT 'seja_partner',
  step        text NOT NULL,
  step_index  int  NOT NULL,
  ref         text,
  utm         jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_progress_session ON public.quiz_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_progress_created ON public.quiz_progress(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_progress_session_step ON public.quiz_progress(quiz, session_id, step);

ALTER TABLE public.quiz_progress ENABLE ROW LEVEL SECURITY;

-- Escrita só via service_role (a rota pública /api/public/quiz-progress usa
-- service key). Leitura só ADMIN/GESTAO/SDR/CLOSER pro dashboard.
DROP POLICY IF EXISTS quiz_progress_read ON public.quiz_progress;
CREATE POLICY quiz_progress_read ON public.quiz_progress
  FOR SELECT USING (public.get_user_role() IN ('ADMIN', 'GESTAO', 'SDR', 'CLOSER'));
