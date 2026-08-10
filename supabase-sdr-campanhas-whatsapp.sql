-- ============================================================
-- CRM do WhatsApp: Fila de Envio em Massa (estrutura, sem disparo)
-- Execute no SQL Editor do Supabase
-- O envio real fica pendente da migração para a API oficial do WhatsApp
-- Business (Meta Cloud API / BSP) — esta estrutura só organiza a fila.
-- ============================================================

CREATE TABLE IF NOT EXISTS sdr_campanhas_whatsapp (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  mensagem_template  text NOT NULL DEFAULT '',    -- suporta {{nome}} como placeholder
  intervalo_segundos int NOT NULL DEFAULT 30 CHECK (intervalo_segundos >= 5),
  status             text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','pronta_para_envio','pausada')),
  total_contatos     int NOT NULL DEFAULT 0,
  created_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdr_campanha_whatsapp_contatos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id   uuid NOT NULL REFERENCES sdr_campanhas_whatsapp(id) ON DELETE CASCADE,
  phone         text NOT NULL,
  nome          text,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','invalido','enviado','erro')),
  erro_detalhe  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_campanha_wpp_contatos_campanha ON sdr_campanha_whatsapp_contatos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_sdr_campanha_wpp_contatos_status ON sdr_campanha_whatsapp_contatos(status);

ALTER TABLE sdr_campanhas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_campanha_whatsapp_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdr_campanhas_whatsapp_admin_gestao" ON sdr_campanhas_whatsapp
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );

CREATE POLICY "sdr_campanha_wpp_contatos_admin_gestao" ON sdr_campanha_whatsapp_contatos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );

CREATE OR REPLACE FUNCTION update_sdr_campanhas_whatsapp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_sdr_campanhas_whatsapp_updated_at
  BEFORE UPDATE ON sdr_campanhas_whatsapp
  FOR EACH ROW EXECUTE FUNCTION update_sdr_campanhas_whatsapp_updated_at();
