-- ============================================================
-- MIGRATION: contract_templates.head_declared_in_body
-- Date: 2026-09-11
-- Contexto: João achou, testando o NCNDA real da Infiniti, que aparecia
-- duas vezes como V3 Partners na qualificação do contrato -- uma vez na
-- cláusula "ESTRUTURADORA" fixa que já existe no corpo de 3 minutas
-- aprovadas (NCNDA V3 PARTNERS MODELO DR LUIS, NCNDA Mestre de Crédito,
-- NCNDA V3 PARTNERS - Mesa M&A), e outra vez pela injeção automática do
-- Head da mesa em party_qualifications_block (app/api/contracts/generate,
-- resolveDeskHead). Os dois mecanismos nunca se conheciam.
--
-- Esta coluna deixa a minuta declarar que já nomeia a V3/Head no próprio
-- texto fixo, para a rota de geração pular só a segunda menção textual
-- (nunca o signatário real -- head_mesa continua no array de partes/
-- assinatura, só a frase redundante em party_qualifications_block some).
-- ============================================================

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS head_declared_in_body boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN contract_templates.head_declared_in_body IS
  'true quando o corpo fixo da minuta já nomeia V3/Head (cláusula ESTRUTURADORA própria) -- app/api/contracts/generate/route.ts não injeta a frase redundante de head_mesa em party_qualifications_block nesse caso, mas mantém o signatário real.';

UPDATE contract_templates
SET head_declared_in_body = true
WHERE id IN (
  '66e2d0e4-dfb4-4940-8db3-1d0de728e732', -- NCNDA V3 PARTNERS MODELO DR LUIS 2026 09 03 (capital_markets)
  'efe76a60-422d-472c-8aff-a21eea098072', -- NCNDA Mestre -- Confidencialidade, Não Circunvenção e Vínculo pela Introdução (credito)
  'ac51a318-43e2-45ae-80d5-c347f3d769b8', -- NCNDA V3 PARTNERS - Mesa M&A (reaproveitado) (ma)
  '8d1ae63c-5b5c-44aa-b451-9921ff9ba148'  -- Contrato de Compra e Venda de Ativo Naval (ma) -- tem cláusula própria, protege se um dia usar bloco auto
);
