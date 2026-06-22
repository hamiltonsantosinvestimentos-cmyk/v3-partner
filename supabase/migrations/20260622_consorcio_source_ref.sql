-- Adiciona source_ref à consorcio_cartas para deduplicação de sync do portal Contemplados RS
ALTER TABLE consorcio_cartas ADD COLUMN IF NOT EXISTS source_ref text;
CREATE INDEX IF NOT EXISTS idx_consorcio_cartas_source_ref ON consorcio_cartas (source_ref);
