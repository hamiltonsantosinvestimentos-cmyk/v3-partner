-- Documenta colunas Registrato que já existem em produção sem migration correspondente
-- (schema drift — adicionadas via dashboard/MCP em sessão anterior, nunca commitadas aqui).
-- IF NOT EXISTS torna este ALTER seguro mesmo já existindo em produção.
ALTER TABLE credit_profiles ADD COLUMN IF NOT EXISTS registrato_data JSONB;
ALTER TABLE credit_profiles ADD COLUMN IF NOT EXISTS registrato_path TEXT;
ALTER TABLE credit_profiles ADD COLUMN IF NOT EXISTS registrato_emitted_at TIMESTAMPTZ;

-- Escavador: mesmo padrão do Registrato, para persistir o resultado da consulta e permitir
-- que o relatório final (lib/credit-report-data.ts) monte uma seção própria, em vez de só
-- marcar "consultado: sim/não" sem nenhum detalhe do que foi encontrado.
ALTER TABLE credit_profiles ADD COLUMN IF NOT EXISTS escavador_data JSONB;

COMMENT ON COLUMN credit_profiles.escavador_data IS
  'Resultado persistido da consulta ao Escavador (processos judiciais), no mesmo formato retornado por /api/kyc/escavador. Escrito quando a Mesa consulta o Escavador a partir de uma proposta vinculada a este credit_profile.';

-- Rollback:
-- ALTER TABLE credit_profiles DROP COLUMN IF EXISTS escavador_data;
