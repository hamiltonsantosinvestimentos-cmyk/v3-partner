-- =============================================================================
-- QUALIFICACOES CONTRATUAIS COMPLEXAS (PROCURACAO, INCAPAZES, ESPOLIO, PJ ENCADEADA)
-- =============================================================================
--
-- CONTEXTO
--   Diretriz de governanca do Dr. Athaydes (juridico), relayed por Joao em
--   01/09/2026: o link de qualificacao (/intake/qualificacao/[token]) precisa
--   sair do modelo simples (Nome + CPF) e suportar 6 naturezas de parte:
--   Pessoa Fisica, PF por Procuracao, Incapaz Relativo, Incapaz Absoluto
--   (menor impubere), Espolio e Pessoa Juridica -- cada uma com um template
--   de qualificacao civil proprio (A1/B1/B2/B3/C1/D1).
--
-- DECISAO DE ARQUITETURA (avaliada com Joao antes de codar)
--   Uma PJ pode ser representada por outra PJ, encadeado ate chegar numa PF.
--   Em vez de criar uma linha nova em cm_party_qualifications por
--   representante (exigiria convite/token separado por pessoa, quando na
--   pratica quem preenche e sempre UMA pessoa presente, o proprio
--   representante), a cadeia inteira de representacao vira JSON aninhado
--   numa coluna so. Mais simples, mais minimalista (pedido explicito do
--   Dr. Athaydes), e reflete o fluxo real (uma pessoa so, presente,
--   preenche tudo de uma vez).
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 3 colunas novas, todas nullable. person_type (PF/PJ) NAO
--   e removido nem alterado -- continua sendo escrito pela aplicacao,
--   derivado de party_nature, para nao quebrar nenhum consumidor antigo
--   que ainda le esse campo. Registros antigos (party_nature nulo) seguem
--   validos, tratados como PF/PJ simples (comportamento identico ao de
--   ontem, 31/08/2026).
-- =============================================================================

alter table public.cm_party_qualifications
  add column if not exists party_nature text check (party_nature is null or party_nature in (
    'PF', 'PF_PROCURACAO', 'INCAPAZ_RELATIVO', 'INCAPAZ_ABSOLUTO', 'ESPOLIO', 'PJ'
  )),
  add column if not exists company_legal_nature text check (company_legal_nature is null or company_legal_nature in (
    'privado', 'publico', 'misto'
  )),
  add column if not exists representation jsonb;

comment on column public.cm_party_qualifications.party_nature is
  'Natureza jurídica da parte (01/09/2026, diretriz Dr. Athaydes): discriminador rico que substitui o antigo person_type PF/PJ para fins de template de qualificação. person_type continua sincronizado a partir deste campo, nunca removido.';
comment on column public.cm_party_qualifications.company_legal_nature is
  'Só para party_nature=PJ: privado/público/misto. Default "privado" na aplicação quando não informado (caso mais comum, igual ao texto fixo já usado antes desta migration).';
comment on column public.cm_party_qualifications.representation is
  'JSON aninhado com o(s) representante(s) legal(is) da parte (procurador/genitor/curador/tutor/inventariante/administrador/representante_legal). Recursivo: se o representante também for PJ, ele carrega sua própria chave "representation". Estrutura e validação em lib/legal-qualification.ts (buildLegalQualification).';
