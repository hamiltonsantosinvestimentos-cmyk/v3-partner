-- Contenção de segurança, camada 2C (30/10/2026). Pré-requisito do bloco C (BRIEF
-- 2026-10-30_Operacional_BRIEF-Mesa-MA-Transferir-Esteira-Cliente360).
-- Defeito: v3_clients (base do Cliente 360: CPF/CNPJ e razão social, 200 registros) tinha a
-- política v3_clients_select_authenticated com USING (true), então qualquer usuário logado
-- (partner Gold, Pro, Diamante e outros) lia a base inteira.
-- Correção: remover a política (sem política de leitura para authenticated, a RLS nega) e retirar
-- o privilégio de tabela do papel anon. A política v3_clients_all_service_role permanece.
-- Evidência no código (30/10/2026): todos os pontos que tocam a tabela usam chave de serviço.
-- Rotas /api/clientes/[documento] e /reveal, /api/cm/kyc/check, /api/cm/qualifications/party/[id]/
-- cliente-360, o helper lib/v3-clients.ts e as chamadas que passam db próprio (rotas de
-- qualificação por token, /api/ma/deals/[deal_id]/clientes e [id], proposta-automatica via
-- webhook e cron da Cora) recebem o cliente com SUPABASE_SERVICE_ROLE_KEY. Os select embutidos
-- de v3_clients em ma_deal_clients também usam svc().
-- Rollback: ver 20261030f_v3_clients_leitura_somente_servico_rollback.sql.txt

drop policy if exists "v3_clients_select_authenticated" on public.v3_clients;

revoke all on public.v3_clients from anon;
