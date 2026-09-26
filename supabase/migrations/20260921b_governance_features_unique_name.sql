-- Complemento de 20260921a: chave única em governance_features.name para a
-- rota de ingestão (app/api/governance/ingest) fazer upsert idempotente --
-- a mesma funcionalidade reauditada em outro dia atualiza a mesma linha,
-- nunca duplica.
ALTER TABLE governance_features ADD CONSTRAINT governance_features_name_unique UNIQUE (name);
