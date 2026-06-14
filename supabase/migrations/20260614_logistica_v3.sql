-- ═══════════════════════════════════════════════════════
--  Logística V3 — Voos, Carros e Locações
--  Registro/monitoramento de viagens corporativas da equipe V3
--  V1: CRUD manual + histórico de preço (Voos) preparado
--  para automação futura via n8n + Amadeus
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS logistics_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text        NOT NULL CHECK (category IN ('voo','carro','locacao')),
  title         text        NOT NULL,
  origin        text,
  destination   text,
  start_date    date,
  end_date      date,
  provider      text,
  target_price  numeric,
  current_price numeric,
  currency      text        NOT NULL DEFAULT 'BRL',
  status        text        NOT NULL DEFAULT 'monitorando'
                 CHECK (status IN ('monitorando','reservado','concluido','cancelado')),
  notes         text,
  created_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logistics_price_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid        NOT NULL REFERENCES logistics_items(id) ON DELETE CASCADE,
  price      numeric     NOT NULL,
  currency   text        NOT NULL DEFAULT 'BRL',
  source     text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logistics_items_category
  ON logistics_items(category);

CREATE INDEX IF NOT EXISTS idx_logistics_price_history_item
  ON logistics_price_history(item_id, checked_at DESC);

ALTER TABLE logistics_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_price_history ENABLE ROW LEVEL SECURITY;

-- Ferramenta interna — ADMIN, GESTAO e MESA_OPERACIONAL (não exposta a Partners)
CREATE POLICY "logistics_items_admin_gestao_mesa"
  ON logistics_items FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY "logistics_price_history_admin_gestao_mesa"
  ON logistics_price_history FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

DROP TRIGGER IF EXISTS set_updated_at_logistics_items ON logistics_items;
CREATE TRIGGER set_updated_at_logistics_items
  BEFORE UPDATE ON logistics_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
