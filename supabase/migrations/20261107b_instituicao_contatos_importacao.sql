-- Complemento da 20261107a (BRIEF encaminhar proposta para instituição): a 20261107a foi aplicada
-- na versão que importava só contato_email "limpo". Esta importa os que faltaram: campo com mais de
-- um e-mail ("a@x.com.br/  b@x.com.br") ou com texto junto ("a@x.com.br nome"). Separa por espaço,
-- ; , / | e importa só o que é e-mail. Não cria tabela nem muda permissão. Pode rodar mais de uma
-- vez: e-mail já cadastrado na instituição é ignorado (índice único). Só marca principal quando a
-- instituição ainda não tem nenhum contato.

begin;

insert into public.instituicao_contatos (instituicao_id, nome, email, principal)
select v.instituicao_id,
       case when v.n = 1 and not v.tem_contato then v.contato_nome end,
       v.email,
       v.n = 1 and not v.tem_contato
from (
  select i.id as instituicao_id, nullif(trim(i.contato_nome), '') as contato_nome, lower(t.tok) as email,
         row_number() over (partition by i.id order by t.ord) as n,
         exists (select 1 from public.instituicao_contatos c where c.instituicao_id = i.id) as tem_contato
  from public.instituicoes i
  cross join lateral regexp_split_to_table(coalesce(i.contato_email, ''), '[\s;,/|]+') with ordinality as t(tok, ord)
  where t.tok ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
) v
on conflict do nothing;

commit;

-- Conferência (rodar depois, opcional):
-- select i.nome, count(c.id) as contatos, count(c.id) filter (where c.principal) as principal
-- from public.instituicoes i left join public.instituicao_contatos c on c.instituicao_id = i.id and c.ativo
-- group by i.nome order by i.nome;
