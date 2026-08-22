-- Agendamento automatico via Calendly no Agente SDR: a IA consulta horarios
-- reais do Calendly (evento "Agenda / Ecossistema"), sugere na conversa e
-- manda um link de agendamento rastreavel. O Calendly nao permite criar o
-- agendamento via API em nome de alguem -- so a propria pessoa confirma
-- clicando no link. Esta tabela guarda o link enviado (com um tracking_id
-- proprio embutido como utm_content) para casar com o webhook invitee.created
-- que a Calendly dispara quando a pessoa de fato agenda, e so entao a gente
-- confirma automaticamente na conversa.

CREATE TABLE IF NOT EXISTS sdr_agendamentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone               text NOT NULL,
  canal               text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp', 'instagram')),
  slot_start_time     timestamptz NOT NULL,
  scheduling_url      text NOT NULL,
  status              text NOT NULL DEFAULT 'link_enviado' CHECK (status IN ('link_enviado', 'confirmado')),
  calendly_event_uri  text,
  calendly_invitee_email text,
  calendly_invitee_name  text,
  confirmado_em       timestamptz,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_agendamentos_status ON sdr_agendamentos (status);
CREATE INDEX IF NOT EXISTS idx_sdr_agendamentos_phone ON sdr_agendamentos (phone, canal);

ALTER TABLE sdr_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdr_agendamentos_admin_gestao" ON sdr_agendamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );
