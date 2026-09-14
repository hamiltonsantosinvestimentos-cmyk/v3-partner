-- Rastreio de abertura do link de Análise de Crédito/M&A (/analise-v2?prop=<code>)
-- Gatilho: João não tinha como saber se um link de proposta/deal enviado a um
-- partner (ou por ele ao cliente) sequer foi aberto, nem tentativa de
-- pagamento (que já nascia como PENDING em partner_service_orders, mas só
-- visível entrando no modal certo, nunca notificado a ninguém). Ver
-- session-decisions.md 2026-09-14.
--
-- Só grava evento pra link com ?prop= (ligado a uma proposta de Crédito ou a
-- um Deal de M&A específico) -- nunca para ?ref= solto (tráfego de marketing
-- genérico), decisão de escopo para não gerar ruído de notificação. Sem
-- dado pessoal do cliente final: nesse momento (abertura da página) o
-- cliente ainda não preencheu nome/CPF/e-mail no checkout.

CREATE TABLE IF NOT EXISTS analise_link_opens (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_code               text NOT NULL,
  deal_type               text NOT NULL DEFAULT 'credit' CHECK (deal_type IN ('credit', 'ma')),
  credit_desk_proposal_id uuid REFERENCES credit_desk_proposals(id) ON DELETE SET NULL,
  ma_deal_id              uuid REFERENCES ma_deals(id) ON DELETE SET NULL,
  partner_id              uuid REFERENCES profiles(id) ON DELETE SET NULL,
  utm_source              text,
  utm_campaign            text,
  utm_medium              text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alo_prop_code ON analise_link_opens(prop_code);
CREATE INDEX IF NOT EXISTS idx_alo_partner_id ON analise_link_opens(partner_id);

ALTER TABLE analise_link_opens ENABLE ROW LEVEL SECURITY;

-- Leitura: partner dono do link ou Mesa/Gestão. Inserção: só via service role
-- (rota pública POST /api/analise/track-open), mesmo padrão de
-- partner_service_orders (pso_insert WITH CHECK (true)).
CREATE POLICY alo_select ON analise_link_opens FOR SELECT
  USING (partner_id = auth.uid() OR get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY alo_insert ON analise_link_opens FOR INSERT
  WITH CHECK (true);
