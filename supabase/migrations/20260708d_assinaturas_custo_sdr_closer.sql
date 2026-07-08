-- Custo de comissão de SDR e Closer sobre vendas novas de assinatura,
-- usado no setor Assinaturas do Projeto pra calcular lucro líquido.
ALTER TABLE sector_goals
  ADD COLUMN IF NOT EXISTS custo_sdr_percent numeric,
  ADD COLUMN IF NOT EXISTS custo_closer_percent numeric;
