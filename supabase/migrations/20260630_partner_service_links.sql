-- Partner Service Links — Módulo de Comercialização V3
-- Permite partners criarem links de venda de serviços com checkout Cora integrado

CREATE TABLE IF NOT EXISTS partner_service_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token           text UNIQUE NOT NULL,
  title           text NOT NULL,
  service_type    text NOT NULL CHECK (service_type IN ('credit_analysis', 'ma_intake', 'due_diligence', 'captacao')),
  description     text,
  price_cents     integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  active          boolean NOT NULL DEFAULT true,
  total_uses      integer NOT NULL DEFAULT 0,
  total_paid_cents bigint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_service_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id         uuid NOT NULL REFERENCES partner_service_links(id) ON DELETE RESTRICT,
  partner_id      uuid NOT NULL REFERENCES profiles(id),
  -- dados do cliente (preenchidos no checkout público)
  client_name     text NOT NULL,
  client_email    text NOT NULL,
  client_doc      text NOT NULL,
  -- pagamento Cora
  cora_invoice_id text,
  amount_cents    integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','CANCELLED','EXPIRED')),
  paid_at         timestamptz,
  pix_emv         text,
  pix_qr_code     text,
  boleto_barcode  text,
  boleto_pdf      text,
  -- pós-pagamento
  intake_token    text,
  intake_sent_at  timestamptz,
  intake_submitted_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_psl_partner_id ON partner_service_links(partner_id);
CREATE INDEX IF NOT EXISTS idx_psl_token ON partner_service_links(token);
CREATE INDEX IF NOT EXISTS idx_pso_link_id ON partner_service_orders(link_id);
CREATE INDEX IF NOT EXISTS idx_pso_cora_invoice ON partner_service_orders(cora_invoice_id);
CREATE INDEX IF NOT EXISTS idx_pso_status ON partner_service_orders(status);
CREATE INDEX IF NOT EXISTS idx_pso_intake_token ON partner_service_orders(intake_token);

-- Triggers de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_psl_updated_at ON partner_service_links;
CREATE TRIGGER trg_psl_updated_at
  BEFORE UPDATE ON partner_service_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pso_updated_at ON partner_service_orders;
CREATE TRIGGER trg_pso_updated_at
  BEFORE UPDATE ON partner_service_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE partner_service_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_service_orders ENABLE ROW LEVEL SECURITY;

-- partner_service_links: partner vê/edita apenas os seus. ADMIN e GESTAO veem todos.
CREATE POLICY psl_select ON partner_service_links FOR SELECT
  USING (partner_id = auth.uid() OR get_user_role() IN ('ADMIN','GESTAO'));

CREATE POLICY psl_insert ON partner_service_links FOR INSERT
  WITH CHECK (partner_id = auth.uid() AND get_user_role() IN ('ADMIN','GESTAO','PARTNER','PARTNER_PRO','MESA_OPERACIONAL'));

CREATE POLICY psl_update ON partner_service_links FOR UPDATE
  USING (partner_id = auth.uid() OR get_user_role() IN ('ADMIN','GESTAO'));

-- partner_service_orders: partner vê os seus. ADMIN e GESTAO veem todos.
CREATE POLICY pso_select ON partner_service_orders FOR SELECT
  USING (partner_id = auth.uid() OR get_user_role() IN ('ADMIN','GESTAO'));

-- INSERT via service role apenas (rota pública de checkout usa service_role)
CREATE POLICY pso_insert ON partner_service_orders FOR INSERT
  WITH CHECK (true); -- controlado via service_role na API

CREATE POLICY pso_update ON partner_service_orders FOR UPDATE
  USING (get_user_role() IN ('ADMIN','GESTAO'));
