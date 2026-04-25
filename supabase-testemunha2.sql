-- Migration: segunda testemunha no contrato de mandato
-- Executar no Supabase SQL Editor

ALTER TABLE contratos_mandato
  ADD COLUMN IF NOT EXISTS testemunha2_nome      TEXT,
  ADD COLUMN IF NOT EXISTS testemunha2_email     TEXT,
  ADD COLUMN IF NOT EXISTS testemunha2_cpf       TEXT,
  ADD COLUMN IF NOT EXISTS testemunha2_token     UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS testemunha2_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS testemunha2_address   TEXT,
  ADD COLUMN IF NOT EXISTS testemunha2_birthdate TEXT;

CREATE INDEX IF NOT EXISTS contratos_mandato_testemunha2_token
  ON contratos_mandato(testemunha2_token);
