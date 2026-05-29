-- Migration: 20260529000001_fix_legacy_deal_ma26015_taxonomy
-- Corrige deal legado MA-26-015 (PARQUE LOGISTICO GUARUVA) para padrão V3
-- Padrão vigente: V3-YYYY-MM-{SET3}-NNN (sem dia — decisão 2026-05-21)
-- Setor: LOG (Logística — Galpões, CDs, last-mile, transporte)

-- Passo 1: garantir que o código legado esteja preservado em legacy_code
UPDATE ma_deals
SET legacy_code = code
WHERE (code = 'MA-26-015' OR legacy_code = 'MA-26-015')
  AND legacy_code IS NULL;

-- Passo 2: atribuir v3_code via função padronizada (LOG = Logística)
-- generate_v3_deal_code faz auto-incremento dentro do prefixo V3-2026-05-LOG-
UPDATE ma_deals
SET v3_code = generate_v3_deal_code('LOG', '2026-05-01'::DATE)
WHERE (code = 'MA-26-015' OR legacy_code = 'MA-26-015')
  AND v3_code IS NULL;

-- Rollback:
-- UPDATE ma_deals SET v3_code = NULL WHERE legacy_code = 'MA-26-015';
