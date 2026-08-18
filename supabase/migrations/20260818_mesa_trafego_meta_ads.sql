-- Mesa de Trafego: campanhas do Meta Ads (Facebook/Instagram) geridas pela
-- plataforma. A Graph API da Meta e a fonte de verdade pro estado real da
-- campanha (nome, status, orcamento) -- essa tabela e um cache local +
-- trilha de auditoria de quem criou o que, com snapshot de metricas pra
-- nao precisar bater na API toda vez que a tela carrega.

CREATE TABLE IF NOT EXISTS public.trafego_campanhas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id  text NOT NULL UNIQUE,
  meta_ad_account_id text NOT NULL,
  nome              text NOT NULL,
  objetivo          text NOT NULL,
  status            text NOT NULL DEFAULT 'PAUSED',
  orcamento_diario_centavos   bigint,
  orcamento_vitalicio_centavos bigint,
  vertical          text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  insights_cache    jsonb,
  insights_synced_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trafego_ad_sets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id     uuid NOT NULL REFERENCES public.trafego_campanhas(id) ON DELETE CASCADE,
  meta_adset_id   text NOT NULL UNIQUE,
  nome            text NOT NULL,
  status          text NOT NULL DEFAULT 'PAUSED',
  orcamento_diario_centavos bigint,
  segmentacao     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trafego_ads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id     uuid NOT NULL REFERENCES public.trafego_ad_sets(id) ON DELETE CASCADE,
  meta_ad_id    text NOT NULL UNIQUE,
  nome          text NOT NULL,
  status        text NOT NULL DEFAULT 'PAUSED',
  criativo      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trafego_ad_sets_campanha ON public.trafego_ad_sets (campanha_id);
CREATE INDEX IF NOT EXISTS idx_trafego_ads_ad_set ON public.trafego_ads (ad_set_id);

ALTER TABLE public.trafego_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trafego_ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trafego_ads ENABLE ROW LEVEL SECURITY;

-- Gestao de trafego e sensivel (orcamento real, gasto real) -- so ADMIN/GESTAO,
-- mesmo padrao de acesso do restante das mesas administrativas.
CREATE POLICY "admin gestao full access trafego campanhas" ON public.trafego_campanhas
  USING (get_user_role() IN ('ADMIN', 'GESTAO'))
  WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE POLICY "admin gestao full access trafego ad sets" ON public.trafego_ad_sets
  USING (get_user_role() IN ('ADMIN', 'GESTAO'))
  WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE POLICY "admin gestao full access trafego ads" ON public.trafego_ads
  USING (get_user_role() IN ('ADMIN', 'GESTAO'))
  WITH CHECK (get_user_role() IN ('ADMIN', 'GESTAO'));
