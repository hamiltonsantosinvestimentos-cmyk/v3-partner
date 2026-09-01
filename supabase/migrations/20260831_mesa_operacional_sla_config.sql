-- Config de SLA por fase da Mesa Operacional (dias por estágio do pipeline
-- de propostas de crédito) — hoje só existia em localStorage no navegador de
-- cada usuário, então cada um podia ver prazos e status de "vencido"
-- diferentes pro mesmo pipeline. Passa a ser uma linha só, compartilhada,
-- igual o padrão já usado em sdr_flow_config (singleton id='default').
--
-- Também é pré-requisito pro alerta automático de SLA (cron
-- mesa-operacional-sla-alert): o cron roda no servidor, sem acesso a
-- localStorage nenhum, então precisa de uma fonte de verdade no banco.

CREATE TABLE IF NOT EXISTS public.mesa_operacional_sla_config (
  id          text PRIMARY KEY DEFAULT 'default',
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.mesa_operacional_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mesa_operacional_sla_config_staff" ON public.mesa_operacional_sla_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'))
  );
