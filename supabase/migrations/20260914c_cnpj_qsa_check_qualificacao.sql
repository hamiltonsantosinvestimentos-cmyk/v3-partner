-- Checagem automática de CNPJ + quadro societário (14/09/2026, pedido de
-- João: "verificar se o CNPJ está ativo, se o sócio informado é o diretor
-- ou se foi trocado" antes de aprovar minuta e enviar para assinatura).
--
-- Fonte: BrasilAPI (gratuita, já usada e testada em app/api/cnpj-search e
-- app/api/cpf-validate), mesma que devolve situacao_cadastral + qsa real da
-- Receita Federal. CPF fica de fora por decisão explícita de João: não
-- existe fonte gratuita de "situação cadastral" de CPF (bloqueada por
-- captcha no site da própria Receita), e a única fonte paga já integrada
-- (Checktudo) não traz esse dado (só SCR/processos) -- ver lib/checktudo.ts.
--
-- Roda automaticamente quando a parte PJ termina a qualificação (best-effort,
-- nunca bloqueia o preenchimento se a consulta externa falhar).

ALTER TABLE cm_party_qualifications
  ADD COLUMN IF NOT EXISTS cnpj_situacao_cadastral text,
  ADD COLUMN IF NOT EXISTS cnpj_razao_social text,
  ADD COLUMN IF NOT EXISTS cnpj_socios jsonb,
  ADD COLUMN IF NOT EXISTS cnpj_socio_informado_confere boolean,
  ADD COLUMN IF NOT EXISTS cnpj_checado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cnpj_check_error text;

COMMENT ON COLUMN cm_party_qualifications.cnpj_situacao_cadastral IS 'Situação cadastral na Receita Federal (ATIVA/BAIXADA/SUSPENSA/INAPTA), via BrasilAPI. Só preenchido para party_nature=PJ.';
COMMENT ON COLUMN cm_party_qualifications.cnpj_socios IS 'Quadro de sócios e administradores (QSA) real, array de {nome, qualificacao}, snapshot no momento da checagem.';
COMMENT ON COLUMN cm_party_qualifications.cnpj_socio_informado_confere IS 'NULL = não checado ou checagem falhou. true = o full_name informado aparenta corresponder a alguém do QSA (match aproximado, nunca cruza automaticamente com certeza absoluta -- confirmar manualmente em caso de dúvida). false = não encontrado no QSA, sinal de atenção pro revisor.';
COMMENT ON COLUMN cm_party_qualifications.cnpj_check_error IS 'Mensagem de erro se a consulta à Receita Federal falhou (nunca silenciosamente vazio quando devia ter dado certo).';
