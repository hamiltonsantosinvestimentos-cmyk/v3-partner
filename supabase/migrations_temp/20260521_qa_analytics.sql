-- Migration: 20260521_qa_analytics
-- Feature: Q&A Dinâmico + Analytics (financial_projections)
-- Sprint: 1/4 — Camada de dados

-- ─── 1. deal_qa_threads ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_qa_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
  deal_room_id    UUID,                                    -- nullable: Q&A pode existir sem Deal Room formal
  subject         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'geral'
                    CHECK (category IN ('financeiro','juridico','operacional','estrutura','due_diligence','geral')),
  priority        TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','answered','pending_seller','pending_buyer','closed','escalated')),
  initiated_by    TEXT NOT NULL DEFAULT 'buyer'
                    CHECK (initiated_by IN ('buyer','seller','mesa')),
  initiator_ref   UUID,
  ai_summary      TEXT,
  data_extracted  JSONB DEFAULT '{}',
  thesis_impact   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_deal_qa_threads_updated_at ON deal_qa_threads;
CREATE TRIGGER trg_deal_qa_threads_updated_at
  BEFORE UPDATE ON deal_qa_threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE deal_qa_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_threads_mesa_all" ON deal_qa_threads;
CREATE POLICY "qa_threads_mesa_all" ON deal_qa_threads
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role,'MESA_OPERACIONAL'::user_role])
  ));

CREATE INDEX IF NOT EXISTS idx_qa_threads_deal ON deal_qa_threads(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_qa_threads_room ON deal_qa_threads(deal_room_id) WHERE deal_room_id IS NOT NULL;

-- ─── 2. deal_qa_messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_qa_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         UUID NOT NULL REFERENCES deal_qa_threads(id) ON DELETE CASCADE,
  sender_type       TEXT NOT NULL
                      CHECK (sender_type IN ('buyer','seller','mesa','ai_draft','ai_summary')),
  sender_invite_id  UUID,                                  -- buyer externo (deal_room_invites futuro)
  sender_profile_id UUID REFERENCES profiles(id),          -- mesa/seller interno
  content           TEXT NOT NULL,
  attachments       JSONB DEFAULT '[]',
  is_ai_draft       BOOLEAN NOT NULL DEFAULT FALSE,
  is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence     DECIMAL(3,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deal_qa_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_messages_mesa_all" ON deal_qa_messages;
CREATE POLICY "qa_messages_mesa_all" ON deal_qa_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role,'MESA_OPERACIONAL'::user_role])
  ));

CREATE INDEX IF NOT EXISTS idx_qa_messages_thread ON deal_qa_messages(thread_id, created_at DESC);

-- ─── 3. deal_qa_doc_updates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_qa_doc_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES deal_qa_threads(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL
                    CHECK (document_type IN ('cim','teaser','nda','minuta','proposta','forja_report')),
  section_updated TEXT,
  trigger_reason  TEXT,
  prev_path       TEXT,
  new_path        TEXT,
  updated_by      TEXT NOT NULL DEFAULT 'mesa_manual'
                    CHECK (updated_by IN ('ai_auto','mesa_manual')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deal_qa_doc_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_doc_updates_mesa_all" ON deal_qa_doc_updates;
CREATE POLICY "qa_doc_updates_mesa_all" ON deal_qa_doc_updates
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role,'MESA_OPERACIONAL'::user_role])
  ));

CREATE INDEX IF NOT EXISTS idx_qa_doc_updates_thread ON deal_qa_doc_updates(thread_id);

-- ─── 4. privacy_consents (LGPD) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS privacy_consents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_type    TEXT NOT NULL
                        CHECK (stakeholder_type IN ('investor','partner','seller','mandatario')),
  stakeholder_ref     UUID,
  stakeholder_email   TEXT,
  consent_version     TEXT NOT NULL DEFAULT '1.0',
  ip_address          TEXT,
  user_agent          TEXT,
  text_snapshot       TEXT,
  accepted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE privacy_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "privacy_consents_mesa_all" ON privacy_consents;
CREATE POLICY "privacy_consents_mesa_all" ON privacy_consents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role,'GESTAO'::user_role,'MESA_OPERACIONAL'::user_role])
  ));

CREATE INDEX IF NOT EXISTS idx_privacy_consents_ref ON privacy_consents(stakeholder_ref) WHERE stakeholder_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_privacy_consents_email ON privacy_consents(stakeholder_email) WHERE stakeholder_email IS NOT NULL;
