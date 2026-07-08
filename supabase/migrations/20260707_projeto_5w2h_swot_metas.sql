-- Aba "Projeto": 5W2H + Matriz SWOT + Metas mensais/anuais por setor
-- (M&A, Crédito, Consórcio, Precatórios, Marketplace), conectadas a dados reais.

CREATE TABLE IF NOT EXISTS sector_5w2h (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector       text NOT NULL UNIQUE CHECK (sector IN ('MA','CREDITO','CONSORCIO','PRECATORIOS','MARKETPLACE')),
  o_que        text,
  por_que      text,
  onde         text,
  quando       text,
  quem         text,
  como         text,
  quanto_custa text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS sector_swot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector        text NOT NULL UNIQUE CHECK (sector IN ('MA','CREDITO','CONSORCIO','PRECATORIOS','MARKETPLACE')),
  forcas        text,
  fraquezas     text,
  oportunidades text,
  ameacas       text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES profiles(id)
);

-- month = 0 representa a meta ANUAL daquele setor/ano; month 1-12 = meta mensal.
-- Usa 0 (não NULL) porque NULL não é comparável em constraints UNIQUE no Postgres
-- (permitiria múltiplas linhas "anuais" duplicadas para o mesmo setor/ano).
CREATE TABLE IF NOT EXISTS sector_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector          text NOT NULL CHECK (sector IN ('MA','CREDITO','CONSORCIO','PRECATORIOS','MARKETPLACE')),
  year            int  NOT NULL,
  month           int  NOT NULL DEFAULT 0 CHECK (month BETWEEN 0 AND 12),
  meta_valor      numeric NOT NULL DEFAULT 0,
  meta_quantidade int,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES profiles(id),
  UNIQUE (sector, year, month)
);

ALTER TABLE sector_5w2h ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_swot ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_goals ENABLE ROW LEVEL SECURITY;

-- Leitura/escrita restrita a ADMIN e GESTAO (mesmo padrão de outras áreas administrativas)
CREATE POLICY sector_5w2h_admin_all ON sector_5w2h FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')));

CREATE POLICY sector_swot_admin_all ON sector_swot FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')));

CREATE POLICY sector_goals_admin_all ON sector_goals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')));
