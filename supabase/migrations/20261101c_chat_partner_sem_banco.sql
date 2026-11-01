-- Política de sigilo (01/11/2026), Bloco C: o partner não acessa chat_messages direto.
-- BRIEF: 2026-11-01_Operacional_BRIEF-Seguranca-Funcoes-Abertas-Escritas-Abertas-e-Chat-do-Partner_v1.html (QA liberado na rodada 2).
-- ORDEM OBRIGATÓRIA: o código deste PR (partner atualiza o chat pela API a cada 8 s, sem canal do banco) entra em
-- produção ANTES desta migration; sem isso, a tela do partner deixa de receber mensagem nova até o intervalo.
-- Toda leitura e escrita do chat passa pelas rotas /api/chat/* com chave de serviço; sobra uma política de leitura
-- para a equipe, necessária ao canal Realtime da tela da Mesa. Nenhuma política de insert, update ou delete.
-- Condições do go: resposta escrita do Robson, ensaio por perfil, SQL mostrado e go do João.
-- Rollback: 20261101c_chat_partner_sem_banco_rollback.sql.txt

drop policy if exists "chat leitura mesa ou propria sala" on public.chat_messages;
drop policy if exists "chat escrita mesa ou propria sala" on public.chat_messages;
drop policy if exists "users_own_room" on public.chat_messages;

create policy "chat_messages_leitura_equipe" on public.chat_messages for select to authenticated
  using ((get_user_role())::text = any (array['ADMIN', 'GESTAO', 'MESA_OPERACIONAL']));
