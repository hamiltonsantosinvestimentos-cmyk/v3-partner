-- ============================================================
-- MIGRATION: assunto customizado de e-mail no envio ClickSign
-- Date: 2026-08-19 (parte 2, mesmo dia)
--
-- Contexto: o texto oficial do "Termo de Ratificação e Vinculação
-- Comercial" (Dr. Athaydes) veio com um assunto de e-mail próprio ("V3
-- Partners: Assinatura de Termo de Ratificação e Vinculação, Acordo
-- Guarda-Chuva"), diferente do assunto padrão fixo que
-- notifyClickSignEnvelope já gerava ("V3 Partners: Assinatura Digital,
-- {label}"). signature_message (migration 20260819) já cobria o corpo;
-- faltava o mesmo mecanismo para o assunto.
--
-- Rollback:
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS signature_subject;
-- ============================================================

ALTER TABLE public.operation_contracts
  ADD COLUMN IF NOT EXISTS signature_subject text;

COMMENT ON COLUMN public.operation_contracts.signature_subject IS 'Assunto customizado opcional do e-mail de convite/lembrete de assinatura (attributes.email_customization.subject em POST /envelopes/{id}/notifications). Par de signature_message: quando ambos estão presentes, o padrão fixo de notifyClickSignEnvelope é substituído nos dois campos.';
