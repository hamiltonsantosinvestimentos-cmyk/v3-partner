-- Interruptor global do Agente SDR, SEPARADO POR CANAL: liga/desliga a
-- resposta automatica da IA para TODAS as conversas de um canal (WhatsApp
-- ou Instagram), independente do lead. Diferente do "humano_ativo" por lead
-- (que so pausa uma conversa especifica), esse e um kill switch por canal --
-- usado por ADMIN/GESTAO quando querem que so humanos respondam por um tempo
-- num canal especifico sem mexer no outro.

ALTER TABLE public.sdr_flow_config
  ADD COLUMN IF NOT EXISTS ia_ativa_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ia_ativa_instagram boolean NOT NULL DEFAULT true;

-- Migra quem já rodou a versão anterior deste arquivo (coluna única ia_ativa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sdr_flow_config' AND column_name = 'ia_ativa'
  ) THEN
    UPDATE public.sdr_flow_config SET ia_ativa_whatsapp = ia_ativa, ia_ativa_instagram = ia_ativa;
    ALTER TABLE public.sdr_flow_config DROP COLUMN ia_ativa;
  END IF;
END $$;
