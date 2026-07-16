-- Link publico para o Mandatario preencher a cadeia de intermediarios do seu lado
-- (feature nova, complementa o preenchimento manual da Mesa ja existente)
-- Aplicado em producao via MCP em 2026-07-16
CREATE TABLE IF NOT EXISTS public.cm_intermediary_fill_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.cm_asset_listings(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('compra','venda')),
  mandatario_partner_id UUID NOT NULL REFERENCES public.profiles(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','preenchido')),
  submitted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_intermediary_fill_tokens_token ON public.cm_intermediary_fill_tokens(token);
CREATE INDEX IF NOT EXISTS idx_cm_intermediary_fill_tokens_listing ON public.cm_intermediary_fill_tokens(listing_id);

ALTER TABLE public.cm_intermediary_fill_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cm_intermediary_fill_tokens' AND policyname='internal manage fill tokens') THEN
    CREATE POLICY "internal manage fill tokens" ON public.cm_intermediary_fill_tokens
      FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));
  END IF;
END $$;

COMMENT ON TABLE public.cm_intermediary_fill_tokens IS 'Token publico para o Mandatario preencher a cadeia de intermediarios (nome+percentual) do seu lado, sem depender da Mesa digitar manualmente. Acesso publico via service role na rota /api/cm/deal-intermediaries/fill/[token].';
