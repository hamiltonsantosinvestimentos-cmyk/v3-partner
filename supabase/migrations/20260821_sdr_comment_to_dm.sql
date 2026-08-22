-- Comment-to-DM do Instagram (equivalente ao recurso mais usado do ManyChat):
-- comentario com palavra-chave num post -> DM automatica ("Private Reply") +
-- resposta publica opcional no proprio comentario.

CREATE TABLE IF NOT EXISTS sdr_comment_triggers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  media_id          text,                 -- null = vale pra qualquer post
  media_url         text,                 -- so pra exibir na UI, referencia visual
  palavras_chave    text[] NOT NULL DEFAULT '{}',
  mensagem_dm       text NOT NULL,
  resposta_publica  text,                 -- opcional: comentario publico de resposta
  ativo             boolean NOT NULL DEFAULT true,
  total_disparos    integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_comment_triggers_ativo ON sdr_comment_triggers (ativo);

ALTER TABLE sdr_comment_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdr_comment_triggers_admin_gestao" ON sdr_comment_triggers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );

CREATE OR REPLACE FUNCTION update_sdr_comment_triggers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_sdr_comment_triggers_updated_at
  BEFORE UPDATE ON sdr_comment_triggers
  FOR EACH ROW EXECUTE FUNCTION update_sdr_comment_triggers_updated_at();

-- Log de comentarios processados -- idempotencia (a Meta reentrega webhooks)
-- e auditoria de qual trigger disparou pra cada comentario.
CREATE TABLE IF NOT EXISTS sdr_comment_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id        uuid REFERENCES sdr_comment_triggers(id) ON DELETE SET NULL,
  comment_id        text NOT NULL UNIQUE,
  media_id          text,
  from_igsid        text,
  from_username     text,
  comment_text      text,
  dm_enviada        boolean DEFAULT false,
  erro              text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE sdr_comment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdr_comment_events_admin_gestao" ON sdr_comment_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );
