-- Cockpit de Due Diligence e Compliance (Bolsa de Ativos) -- Fase 0.
-- Concede a feature "bolsa_compliance_dashboard" as 5 pessoas nomeadas por Joao em
-- 22/08/2026 (Diretoria = 3 socios ADMIN + Taisa Pedroso + Dr. Luis Athaydes).
-- Gate por user_id individual em user_feature_access, nao por role -- decisao explicita:
-- uma conta ADMIN/GESTAO/MESA_OPERACIONAL futura nao deve herdar acesso automatico so
-- por ter esse role. Ver lib/cm/compliance-access.ts.
--
-- user_id reais confirmados via REST em 22/08/2026 (tabela profiles):
--   Joao Lemos Netto           -> d0af8eaa-9f3c-4e7a-b8c6-613736524317
--   Hamilton Santos (suporte@) -> 75c6cac4-8d30-436e-b9a6-d5d494d7470b
--   Robson Lino (login real, robinholino16@gmail.com) -> d5f26efd-8ed5-4d90-b3f4-9ce0004803c5
--   Taisa Pedroso              -> e8c28170-f583-4f84-a654-869508f3ad1d
--   Dr. Luis Athaydes          -> 82171bc1-edbd-40f8-936b-1b26d412a121
--
-- Schema real de user_feature_access confirmado via types/supabase.ts:
--   id, user_id, feature (text), access_level (text), vertical_filter (text[]), created_at, updated_at.
-- Sem constraint UNIQUE(user_id, feature) confirmada -- o bloco abaixo faz um DELETE prévio
-- por segurança (idempotente: rodar de novo nao duplica grant nem falha).

BEGIN;

DELETE FROM user_feature_access
WHERE feature = 'bolsa_compliance_dashboard'
  AND user_id IN (
    'd0af8eaa-9f3c-4e7a-b8c6-613736524317',
    '75c6cac4-8d30-436e-b9a6-d5d494d7470b',
    'd5f26efd-8ed5-4d90-b3f4-9ce0004803c5',
    'e8c28170-f583-4f84-a654-869508f3ad1d',
    '82171bc1-edbd-40f8-936b-1b26d412a121'
  );

INSERT INTO user_feature_access (user_id, feature, access_level, vertical_filter)
VALUES
  ('d0af8eaa-9f3c-4e7a-b8c6-613736524317', 'bolsa_compliance_dashboard', 'full', NULL), -- João Lemos Netto
  ('75c6cac4-8d30-436e-b9a6-d5d494d7470b', 'bolsa_compliance_dashboard', 'full', NULL), -- Hamilton Santos (suporte@)
  ('d5f26efd-8ed5-4d90-b3f4-9ce0004803c5', 'bolsa_compliance_dashboard', 'full', NULL), -- Robson Lino (login real)
  ('e8c28170-f583-4f84-a654-869508f3ad1d', 'bolsa_compliance_dashboard', 'full', NULL), -- Taisa Pedroso
  ('82171bc1-edbd-40f8-936b-1b26d412a121', 'bolsa_compliance_dashboard', 'full', NULL); -- Dr. Luis Athaydes

COMMIT;

-- Verificação pós-aplicação (rodar manualmente após o INSERT acima, não faz parte da
-- migration): deve retornar exatamente 5 linhas.
-- SELECT p.email, p.role, ufa.feature, ufa.access_level
-- FROM user_feature_access ufa JOIN profiles p ON p.id = ufa.user_id
-- WHERE ufa.feature = 'bolsa_compliance_dashboard';

-- Rollback:
-- DELETE FROM user_feature_access WHERE feature = 'bolsa_compliance_dashboard';
