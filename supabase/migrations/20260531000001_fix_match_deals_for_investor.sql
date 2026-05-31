-- Fix: d.setor → d.sector, enum strings, HAVING → CTE com WHERE
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
  WITH scored AS (
    SELECT
      d.id AS deal_id,
      d.title,
      d.v3_code,
      d.sector AS setor,
      COALESCE((d.asset_data->>'uf')::text, '') AS uf,
      COALESCE((d.asset_data->>'valor_total')::numeric, 0) AS valor,
      (
        CASE WHEN d.sector = ANY(v_setores) THEN 40 ELSE 0 END +
        CASE WHEN (d.asset_data->>'uf') = ANY(v_ufs) OR array_length(v_ufs,1) = 0 THEN 30 ELSE 0 END +
        CASE WHEN COALESCE((d.asset_data->>'valor_total')::numeric, 0) BETWEEN v_ticket_min AND v_ticket_max THEN 30 ELSE 0 END
      )::integer AS score,
      jsonb_build_object(
        'setor_match',  d.sector = ANY(v_setores),
        'uf_match',     (d.asset_data->>'uf') = ANY(v_ufs),
        'ticket_match', COALESCE((d.asset_data->>'valor_total')::numeric, 0) BETWEEN v_ticket_min AND v_ticket_max
      ) AS reasons
    FROM ma_deals d
    WHERE d.status NOT IN ('COMPLETED','CANCELLED','REJECTED')
  )
  SELECT * FROM scored
  WHERE scored.score >= 50
  ORDER BY scored.score DESC
  LIMIT 10;
END;
$$;
