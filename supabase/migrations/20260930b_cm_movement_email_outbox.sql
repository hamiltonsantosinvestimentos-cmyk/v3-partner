-- ============================================================
-- MIGRATION: fila (outbox) de e-mails de movimentacao do ativo da Bolsa de Ativos
-- Date: 2026-09-30
-- Entrega 2 do BRIEF "Cauda Athaydes e e-mail de movimentacao do ativo".
--
-- Cada mudanca de etapa do ativo (linha nova em cm_status_transitions), da entrada ate a
-- decisao (aprovado, aprovado com restricoes ou reprovado), enfileira um e-mail por
-- destinatario: partner dono do ativo, Mesa (ADMIN, GESTAO, MESA_OPERACIONAL) e cedente
-- (contato_email do formulario de intake). O envio e feito pelo n8n (montagem do e-mail,
-- auditoria de marca e Resend), nunca direto da API.
--
-- Seguranca do CI: o CI e2e roda contra o banco de PRODUCAO a cada push. A chave
-- cm_feature_flags.movement_emails NASCE DESLIGADA (nada e enfileirado) e, mesmo ligada,
-- ativos de teste (ZZTEST, QA PLAYWRIGHT) entram como "ignorado", sem e-mail.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_cm_enqueue_movement_emails ON cm_status_transitions;
--   DROP FUNCTION IF EXISTS public.cm_enqueue_movement_emails();
--   DROP FUNCTION IF EXISTS public.claim_cm_movement_emails(int, uuid);
--   DROP FUNCTION IF EXISTS public.finish_cm_movement_email(uuid, boolean, text, text);
--   DROP TABLE IF EXISTS cm_movement_email_outbox;
--   DELETE FROM cm_feature_flags WHERE key = 'movement_emails';
-- ============================================================

CREATE TABLE IF NOT EXISTS cm_movement_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_id uuid NOT NULL REFERENCES cm_status_transitions(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_role text NOT NULL CHECK (recipient_role IN ('partner', 'mesa', 'cedente')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviando', 'enviado', 'falhou', 'ignorado')),
  attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  provider_id text,
  error text,
  ignore_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_movement_email_outbox IS 'Fila de e-mails de movimentacao do ativo (Bolsa de Ativos). Um e-mail por movimento e por destinatario. Processada por lib/movement-email.ts, que aciona o webhook do n8n (Brand Gate + Resend).';

-- Um e-mail por movimento e por pessoa, mesmo com nova tentativa (e-mail normalizado).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cm_movement_email_once
  ON cm_movement_email_outbox (transition_id, lower(recipient_email));
CREATE INDEX IF NOT EXISTS idx_cm_movement_email_pending
  ON cm_movement_email_outbox (created_at) WHERE status IN ('pendente', 'enviando');
CREATE INDEX IF NOT EXISTS idx_cm_movement_email_listing
  ON cm_movement_email_outbox (listing_id, created_at DESC);

ALTER TABLE cm_movement_email_outbox ENABLE ROW LEVEL SECURITY;

-- Leitura para a Mesa. Nenhuma escrita direta pelo cliente: o servidor usa service role.
CREATE POLICY cm_movement_email_select ON cm_movement_email_outbox FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- Chave de desligamento (nasce desligada).
INSERT INTO cm_feature_flags (key, enabled, description)
VALUES ('movement_emails', false, 'E-mails de movimentacao do ativo (Bolsa de Ativos) ao partner, Mesa e cedente, da entrada ate a decisao. Desligada por padrao: o CI e2e roda contra producao.')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- Gatilho: enfileira os e-mails quando uma transicao de etapa e registrada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cm_enqueue_movement_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_l cm_asset_listings%rowtype;
  v_fixture boolean;
  v_partner_id uuid;
  v_status text;
  v_reason text;
BEGIN
  -- Transicao de demanda de compra nao entra nesta entrega.
  IF NEW.listing_id IS NULL OR NEW.demand_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- So da entrada ate a decisao. Vitrine, proposta, escrow, liquidado, cancelado e expirado ficam fora.
  IF NEW.to_status::text NOT IN (
    'reuniao_validada', 'formulario_preenchido', 'reuniao_agendada', 'em_qualificacao',
    'nda_assinado', 'em_analise', 'aprovado_head', 'aprovado_com_restricoes', 'reprovado'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT enabled INTO v_enabled FROM cm_feature_flags WHERE key = 'movement_emails';
  IF NOT coalesce(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_l FROM cm_asset_listings WHERE id = NEW.listing_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_fixture := (coalesce(v_l.seller_name, '') || ' ' || coalesce(v_l.apelido, '') || ' ' || coalesce(v_l.anonymous_id, ''))
               ~* '(zztest|qa playwright)';
  v_status := CASE WHEN v_fixture THEN 'ignorado' ELSE 'pendente' END;
  v_reason := CASE WHEN v_fixture THEN 'ativo de teste' ELSE NULL END;

  -- Partner dono do ativo: originador; sem originador, quem criou, se for partner.
  v_partner_id := coalesce(v_l.originator_profile_id, v_l.created_by);
  INSERT INTO cm_movement_email_outbox (transition_id, listing_id, recipient_email, recipient_name, recipient_role, status, ignore_reason)
  SELECT NEW.id, NEW.listing_id, lower(trim(p.email)), p.full_name, 'partner', v_status, v_reason
    FROM profiles p
   WHERE p.id = v_partner_id
     AND coalesce(p.is_active, true)
     AND coalesce(trim(p.email), '') <> ''
     AND (p.role::text LIKE 'PARTNER%' OR p.role::text IN ('STARTER', 'ENTERPRISE'))
  ON CONFLICT (transition_id, lower(recipient_email)) DO NOTHING;

  -- Mesa.
  INSERT INTO cm_movement_email_outbox (transition_id, listing_id, recipient_email, recipient_name, recipient_role, status, ignore_reason)
  SELECT NEW.id, NEW.listing_id, lower(trim(p.email)), p.full_name, 'mesa', v_status, v_reason
    FROM profiles p
   WHERE p.role::text IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
     AND coalesce(p.is_active, true)
     AND coalesce(trim(p.email), '') <> ''
  ON CONFLICT (transition_id, lower(recipient_email)) DO NOTHING;

  -- Cedente: contato informado por ele no formulario de intake.
  IF coalesce(v_l.intake_data ->> 'contato_email', '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    INSERT INTO cm_movement_email_outbox (transition_id, listing_id, recipient_email, recipient_name, recipient_role, status, ignore_reason)
    VALUES (NEW.id, NEW.listing_id, lower(trim(v_l.intake_data ->> 'contato_email')), v_l.intake_data ->> 'contato_nome', 'cedente', v_status, v_reason)
    ON CONFLICT (transition_id, lower(recipient_email)) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cm_enqueue_movement_emails ON cm_status_transitions;
CREATE TRIGGER trg_cm_enqueue_movement_emails
  AFTER INSERT ON cm_status_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.cm_enqueue_movement_emails();

-- ------------------------------------------------------------
-- Reserva de linhas para envio (sem duplicar entre execucoes simultaneas).
-- Devolve tudo que o servidor precisa para montar o payload do n8n.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_cm_movement_emails(p_limit int DEFAULT 20, p_listing uuid DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Chave desligada: nada e enviado, mesmo que existam linhas pendentes.
  IF NOT coalesce((SELECT enabled FROM cm_feature_flags WHERE key = 'movement_emails'), false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH c AS (
    SELECT o.id
      FROM cm_movement_email_outbox o
     WHERE (o.status = 'pendente' OR (o.status = 'enviando' AND o.updated_at < now() - interval '10 minutes'))
       AND o.attempts < 5
       AND (p_listing IS NULL OR o.listing_id = p_listing)
     ORDER BY o.created_at
     LIMIT p_limit
       FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE cm_movement_email_outbox o
       SET status = 'enviando', attempts = o.attempts + 1, updated_at = now()
      FROM c
     WHERE o.id = c.id
    RETURNING o.*
  )
  SELECT jsonb_build_object(
    'id', u.id,
    'attempts', u.attempts,
    'recipient_email', u.recipient_email,
    'recipient_name', u.recipient_name,
    'recipient_role', u.recipient_role,
    'listing_id', u.listing_id,
    'anonymous_id', l.anonymous_id,
    'to_status', t.to_status::text,
    'reason', t.reason,
    'reason_category', t.reason_category,
    'occurred_at', t.created_at
  )
  FROM u
  JOIN cm_asset_listings l ON l.id = u.listing_id
  JOIN cm_status_transitions t ON t.id = u.transition_id;
END;
$$;

-- Resultado do envio: sucesso marca enviado; falha volta para pendente ate 5 tentativas, depois falhou.
CREATE OR REPLACE FUNCTION public.finish_cm_movement_email(p_id uuid, p_ok boolean, p_provider text DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ok THEN
    UPDATE cm_movement_email_outbox
       SET status = 'enviado', sent_at = now(), provider_id = p_provider, error = NULL, updated_at = now()
     WHERE id = p_id;
  ELSE
    UPDATE cm_movement_email_outbox
       SET status = CASE WHEN attempts >= 5 THEN 'falhou' ELSE 'pendente' END,
           error = left(coalesce(p_error, 'erro desconhecido'), 500),
           updated_at = now()
     WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cm_movement_emails(int, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_cm_movement_email(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cm_movement_emails(int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_cm_movement_email(uuid, boolean, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.cm_enqueue_movement_emails() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cm_movement_email_outbox_updated_at ON cm_movement_email_outbox;
CREATE TRIGGER trg_cm_movement_email_outbox_updated_at BEFORE UPDATE ON cm_movement_email_outbox FOR EACH ROW EXECUTE FUNCTION set_updated_at();
