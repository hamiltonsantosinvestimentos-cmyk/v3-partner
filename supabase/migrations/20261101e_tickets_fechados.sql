-- Política de sigilo (01/11/2026), tickets operacionais: leitura e escrita direta de usuário logado fechadas.
-- BRIEF: 2026-11-01_Operacional_BRIEF-Seguranca-Tickets-Operacionais-Leitura-e-Escrita-Abertas_v1.html (QA liberado na rodada 2).
-- ORDEM OBRIGATÓRIA: o código deste PR (página /mesa-operacional e POST de /api/tickets com chave de serviço, comentários
-- com checagem de dono) entra em produção ANTES desta migration; sem isso, a página e a criação de ticket quebram assim
-- que as políticas caírem (e o count de code, pela sessão, voltaria 0 e repetiria TICK-26-0001).
-- Fica tickets_delete_admin (só ADMIN). ticket_comments já tem RLS ligada e nenhuma política (fechada ao usuário comum).
-- Defesa em profundidade: o anônimo perde todos os privilégios nas duas tabelas (hoje tem até TRUNCATE).
-- Condições do go: código em produção e verificado, ensaio por perfil, SQL mostrado e go do João.
-- Rollback: 20261101e_tickets_fechados_rollback.sql.txt

drop policy if exists "tickets_select" on public.operational_tickets;
drop policy if exists "tickets_insert" on public.operational_tickets;
drop policy if exists "tickets_update" on public.operational_tickets;

revoke all on public.operational_tickets, public.ticket_comments from anon;
