-- % de comissionamento sobre o valor da meta, usado pra projetar quanto isso
-- gera de comissao mes a mes. Fica guardado na linha anual (month=0) do setor/ano
-- e se aplica a todos os meses daquele ano.
ALTER TABLE sector_goals
  ADD COLUMN IF NOT EXISTS comissao_percent numeric;
