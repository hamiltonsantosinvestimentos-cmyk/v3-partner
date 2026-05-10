-- ============================================================
-- Marketplace V3 Partners — Migration
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Fornecedores
CREATE TABLE IF NOT EXISTS marketplace_suppliers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      text NOT NULL,
  cnpj              text NOT NULL,
  contact_name      text NOT NULL,
  email             text NOT NULL,
  phone             text NOT NULL,
  city              text NOT NULL,
  state             char(2) NOT NULL,
  website           text,
  description       text NOT NULL,
  logo_url          text,
  categories        text[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason  text,
  reviewed_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 2. Produtos
CREATE TABLE IF NOT EXISTS marketplace_products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         uuid NOT NULL REFERENCES marketplace_suppliers(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text NOT NULL,
  category            text NOT NULL,
  price               numeric(14,2),
  price_type          text NOT NULL DEFAULT 'FIXED' CHECK (price_type IN ('FIXED', 'NEGOTIABLE', 'ON_REQUEST')),
  commission_percent  numeric(5,2) NOT NULL DEFAULT 10,
  images              text[] DEFAULT '{}',
  specs               jsonb DEFAULT '{}',
  min_order           int,
  delivery_days       int,
  available_nationwide boolean DEFAULT true,
  states              text[] DEFAULT '{}',
  status              text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE')),
  rejection_reason    text,
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- 3. Leads
CREATE TABLE IF NOT EXISTS marketplace_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  partner_id      uuid NOT NULL REFERENCES auth.users(id),
  supplier_id     uuid NOT NULL REFERENCES marketplace_suppliers(id) ON DELETE CASCADE,
  message         text,
  client_name     text,
  client_contact  text,
  status          text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'CLOSED_WON', 'CLOSED_LOST')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_marketplace_products_status ON marketplace_products(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_category ON marketplace_products(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_supplier ON marketplace_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_leads_partner ON marketplace_leads(partner_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_leads_supplier ON marketplace_leads(supplier_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_suppliers_status ON marketplace_suppliers(status);

-- 5. updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'marketplace_suppliers_updated_at') THEN
    CREATE TRIGGER marketplace_suppliers_updated_at
      BEFORE UPDATE ON marketplace_suppliers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'marketplace_products_updated_at') THEN
    CREATE TRIGGER marketplace_products_updated_at
      BEFORE UPDATE ON marketplace_products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'marketplace_leads_updated_at') THEN
    CREATE TRIGGER marketplace_leads_updated_at
      BEFORE UPDATE ON marketplace_leads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 6. RLS
ALTER TABLE marketplace_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_leads ENABLE ROW LEVEL SECURITY;

-- Suppliers: anyone can insert (public registration), only service role reads
CREATE POLICY "suppliers_insert" ON marketplace_suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "suppliers_select_own" ON marketplace_suppliers FOR SELECT USING (auth_user_id = auth.uid());

-- Products: approved products visible to all authenticated
CREATE POLICY "products_select_approved" ON marketplace_products
  FOR SELECT USING (status = 'APPROVED');

-- Products: suppliers see own products
CREATE POLICY "products_select_own" ON marketplace_products
  FOR SELECT USING (
    supplier_id IN (SELECT id FROM marketplace_suppliers WHERE auth_user_id = auth.uid())
  );

-- Leads: partners see own leads, suppliers see their leads
CREATE POLICY "leads_select_partner" ON marketplace_leads
  FOR SELECT USING (partner_id = auth.uid());

CREATE POLICY "leads_select_supplier" ON marketplace_leads
  FOR SELECT USING (
    supplier_id IN (SELECT id FROM marketplace_suppliers WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "leads_insert" ON marketplace_leads
  FOR INSERT WITH CHECK (partner_id = auth.uid());

-- Done!
SELECT 'Marketplace migration completed successfully' AS result;
