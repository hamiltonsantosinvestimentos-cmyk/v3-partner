-- BRIEF docs/briefs/2026-11-23_enterprise-assinatura-da-equipe.md (go mesmo assim do Hamilton, 23/11/2026).
-- Cobrança que o master Enterprise faz de cada usuário da equipe, registrada no perfil do usuário.
-- A V3 só registra e mostra; o master cobra por fora e marca o pagamento.
-- Formato: { cobra, valor, periodicidade (MENSAL|TRIMESTRAL|ANUAL), dia_vencimento (1..28), inicio, pago_ate }
-- pago_ate = data do último vencimento quitado (null = nenhum).
-- Leitura: profiles_select_own / profiles_select_admin. Escrita direta barrada pelo trigger
-- profiles_trava_colunas_sensiveis (lista fechada): só service role (rota /api/enterprise/assinaturas) e ADMIN.
-- Sem policy, GRANT, view ou função nova.

alter table public.profiles add column if not exists enterprise_assinatura jsonb;

comment on column public.profiles.enterprise_assinatura is
  'Cobrança do master Enterprise a este usuário da equipe (só registro; a V3 não recebe). pago_ate = último vencimento quitado.';

alter table public.profiles drop constraint if exists profiles_enterprise_assinatura_valor_chk;
alter table public.profiles add constraint profiles_enterprise_assinatura_valor_chk check (
  enterprise_assinatura is null
  or coalesce((enterprise_assinatura->>'cobra')::boolean, false) = false
  or coalesce((enterprise_assinatura->>'valor')::numeric, 0) > 0
);
