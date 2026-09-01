-- Dado de referência do BACEN (SCR) via CheckTudo, 01/09/2026.
-- Nunca entra no cálculo de Tier/score da V3 (esse continua vindo só do
-- que o motor n8n calcula) — é só exibido na tela da proposta como
-- referência: crédito vencido, prejuízo (write-off) e score nativo do SCR.
-- Nullable, best-effort: falha na consulta ao CheckTudo nunca bloqueia a análise.
alter table credit_profiles
  add column if not exists bacen_scr_data jsonb;

comment on column credit_profiles.bacen_scr_data is
  'Referência do SCR/BACEN via CheckTudo (querycode 3090): score_pontuacao, score_faixa, credito_vencido_valor, credito_vencido_operacoes[], prejuizo_valor, prejuizo_operacoes[], consultado_em. Dado de referência, não entra no Tier/score da V3.';
