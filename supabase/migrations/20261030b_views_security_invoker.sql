-- Correção emergencial de segurança (30/10/2026; "go" do João em 30/10/2026).
-- Alerta do painel Supabase: "Security Definer View" em public.v3_client_risk_trajectory.
-- Diagnóstico (somente leitura, em 30/10/2026): as três views abaixo rodavam com as permissões
-- do dono (postgres), que ignora RLS, e anon/authenticated tinham acesso total. Lidas como
-- anônimo (sem login): v3_client_risk_trajectory 19 de 19 linhas (score e classificação de
-- crédito e KYC por cliente; a tabela de base devolve 0 ao anônimo), vdr_audit_trail 34 linhas
-- (nome e e-mail de investidor, IP, código do deal), v_kyc_monthly_usage 4 linhas (nome, e-mail
-- e perfil de usuários).
-- Consumo no código: só /api/clientes/[documento] (v3_client_risk_trajectory) lê, com chave de
-- serviço (service_role tem BYPASSRLS, sem mudança). v_kyc_monthly_usage e vdr_audit_trail não
-- têm consumidor no app.
-- cm_vitrine_public e cm_vitrine_publica_imoveis ficam como estão (vitrine pública, leitura
-- anônima intencional).
-- Rollback: ver 20261030b_views_security_invoker_rollback.sql.txt

alter view public.v3_client_risk_trajectory set (security_invoker = true);
alter view public.v_kyc_monthly_usage       set (security_invoker = true);
alter view public.vdr_audit_trail           set (security_invoker = true);

revoke all on public.v3_client_risk_trajectory,
              public.v_kyc_monthly_usage,
              public.vdr_audit_trail
  from anon, authenticated;
