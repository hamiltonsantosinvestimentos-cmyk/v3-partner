-- Bloco E (BRIEF Mesa M&A 28/10/2026, seção 8; "go" do João em 29/10/2026):
-- colunas da Mesa M&A alinhadas à Esteira de Originação. Duas fases novas no enum
-- deal_stage. Nenhum deal muda de fase: IOI e PROPOSAL só ganham rótulo novo no
-- código (lib/ma/pipeline.ts). A ordem do enum não é usada em comparação (conferido:
-- nenhuma função ou policy compara stage com < ou >); a ordem das colunas vem do código.
--
-- Rollback: Postgres não remove valor de enum. Com 0 linhas usando MANDATE/ROADSHOW,
-- o valor sobra sem efeito; remover exige recriar o tipo (ver _rollback.sql.txt).

alter type public.deal_stage add value if not exists 'MANDATE'  after 'QUALIFICATION';
alter type public.deal_stage add value if not exists 'ROADSHOW' after 'MANDATE';
