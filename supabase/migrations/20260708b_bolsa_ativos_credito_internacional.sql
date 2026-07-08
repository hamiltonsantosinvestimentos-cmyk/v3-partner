-- Renomeia o setor PRECATORIOS -> BOLSA_ATIVOS (agora cobre todos os tipos de
-- ativo da Mesa de Capitais, nao so precatorio) e adiciona o setor
-- CREDITO_INTERNACIONAL (linhas "Op. Internacional ..." da Mesa de Credito N3).

ALTER TABLE sector_5w2h DROP CONSTRAINT IF EXISTS sector_5w2h_sector_check;
UPDATE sector_5w2h SET sector = 'BOLSA_ATIVOS' WHERE sector = 'PRECATORIOS';
ALTER TABLE sector_5w2h ADD CONSTRAINT sector_5w2h_sector_check
  CHECK (sector IN ('MA','CREDITO','CONSORCIO','BOLSA_ATIVOS','MARKETPLACE','CREDITO_INTERNACIONAL'));

ALTER TABLE sector_swot DROP CONSTRAINT IF EXISTS sector_swot_sector_check;
UPDATE sector_swot SET sector = 'BOLSA_ATIVOS' WHERE sector = 'PRECATORIOS';
ALTER TABLE sector_swot ADD CONSTRAINT sector_swot_sector_check
  CHECK (sector IN ('MA','CREDITO','CONSORCIO','BOLSA_ATIVOS','MARKETPLACE','CREDITO_INTERNACIONAL'));

ALTER TABLE sector_goals DROP CONSTRAINT IF EXISTS sector_goals_sector_check;
UPDATE sector_goals SET sector = 'BOLSA_ATIVOS' WHERE sector = 'PRECATORIOS';
ALTER TABLE sector_goals ADD CONSTRAINT sector_goals_sector_check
  CHECK (sector IN ('MA','CREDITO','CONSORCIO','BOLSA_ATIVOS','MARKETPLACE','CREDITO_INTERNACIONAL'));
