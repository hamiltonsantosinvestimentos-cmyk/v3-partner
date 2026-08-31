-- =============================================================================
-- QUALIFICACAO CIVIL COMPLETA OBRIGATORIA + ENDERECO ESTRUTURADO
-- =============================================================================
--
-- CONTEXTO
--   Joao pediu (31/08/2026) que o link publico de qualificacao
--   (/intake/qualificacao/[token]) exija o modelo completo de qualificacao
--   civil usado em clausula de contrato real (nacionalidade, estado civil,
--   profissao, data de nascimento, RG, endereco residencial completo,
--   telefone), para TODO papel (nao so quem recebe repasse de comissao),
--   por exigencia de KYC/checagem de responsaveis por empresa. O endereco
--   precisa vir em campos separados (Rua/Numero/Bairro/Cidade/Estado/CEP)
--   para bater exatamente com o texto da clausula.
--
-- ABORDAGEM (aditiva, nunca quebra os 3 consumidores existentes)
--   cm_party_qualifications.endereco_completo e company_address (colunas
--   TEXT ja existentes desde 20260813) sao lidas hoje em 3 lugares
--   (lib/qualification-roles.ts, app/api/cm/qualifications/legal-text/route.ts,
--   app/api/contracts/generate/route.ts) como string livre. Em vez de
--   reescrever os 3 consumidores, esta migration so adiciona os campos
--   estruturados; o backend (route.ts do intake) passa a MONTAR
--   endereco_completo/company_address a partir das partes antes de gravar,
--   nenhum consumidor precisa mudar.
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 12 colunas novas, todas nullable. Nenhuma coluna existente
--   alterada, nenhum dado historico tocado. Obrigatoriedade e validada na
--   aplicacao (route.ts), nao via NOT NULL no banco -- os registros antigos
--   (pre-31/08) continuam validos sem esses campos.
-- =============================================================================

alter table public.cm_party_qualifications
  add column if not exists endereco_rua text,
  add column if not exists endereco_numero text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_estado text,
  add column if not exists endereco_cep text,
  add column if not exists company_rua text,
  add column if not exists company_numero text,
  add column if not exists company_bairro text,
  add column if not exists company_cidade text,
  add column if not exists company_estado text,
  add column if not exists company_cep text;

comment on column public.cm_party_qualifications.endereco_rua is
  'Endereco residencial estruturado (31/08/2026) -- junto com numero/bairro/cidade/estado/cep, monta endereco_completo no backend (app/api/cm/qualificacao/[token]/route.ts). endereco_completo continua sendo a fonte lida pelos 3 consumidores de texto juridico, nunca removida.';
comment on column public.cm_party_qualifications.company_rua is
  'Endereco da sede da PJ, estruturado (31/08/2026) -- monta company_address no backend, mesmo padrao do endereco residencial.';
