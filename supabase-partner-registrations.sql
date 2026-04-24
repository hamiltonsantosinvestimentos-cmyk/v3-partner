-- Tabela de cadastros de parceiros (pré-aprovação)
CREATE TABLE IF NOT EXISTS partner_registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plano
  plano           text NOT NULL CHECK (plano IN ('PARTNER', 'PARTNER_PRO')),

  -- Tipo de pessoa
  tipo_pessoa     text NOT NULL CHECK (tipo_pessoa IN ('PF', 'PJ')),

  -- Dados comuns
  email           text NOT NULL,
  telefone        text NOT NULL,

  -- Pessoa Física
  nome_completo   text,
  cpf             text,
  data_nascimento date,

  -- Pessoa Jurídica
  razao_social    text,
  nome_fantasia   text,
  cnpj            text,

  -- Endereço
  cep             text,
  logradouro      text,
  numero          text,
  complemento     text,
  bairro          text,
  cidade          text,
  estado          text,

  -- Documentos (paths no Supabase Storage)
  doc_identidade  text[],   -- RG ou CNH (PF)
  doc_cnpj        text[],   -- Contrato social (PJ)
  doc_socio       text[],   -- Documentos dos sócios (PJ)

  -- Status e revisão
  status          text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REPROVADO', 'EM_ANALISE')),
  observacao      text,
  revisado_por    uuid REFERENCES auth.users(id),
  revisado_em     timestamptz,

  -- Controle
  ip_origem       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_partner_reg_status   ON partner_registrations(status);
CREATE INDEX IF NOT EXISTS idx_partner_reg_email    ON partner_registrations(email);
CREATE INDEX IF NOT EXISTS idx_partner_reg_created  ON partner_registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_reg_cpf      ON partner_registrations(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_reg_cnpj     ON partner_registrations(cnpj) WHERE cnpj IS NOT NULL;

-- RLS
ALTER TABLE partner_registrations ENABLE ROW LEVEL SECURITY;

-- INSERT público (qualquer pessoa pode enviar cadastro)
CREATE POLICY "public_insert_registration"
  ON partner_registrations FOR INSERT
  WITH CHECK (true);

-- SELECT/UPDATE apenas ADMIN e GESTAO
CREATE POLICY "admin_select_registration"
  ON partner_registrations FOR SELECT
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE POLICY "admin_update_registration"
  ON partner_registrations FOR UPDATE
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

-- Storage bucket para documentos (executar separado no Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('partner-docs', 'partner-docs', false);
