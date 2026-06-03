-- Follow-ups do CRM de Prospecção
CREATE TABLE IF NOT EXISTS prospeccao_followups (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     uuid NOT NULL REFERENCES prospeccao_leads(id) ON DELETE CASCADE,
  tipo        text NOT NULL, -- ligacao | email | whatsapp
  notas       text,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospeccao_followups_lead ON prospeccao_followups(lead_id);

ALTER TABLE prospeccao_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospeccao_followups_access" ON prospeccao_followups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'SDR', 'CLOSER', 'GESTAO')
    )
  );
