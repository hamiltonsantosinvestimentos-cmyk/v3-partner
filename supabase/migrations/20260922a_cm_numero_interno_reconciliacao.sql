-- P0 (22/09/2026, reuniao com Dr. Athaydes e Taisa Pedroso): numero_interno
-- tinha geracao propria via generate_cm_numero_interno() (formato
-- V3-YYYY-MM-BOL-NNN, serie "BOL" nunca registrada em v3_code_series),
-- gravado uma unica vez na criacao do listing e nunca reconciliado com
-- anonymous_id (o codigo real, via issueV3Code). 63/63 listagens com
-- numero_interno preenchido estavam divergentes do anonymous_id real.
--
-- Codigo corrigido em app/api/cm/listings/route.ts,
-- app/api/cm/intake/generate/route.ts e app/api/cm/intake/[token]/route.ts
-- (numero_interno passa a ser sempre o mesmo valor de anonymous_id).
-- Esta migration so reconcilia o dado historico ja gravado.
--
-- Scope: cm_asset_listings.numero_interno (dado, sem alteracao de schema)
-- Rollback: nao ha rollback de dado (o valor legado V3-*-BOL-* nao era um
--           identificador correto em primeiro lugar, so a serie corrompida)

UPDATE cm_asset_listings
SET numero_interno = anonymous_id
WHERE numero_interno IS NOT NULL
  AND numero_interno <> anonymous_id;

COMMENT ON FUNCTION generate_cm_numero_interno(date) IS 'DEPRECATED (22/09/2026): nao chamar mais. numero_interno e sempre o mesmo valor de anonymous_id (issueV3Code), atribuido em app/api/cm/listings, app/api/cm/intake/generate e app/api/cm/intake/[token]. Mantida sem DROP para rollback facil, ver migration 20260922a.';
