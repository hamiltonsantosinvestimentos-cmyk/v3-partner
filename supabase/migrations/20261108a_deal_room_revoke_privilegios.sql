-- 20261108a: Deal Room, fechamento de privilégios (BRIEF de segurança do Deal Room, 08/11/2026)
-- Política de sigilo de 31/10/2026: externo nunca acessa o banco; só a API da V3, com chave de serviço.
--
-- Estado verificado no banco vivo em 08/11/2026 (leitura):
--   * RLS ligado nas cinco tabelas, com uma política FOR ALL por tabela (authenticated, só ADMIN e GESTAO).
--   * anon e authenticated com TODOS os privilégios (inclusive TRUNCATE, que não passa pela RLS).
--   * As políticas "user reads own nda" e "authenticated insert doc view" NÃO existem no banco vivo;
--     estão só no arquivo 20260527000001. O DROP abaixo é protetor (sem efeito hoje).
--
-- O que muda: anon e public perdem tudo; authenticated perde TRUNCATE, REFERENCES e TRIGGER e mantém
-- SELECT, INSERT, UPDATE e DELETE (presos às políticas ADMIN e GESTAO). service_role não muda.
-- Rotas públicas do convidado e intakes usam a chave de serviço; rotas internas usam sessão (authenticated).
--
-- Rollback: 20261108a_deal_room_revoke_privilegios_rollback.sql.txt

revoke all on table public.deal_rooms           from anon, public;
revoke all on table public.deal_room_invites    from anon, public;
revoke all on table public.deal_room_documents  from anon, public;
revoke all on table public.nda_signatures       from anon, public;
revoke all on table public.document_views       from anon, public;

revoke truncate, references, trigger on table public.deal_rooms           from authenticated;
revoke truncate, references, trigger on table public.deal_room_invites    from authenticated;
revoke truncate, references, trigger on table public.deal_room_documents  from authenticated;
revoke truncate, references, trigger on table public.nda_signatures       from authenticated;
revoke truncate, references, trigger on table public.document_views       from authenticated;

-- Protetor: se o arquivo 20260527000001 for reaplicado, essas políticas abertas não podem existir.
drop policy if exists "user reads own nda"              on public.nda_signatures;
drop policy if exists "authenticated insert doc view"   on public.document_views;
