-- Transforma sector_5w2h de "1 registro por setor" pra uma lista de itens de
-- acao por setor, cada um com prazo e status (resolvido / em andamento / atrasado).
ALTER TABLE sector_5w2h DROP CONSTRAINT IF EXISTS sector_5w2h_sector_key;
ALTER TABLE sector_5w2h
  ADD COLUMN IF NOT EXISTS prazo date,
  ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
