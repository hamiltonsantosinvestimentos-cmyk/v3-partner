-- Tema visual do Enterprise white label (cores, logo para fundo claro e ícone da aba).
-- BRIEF: docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md (QA LIBERADO rodada 4, go Hamilton 21/11/2026)
-- Formato validado na API e de novo na leitura (lib/enterprise-tema.ts):
--   { "cor_principal": "#RRGGBB", "cor_acento": "#RRGGBB", "logo_claro_url": "...", "icone_url": "..." }
-- Sem policy, grant, view ou função nova. A coluna nasce bloqueada para sessão comum pelo trigger
-- profiles_trava_colunas_sensiveis (20261120a: só updated_at é permitido fora de service_role/ADMIN).
-- Reversão: 20261121_white_label_tema_rollback.sql.txt (reverter o deploy do código ANTES).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS white_label_tema jsonb;

COMMENT ON COLUMN public.profiles.white_label_tema IS
  'Enterprise master: tema visual do white label (cor_principal, cor_acento, logo_claro_url, icone_url). Gravado só pela rota do servidor.';
