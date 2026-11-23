-- BRIEF docs/briefs/2026-11-21_consorcio-projetos-ofertas-vazamento.md, item 8 (go mesmo assim do Hamilton, 23/11/2026).
-- A política "authenticated_insert_oferta" deixava qualquer login inserir oferta direto pela REST
-- (chave anon + JWT), em nome de qualquer created_by e sem a checagem de carta da rota.
-- O app só grava ofertas pela rota app/api/consorcio/ofertas (service role, que ignora RLS).
-- Sem política de INSERT, nenhum login insere pela REST, nem ADMIN, GESTAO ou MESA_OPERACIONAL.
-- SELECT, UPDATE, GRANT e colunas não mudam.
drop policy if exists "authenticated_insert_oferta" on public.consorcio_ofertas;
