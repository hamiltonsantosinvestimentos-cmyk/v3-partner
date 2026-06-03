-- CRM de Prospecção de Novos Partners
-- Roles: SDR e CLOSER adicionados ao sistema

-- Tabela principal de prospects
CREATE TABLE IF NOT EXISTS prospeccao_leads (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome            text NOT NULL,
  documento       text,                          -- CPF ou CNPJ
  email           text,
  telefone        text,
  cidade          text,
  estado          text,
  origem          text NOT NULL DEFAULT 'outro', -- linkedin|instagram|indicacao|youtube|google|evento|outro
  indicado_por_partner_id uuid REFERENCES profiles(id) ON DELETE SET NULL, -- se origem=indicacao e for partner
  indicado_por_nome       text,                 -- nome livre (não partner)
  responsavel_id  uuid REFERENCES profiles(id) ON DELETE SET NULL, -- SDR ou Closer responsável
  responsavel_nome text,
  etapa           text NOT NULL DEFAULT 'prospect', -- prospect|contatado|interessado|trial|convertido|perdido
  motivo_perda    text,
  notas           text,
  link_token      text UNIQUE,                  -- token para link de cadastro
  link_gerado_em  timestamptz,
  convertido_em   timestamptz,
  partner_id      uuid REFERENCES profiles(id) ON DELETE SET NULL, -- profile quando vira partner
  comissao_gerada boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Histórico de movimentações (auditoria)
CREATE TABLE IF NOT EXISTS prospeccao_historico (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id         uuid NOT NULL REFERENCES prospeccao_leads(id) ON DELETE CASCADE,
  etapa_anterior  text,
  etapa_nova      text,
  nota            text,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prospeccao_leads_etapa ON prospeccao_leads(etapa);
CREATE INDEX IF NOT EXISTS idx_prospeccao_leads_responsavel ON prospeccao_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_prospeccao_leads_link_token ON prospeccao_leads(link_token);
CREATE INDEX IF NOT EXISTS idx_prospeccao_historico_lead ON prospeccao_historico(lead_id);

-- RLS
ALTER TABLE prospeccao_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospeccao_historico ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN, SDR, CLOSER têm acesso total
CREATE POLICY "prospeccao_leads_access" ON prospeccao_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'SDR', 'CLOSER', 'GESTAO')
    )
  );

CREATE POLICY "prospeccao_historico_access" ON prospeccao_historico
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'SDR', 'CLOSER', 'GESTAO')
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_prospeccao_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prospeccao_updated_at
  BEFORE UPDATE ON prospeccao_leads
  FOR EACH ROW EXECUTE FUNCTION update_prospeccao_updated_at();
