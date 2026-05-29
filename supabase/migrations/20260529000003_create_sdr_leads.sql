-- sdr_leads: metadados por contato WhatsApp (tags, responsável, status)
CREATE TABLE IF NOT EXISTS sdr_leads (
  phone              text PRIMARY KEY,
  nome               text,
  tags               text[] DEFAULT '{}',
  responsavel_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status             text DEFAULT 'ativo'
                       CHECK (status IN ('ativo','qualificado','agendado','convertido','sem_interesse','arquivado')),
  last_message_at    timestamptz,
  last_message_preview text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE sdr_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdr_leads_admin_gestao" ON sdr_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')
    )
  );

-- trigger updated_at
CREATE OR REPLACE FUNCTION update_sdr_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_sdr_leads_updated_at
  BEFORE UPDATE ON sdr_leads
  FOR EACH ROW EXECUTE FUNCTION update_sdr_leads_updated_at();
