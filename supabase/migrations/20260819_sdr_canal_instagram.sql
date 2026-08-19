-- Agente SDR multi-canal: prepara sdr_leads/sdr_conversas pra atender tambem
-- pelo Instagram Direct, nao so WhatsApp.
--
-- phone continua sendo a chave (nao renomeamos -- dezenas de lugares no
-- app ja dependem dela como identificador do contato). Quando canal =
-- 'instagram', o valor guardado em phone passa a ser o IGSID
-- (Instagram-Scoped ID do remetente), nao um numero de telefone de verdade
-- -- e um identificador de contato generico por canal, so manteve o nome
-- historico da coluna.

ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'whatsapp'
    CHECK (canal IN ('whatsapp', 'instagram'));

ALTER TABLE public.sdr_conversas
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'whatsapp'
    CHECK (canal IN ('whatsapp', 'instagram'));

CREATE INDEX IF NOT EXISTS idx_sdr_leads_canal ON public.sdr_leads (canal);
CREATE INDEX IF NOT EXISTS idx_sdr_conversas_canal ON public.sdr_conversas (canal);
