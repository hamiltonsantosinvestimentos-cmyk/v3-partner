-- BRIEF docs/briefs/2026-11-23_enterprise-identidade-fase1-chat-operacoes-simuladores.md (go do Hamilton 23/11/2026).
-- Identidade jurídica do Enterprise no perfil do master: razão social e CNPJ que saem nos PDFs e simulações.
-- Colunas nullable, sem policy, GRANT, view ou função persistente nova.
-- Leitura segue profiles_select_own / profiles_select_admin; escrita direta já barrada pelo trigger
-- profiles_trava_colunas_sensiveis (lista fechada): só ADMIN e service role (rota POST /api/enterprise/marca).

alter table public.profiles add column if not exists white_label_razao_social text;
alter table public.profiles add column if not exists white_label_cnpj text;

comment on column public.profiles.white_label_razao_social is 'Razão social do Enterprise (só no master), usada em PDFs e simulações da equipe.';
comment on column public.profiles.white_label_cnpj is 'CNPJ do Enterprise (só no master), 14 caracteres sem pontuação, maiúsculo (aceita alfanumérico).';

-- Validação do dígito do CNPJ, mesma regra de isValidCNPJ (lib/validators/cpf-cnpj.ts):
-- valor de cada caractere = ASCII - 48, módulo 11. Função em pg_temp: só existe nesta sessão.
create or replace function pg_temp.cnpj_valido(p text) returns boolean language plpgsql immutable as $$
declare
  c text := upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g'));
  v int[];
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; d1 int; d2 int; i int;
begin
  if length(c) <> 14 then return false; end if;
  if c ~ '^(.)\1{13}$' then return false; end if;
  if substr(c, 13, 2) !~ '^[0-9]{2}$' then return false; end if;
  v := array(select ascii(substr(c, g, 1)) - 48 from generate_series(1, 14) g);
  s := 0; for i in 1..12 loop s := s + v[i] * w1[i]; end loop;
  r := s % 11; d1 := case when r < 2 then 0 else 11 - r end;
  if d1 <> v[13] then return false; end if;
  s := 0; for i in 1..13 loop s := s + v[i] * w2[i]; end loop;
  r := s % 11; d2 := case when r < 2 then 0 else 11 - r end;
  return d2 = v[14];
end $$;

-- Preenchimento inicial dos masters a partir do cadastro aprovado mais recente com o mesmo e-mail.
with cad as (
  select distinct on (lower(pr.email))
         lower(pr.email) as email,
         nullif(left(regexp_replace(trim(coalesce(pr.razao_social, '')), '\s+', ' ', 'g'), 200), '') as razao,
         upper(regexp_replace(coalesce(pr.cnpj, ''), '[^0-9A-Za-z]', '', 'g')) as cnpj
  from public.partner_registrations pr
  where pr.status = 'APROVADO' and pr.plano = 'ENTERPRISE' and pr.email is not null
  order by lower(pr.email), pr.created_at desc
)
update public.profiles p
set white_label_razao_social = coalesce(p.white_label_razao_social, cad.razao),
    white_label_cnpj = coalesce(p.white_label_cnpj, case when pg_temp.cnpj_valido(cad.cnpj) then cad.cnpj end)
from cad
where p.role = 'ENTERPRISE' and p.enterprise_id is null and lower(p.email) = cad.email;
