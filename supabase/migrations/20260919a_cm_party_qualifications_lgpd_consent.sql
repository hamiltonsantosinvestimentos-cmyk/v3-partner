-- Sprint 1, Fase 4.2 (19/09/2026, "go" de Joao Lemos): mecanismo tecnico de
-- consentimento LGPD no link de qualificacao (timestamp + IP), texto padrao
-- ate validacao formal de Dr. Luis Athaydes / Robson Lino. Colunas nullable,
-- nao retroativas -- lotes de qualificacao ja preenchidos antes desta data
-- ficam sem esse registro, mesmo padrao de nao reescrever historico ja usado
-- em outras colunas de auditoria desta tabela (filled_ip).

alter table public.cm_party_qualifications
  add column if not exists lgpd_accepted_at timestamptz,
  add column if not exists lgpd_accepted_ip text;

comment on column public.cm_party_qualifications.lgpd_accepted_at is
  'Timestamp do aceite do termo de consentimento LGPD no formulario publico de qualificacao (Fase 4.2, 19/09/2026). Texto padrao ate validacao formal Dr. Athaydes/Robson.';
comment on column public.cm_party_qualifications.lgpd_accepted_ip is
  'IP de quem aceitou o termo de consentimento LGPD, mesmo padrao de filled_ip.';
