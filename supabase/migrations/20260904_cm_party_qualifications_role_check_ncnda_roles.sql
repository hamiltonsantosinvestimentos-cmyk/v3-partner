-- ============================================================
-- MIGRATION: cm_party_qualifications_role_in_document_check
-- Date: 2026-09-04
-- Scope: o CHECK constraint de role_in_document ficou desatualizado em
--        relacao a lib/qualification-roles.ts (ROLE_LABELS), que ja tinha
--        os 7 papeis novos do NCNDA Mestre desde 03/09/2026 (estruturador,
--        head_mesa, partner, mandatario_1/2, intermediario_1/2). O dropdown
--        e a validacao de app/api/cm/qualifications/route.ts ja aceitavam
--        esses valores (derivados de ROLE_LABELS), mas o INSERT real
--        quebrava com violacao de CHECK constraint -- achado ao vivo por
--        Joao gerando um link de Qualificacao Antecipada real.
-- Rollback:
--   (reverte para a lista de 20260813_qualificacoes_pf_pj_fpa.sql)
--   do $$
--   declare con record;
--   begin
--     for con in
--       select conname from pg_constraint
--       where conrelid = 'public.cm_party_qualifications'::regclass
--         and contype = 'c'
--         and pg_get_constraintdef(oid) ilike '%role_in_document%'
--     loop
--       execute format('alter table public.cm_party_qualifications drop constraint %I', con.conname);
--     end loop;
--   end $$;
--   alter table public.cm_party_qualifications
--     add constraint cm_party_qualifications_role_in_document_check check (role_in_document in (
--       'parte_principal', 'intermediario_finder_venda', 'intermediario_finder_compra', 'mandatario', 'testemunha',
--       'finder_originacao_venda', 'finder_originacao_compra', 'intermediario_venda', 'intermediario_compra'
--     ));
-- ============================================================

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.cm_party_qualifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role_in_document%'
  loop
    execute format('alter table public.cm_party_qualifications drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.cm_party_qualifications
  add constraint cm_party_qualifications_role_in_document_check check (role_in_document in (
    'parte_principal', 'intermediario_finder_venda', 'intermediario_finder_compra', 'mandatario', 'testemunha', -- valores originais (28/07)
    'finder_originacao_venda', 'finder_originacao_compra', 'intermediario_venda', 'intermediario_compra', -- 13/08
    'estruturador', 'head_mesa', 'partner', 'mandatario_1', 'mandatario_2', 'intermediario_1', 'intermediario_2' -- NCNDA Mestre, 03/09
  ));
