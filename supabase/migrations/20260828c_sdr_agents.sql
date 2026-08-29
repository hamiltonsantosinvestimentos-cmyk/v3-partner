-- ============================================================
-- MIGRATION: Agente SDR configurável (Fase 1 — fundação)
-- Date: 2026-08-28
-- Scope: config de agente por dono (V3 interno + cada partner), camada de IA
--        multi-provedor. A chave de API vai criptografada (AES-256-GCM via
--        SDR_SECRET_KEY, ver lib/crypto/secret.ts). Substitui, aos poucos, o
--        sdr_flow_config global — na Fase 1 os dois coexistem.
--
-- Rollback:
--   DROP TABLE IF EXISTS sdr_agents CASCADE;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sdr_agents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dono: profiles.id do partner, ou o sentinela 00000000-... do bot interno V3
  -- (mesmo SDR_INTERNO_PARTNER_ID já usado em sdr_leads.partner_id).
  owner_partner_id  uuid NOT NULL,
  name              text NOT NULL DEFAULT 'Agente SDR',
  enabled           boolean NOT NULL DEFAULT true,
  -- canais onde o agente responde
  channels          text[] NOT NULL DEFAULT ARRAY['whatsapp']::text[],

  -- camada de IA
  provider          text NOT NULL DEFAULT 'anthropic'
                      CHECK (provider IN ('anthropic','openai','openrouter','google')),
  model             text NOT NULL DEFAULT 'claude-haiku-4-5',
  temperature       numeric(3,2) NOT NULL DEFAULT 0.60 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens        integer NOT NULL DEFAULT 1024 CHECK (max_tokens BETWEEN 64 AND 8192),
  -- chave de API criptografada + dica não-sensível pra UI
  api_key_encrypted text,
  api_key_hint      text,

  -- comportamento
  system_prompt        text NOT NULL DEFAULT '',
  smart_delay_min_ms   integer NOT NULL DEFAULT 1500 CHECK (smart_delay_min_ms >= 0),
  smart_delay_max_ms   integer NOT NULL DEFAULT 6000 CHECK (smart_delay_max_ms >= 0),
  fallback_to_human    boolean NOT NULL DEFAULT true,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT sdr_agents_delay_order CHECK (smart_delay_max_ms >= smart_delay_min_ms)
);

CREATE INDEX IF NOT EXISTS idx_sdr_agents_owner ON public.sdr_agents (owner_partner_id);
-- No máximo um agente ATIVO por dono (o runtime pega esse).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sdr_agents_owner_enabled
  ON public.sdr_agents (owner_partner_id) WHERE enabled = true;

ALTER TABLE public.sdr_agents ENABLE ROW LEVEL SECURITY;

-- Partner lê/gerencia os próprios; ADMIN/GESTAO enxergam todos.
DROP POLICY IF EXISTS "sdr_agents partner rw own" ON public.sdr_agents;
CREATE POLICY "sdr_agents partner rw own" ON public.sdr_agents
  FOR ALL TO authenticated
  USING (
    owner_partner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('ADMIN','GESTAO'))
  )
  WITH CHECK (
    owner_partner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('ADMIN','GESTAO'))
  );

-- Seed do agente interno da V3 a partir do sdr_flow_config atual (se existir),
-- pra não haver regressão: o runtime passa a ler o agente, com o mesmo texto.
INSERT INTO public.sdr_agents (owner_partner_id, name, provider, model, system_prompt)
SELECT
  '00000000-0000-0000-0000-000000000000',
  'Agente SDR — V3 interno',
  'anthropic',
  'claude-haiku-4-5',
  COALESCE(
    (SELECT empresa_contexto || E'\n\n' || regras_comunicacao
       FROM public.sdr_flow_config WHERE id = 'default'),
    ''
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.sdr_agents
  WHERE owner_partner_id = '00000000-0000-0000-0000-000000000000'
);

-- ── Conferência ──
-- SELECT id, owner_partner_id, name, provider, model, enabled FROM sdr_agents;
