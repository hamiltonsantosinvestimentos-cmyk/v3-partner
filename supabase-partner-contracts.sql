-- Tabela de contratos assinados pelos partners
CREATE TABLE IF NOT EXISTS partner_contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  registration_id     uuid,
  plano               text NOT NULL,
  contract_version    text NOT NULL DEFAULT 'v1.0',
  -- Dados do licenciado (pré-preenchidos do cadastro)
  razao_social        text,
  cnpj_cpf            text,
  endereco_completo   text,
  nome_representante  text,
  cpf_representante   text,
  email               text NOT NULL,
  telefone            text,
  valor_mensal        text,
  -- Metadados da assinatura eletrônica
  accepted_at         timestamptz NOT NULL DEFAULT now(),
  ip_address          text,
  device_info         text,
  -- HTML completo do contrato no momento da assinatura (para arquivamento)
  contract_html       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_contracts_user_id ON partner_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_contracts_email ON partner_contracts(email);

ALTER TABLE partner_contracts ENABLE ROW LEVEL SECURITY;

-- Apenas service role tem acesso total
CREATE POLICY "service_role_all" ON partner_contracts
  FOR ALL USING (true) WITH CHECK (true);
