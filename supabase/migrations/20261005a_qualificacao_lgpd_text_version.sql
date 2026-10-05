-- Aviso de Privacidade da Qualificação: registra qual versão do texto a pessoa aceitou.
-- Coluna nova, nullable (backward compatible). Aceites anteriores ficam com NULL = texto padrão
-- antigo, pendente de validação.
alter table public.cm_party_qualifications
  add column if not exists lgpd_text_version text;

comment on column public.cm_party_qualifications.lgpd_text_version is
  'Versão do Aviso de Privacidade da Qualificação exibido no aceite (lib/lgpd-aviso-qualificacao.ts). NULL = aceite anterior a 05/10/2026.';
