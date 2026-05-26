-- investor_demands: demandas de compra de investidores (buy-side)
CREATE TABLE IF NOT EXISTS investor_demands (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id uuid REFERENCES investor_profiles(id) ON DELETE SET NULL,
  nome_contato        text NOT NULL,
  email               text NOT NULL,
  telefone            text,
  empresa             text,
  cnpj                text,
  setores             text[] NOT NULL DEFAULT '{}',
  ufs                 text[] NOT NULL DEFAULT '{}',
  ticket_min          numeric NOT NULL DEFAULT 0,
  ticket_max          numeric NOT NULL DEFAULT 0,
  tipos_operacao      text[] NOT NULL DEFAULT '{}',
  criterios           text,
  origem              text NOT NULL DEFAULT 'portal',
  status              text NOT NULL DEFAULT 'ativo',
  notas               text,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- demand_matches: deals que matcham com uma demanda buy-side
CREATE TABLE IF NOT EXISTS demand_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id       uuid NOT NULL REFERENCES investor_demands(id) ON DELETE CASCADE,
  deal_id         uuid NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
  score           integer NOT NULL DEFAULT 0,
  match_reasons   jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'novo',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(demand_id, deal_id)
);

CREATE OR REPLACE TRIGGER set_investor_demands_updated_at
  BEFORE UPDATE ON investor_demands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER set_demand_matches_updated_at
  BEFORE UPDATE ON demand_matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_investor_demands_status ON investor_demands(status);
CREATE INDEX IF NOT EXISTS idx_investor_demands_setores ON investor_demands USING GIN(setores);
CREATE INDEX IF NOT EXISTS idx_demand_matches_demand_id ON demand_matches(demand_id);
CREATE INDEX IF NOT EXISTS idx_demand_matches_status ON demand_matches(status);

ALTER TABLE investor_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investor_demands_admin_all" ON investor_demands
  FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY "demand_matches_admin_all" ON demand_matches
  FOR ALL USING (get_user_role() IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

-- match_deals_for_investor: dado demand_id, retorna top-10 deals com score >= 50
CREATE OR REPLACE FUNCTION match_deals_for_investor(p_demand_id uuid)
RETURNS TABLE (
  deal_id   uuid,
  title     text,
  v3_code   text,
  setor     text,
  uf        text,
  valor     numeric,
  score     integer,
  reasons   jsonb
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_setores       text[];
  v_ufs           text[];
  v_ticket_min    numeric;
  v_ticket_max    numeric;
BEGIN
  SELECT setores, ufs, ticket_min, ticket_max
    INTO v_setores, v_ufs, v_ticket_min, v_ticket_max
    FROM investor_demands WHERE id = p_demand_id;

  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.v3_code,
    d.setor,
    COALESCE((d.asset_data->>'uf')::text, '') AS uf,
    COALESCE((d.asset_data->>'valor_total')::numeric, 0) AS valor,
    (
      CASE WHEN d.setor = ANY(v_setores) THEN 40 ELSE 0 END +
      CASE WHEN (d.asset_data->>'uf') = ANY(v_ufs) OR array_length(v_ufs,1) = 0 THEN 30 ELSE 0 END +
      CASE WHEN (
        array_length(v_ufs,1) IS NULL OR
        COALESCE((d.asset_data->>'valor_total')::numeric, 0) BETWEEN v_ticket_min AND v_ticket_max
      ) THEN 30 ELSE 0 END
    )::integer AS score,
    jsonb_build_object(
      'setor_match',  d.setor = ANY(v_setores),
      'uf_match',     (d.asset_data->>'uf') = ANY(v_ufs),
      'ticket_match', COALESCE((d.asset_data->>'valor_total')::numeric, 0) BETWEEN v_ticket_min AND v_ticket_max
    ) AS reasons
  FROM ma_deals d
  WHERE d.status NOT IN ('fechado','cancelado','arquivado')
  HAVING (
    CASE WHEN d.setor = ANY(v_setores) THEN 40 ELSE 0 END +
    CASE WHEN (d.asset_data->>'uf') = ANY(v_ufs) OR array_length(v_ufs,1) = 0 THEN 30 ELSE 0 END +
    CASE WHEN COALESCE((d.asset_data->>'valor_total')::numeric, 0) BETWEEN v_ticket_min AND v_ticket_max THEN 30 ELSE 0 END
  ) >= 50
  ORDER BY score DESC
  LIMIT 10;
END;
$$;
