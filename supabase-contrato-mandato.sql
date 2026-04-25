-- Migration: tabela de contratos de mandato
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS contratos_mandato (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID REFERENCES credit_desk_proposals(id) ON DELETE CASCADE,
  token           UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'PENDENTE'
                  CHECK (status IN ('PENDENTE','ASSINADO','EXPIRADO','CANCELADO')),

  -- Dados pré-preenchidos do deal
  client_name     TEXT NOT NULL,
  client_cpf      TEXT,
  client_email    TEXT NOT NULL,
  commission_perc NUMERIC(5,2) NOT NULL DEFAULT 6.00,
  deal_value      NUMERIC(15,2),
  credit_line     TEXT,
  proposal_code   TEXT,

  -- Dados preenchidos pelo cliente ao assinar
  endereco        TEXT,
  bairro          TEXT,
  municipio       TEXT,
  estado          TEXT,
  cep             TEXT,

  -- Auditoria
  signed_at       TIMESTAMPTZ,
  ip_address      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contratos_mandato ENABLE ROW LEVEL SECURITY;

-- Admins e mesa podem ver tudo
CREATE POLICY "staff_all_contratos" ON contratos_mandato
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('ADMIN','GESTAO','MESA_OPERACIONAL','FINANCEIRO')
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS contratos_mandato_proposal_id ON contratos_mandato(proposal_id);
CREATE INDEX IF NOT EXISTS contratos_mandato_token       ON contratos_mandato(token);
CREATE INDEX IF NOT EXISTS contratos_mandato_status      ON contratos_mandato(status);
