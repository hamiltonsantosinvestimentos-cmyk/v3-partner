-- ============================================================
-- MIGRATION: fix de integridade do quorum de revisao de minutas
-- Date: 2026-08-17
-- Scope: achado real por Joao (achou que existia divergencia de status
-- entre socios e o juridico). Investigacao confirmou 3 problemas reais
-- distintos, nenhum era "status diferente por quem olha" (approval_status
-- e campo unico, sem branching por usuario):
--
-- 1. Hamilton e Robson tinham voto duplicado na mesma minuta/rodada
--    (sem guarda contra re-voto), inflando contract_template_reviews.
--    Limpo aqui (mantem so o voto mais recente de cada reviewer por
--    template_id+review_round) + constraint UNIQUE pra nunca mais
--    acontecer -- codigo da rota passa a usar upsert.
--
-- 2. contract_templates 'NCNDA Mestre' (id efe76a60) foi inserida ja
--    como approval_status='aprovado' direto via migration
--    (20260814b_ncnda_master_template.sql), pulando o gate de revisao
--    inteiro -- zero linhas em contract_template_reviews pra ela.
--    Revertido pra 'em_revisao' aqui: passa a exigir voto real, mesmo
--    tratamento do resto do sistema. Nao bloqueia nada que ja
--    funcionava (nenhum contrato real jamais foi gerado por essa
--    minuta, confirmado via operation_contracts antes desta migration).
--
-- 3. Quorum antes so fechava com 1 juridico + 1 compliance_socio.
--    Decisao de Joao nesta sessao: 2 de 3 socios (Joao/Robson/Hamilton)
--    aprovando tambem fecha o quorum, dispensando o juridico. Logica
--    em app/api/contracts/templates/[id]/review/route.ts.
--
-- Rollback:
--   ALTER TABLE contract_template_reviews DROP CONSTRAINT IF EXISTS uq_contract_template_reviews_reviewer_round;
--   UPDATE contract_templates SET approval_status = 'aprovado' WHERE id = 'efe76a60-422d-472c-8aff-a21eea098072';
-- ============================================================

-- 1. Dedup: mantem so o voto mais recente por (template_id, review_round, reviewer_id)
DELETE FROM contract_template_reviews a
USING contract_template_reviews b
WHERE a.template_id = b.template_id
  AND a.review_round = b.review_round
  AND a.reviewer_id = b.reviewer_id
  AND a.created_at < b.created_at;

-- Constraint pra nunca mais duplicar (rota passa a usar upsert nesse conflito)
ALTER TABLE contract_template_reviews
  ADD CONSTRAINT uq_contract_template_reviews_reviewer_round
  UNIQUE (template_id, review_round, reviewer_id);

-- 2. Reverte o bypass indevido da NCNDA Mestre -- volta pra fila de
-- revisao real, mesmo tratamento das demais minutas.
UPDATE contract_templates
SET approval_status = 'em_revisao'
WHERE id = 'efe76a60-422d-472c-8aff-a21eea098072'
  AND approval_status = 'aprovado';
