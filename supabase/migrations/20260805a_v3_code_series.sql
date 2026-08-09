-- =============================================================================
-- GOVERNANCA DE NUMERACAO V3 PARTNERS, FASE 1a
-- Emissor unico de codigos de operacao e contrato
-- =============================================================================
--
-- CONTEXTO
--   Em 31/07/2026 o cadastro por link de captacao quebrou 100% das submissoes
--   com "duplicate key value violates unique constraint" em crm_leads.code.
--   Em 05/08/2026 o mesmo defeito derrubou o cadastro de deal do partner
--   Jean Paulo Machado dos Santos, agora em ma_deals.code (MA-26-030 ja existia).
--
--   Causa raiz identica nos dois casos: o codigo era calculado por COUNT(*)+1,
--   que colide assim que existe qualquer vao na numeracao. A correcao de 31/07
--   foi aplicada em um unico arquivo e nunca virou padrao. Uma varredura do
--   repositorio encontrou 12 pontos emitindo codigo, com 4 algoritmos
--   diferentes, e apenas 1 correto.
--
-- O QUE ESTA MIGRATION FAZ
--   Move a autoridade sobre o codigo para o banco. A partir daqui o codigo
--   deixa de ser responsabilidade de quem escreve a rota: qualquer caminho de
--   insercao obtem o codigo certo chamando next_v3_code(), e o emissor e
--   atomico por construcao.
--
-- SEGURANCA EM PRODUCAO
--   Esta migration e 100% ADITIVA. Ela apenas cria objetos novos:
--     - 2 tabelas novas (v3_code_series, v3_code_counters)
--     - 1 funcao nova (next_v3_code)
--   Nenhum ALTER, nenhum DROP, nenhum UPDATE em tabela existente.
--   Nenhum codigo de aplicacao chama a funcao ainda, entao o comportamento
--   do sistema em producao permanece exatamente o mesmo apos aplicar.
--   E idempotente: pode ser executada mais de uma vez sem efeito colateral.
--
-- ROLLBACK
--   Ver 20260805a_v3_code_series_rollback.sql
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. REGISTRO DE SERIES
--    A tabela de nomenclatura V3 deixa de viver apenas em documento e passa a
--    ser dado que o sistema consulta. Alterar o padrao passa a ser migration,
--    nao decisao individual de quem esta codando uma rota nova.
-- -----------------------------------------------------------------------------

create table if not exists public.v3_code_series (
  id              text        primary key,
  label           text        not null,
  prefix          text        not null,
  -- segment_class define o segmento classificatorio do codigo:
  --   'setor'  lido de deal_sector_codes (M&A, credito, bolsa de ativos)
  --   'esfera' FED/EST/MUN (precatorio: a esfera classifica o ativo, nao o setor)
  --   'none'   serie sem segmento classificatorio (consorcio, contratos)
  segment_class   text        not null default 'setor',
  -- scope_grain define de que em que o sequencial reinicia:
  --   'ano_mes' reinicia todo mes (padrao das operacoes)
  --   'ano'     reinicia todo ano (contratos)
  scope_grain     text        not null default 'ano_mes',
  seq_width       smallint    not null default 3,
  -- tabela e coluna onde o codigo sera gravado. Quando preenchidos, o emissor
  -- confere que o codigo gerado ainda nao existe antes de devolve-lo.
  target_table    text,
  target_column   text,
  active          boolean     not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint v3_code_series_segment_class_check
    check (segment_class in ('setor', 'esfera', 'none')),
  constraint v3_code_series_scope_grain_check
    check (scope_grain in ('ano', 'ano_mes')),
  constraint v3_code_series_seq_width_check
    check (seq_width between 2 and 6)
);

comment on table public.v3_code_series is
  'Registro vivo da tabela de nomenclatura V3. Fonte unica do padrao de codigo de operacao e contrato. Ver SOP de Governanca de Numeracao em 06_Operacional/SOPs.';
comment on column public.v3_code_series.segment_class is
  'setor lido de deal_sector_codes, esfera FED/EST/MUN para precatorio, none para series sem segmento classificatorio.';
comment on column public.v3_code_series.scope_grain is
  'Granularidade em que o sequencial reinicia: ano_mes para operacoes, ano para contratos.';


-- -----------------------------------------------------------------------------
-- 2. CONTADORES
--    Chave composta (serie, escopo). O escopo carrega periodo e classe, entao
--    V3-MA-2026-08-SAU-001 e V3-MA-2026-08-REA-001 sao sequencias independentes,
--    exatamente como ja funciona o v3_code atual dos 24 deals emitidos.
--
--    Por que tabela de contador e nao SEQUENCE do Postgres: sequence e global e
--    nao reinicia por mes nem por setor. O padrao V3 ja emitido exige reinicio,
--    entao a sequence produziria numeracao diferente da que ja esta em producao.
--    A atomicidade e preservada pelo INSERT ... ON CONFLICT DO UPDATE RETURNING,
--    que resolve o conflito dentro da propria linha, sob lock de linha.
-- -----------------------------------------------------------------------------

create table if not exists public.v3_code_counters (
  series_id   text        not null references public.v3_code_series(id) on delete restrict,
  scope_key   text        not null,
  last_seq    integer     not null default 0,
  updated_at  timestamptz not null default now(),

  primary key (series_id, scope_key),
  constraint v3_code_counters_last_seq_check check (last_seq >= 0)
);

comment on table public.v3_code_counters is
  'Contador atomico por serie e escopo. Nunca editar manualmente: o valor aqui e a garantia de que dois cadastros simultaneos nao recebem o mesmo codigo.';


-- -----------------------------------------------------------------------------
-- 3. EMISSOR
--    Unico ponto autorizado a produzir codigo de operacao ou contrato.
--
--    Principio de desenho: o codigo so carrega atributo IMUTAVEL.
--    Por isso o nivel da proposta de credito (NIVEL_1/2/3) nao entra no codigo,
--    embora seja tentador: proposta sobe de nivel ao longo da esteira, e codigo
--    emitido nao pode mudar depois que ja saiu em contrato, pasta e VDR.
--    Setor, esfera e modalidade internacional nao mudam. Nivel muda.
-- -----------------------------------------------------------------------------

create or replace function public.next_v3_code(
  p_series text,
  p_class  text        default null,
  p_at     timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series   public.v3_code_series%rowtype;
  v_period   text;
  v_scope    text;
  v_seq      integer;
  v_code     text;
  v_exists   boolean;
  v_tries    integer := 0;
begin
  select * into v_series
    from public.v3_code_series
   where id = p_series and active;

  if not found then
    raise exception 'Serie de codigo desconhecida ou inativa: %', p_series
      using hint = 'Consulte public.v3_code_series para as series validas.';
  end if;

  -- Periodo sempre em horario de Brasilia. Sem isso, um cadastro feito as 21h
  -- de 31/08 receberia codigo de setembro, porque o servidor roda em UTC.
  if v_series.scope_grain = 'ano' then
    v_period := to_char(p_at at time zone 'America/Sao_Paulo', 'YYYY');
  else
    v_period := to_char(p_at at time zone 'America/Sao_Paulo', 'YYYY-MM');
  end if;

  -- Validacao do segmento classificatorio.
  -- O codigo nunca afirma o que o dado nao sustenta: e por isso que a serie de
  -- precatorio recusa emitir sem esfera, em vez de carimbar FED como o sistema
  -- antigo fazia nos 38 ativos cuja esfera esta nula.
  if v_series.segment_class = 'setor' then
    if p_class is null then
      raise exception 'Serie % exige setor', p_series;
    end if;
    if not exists (
      select 1 from public.deal_sector_codes where code = p_class and active
    ) then
      raise exception 'Setor % nao existe no dicionario deal_sector_codes', p_class
        using hint = 'Cadastre o setor em deal_sector_codes antes de emitir o codigo.';
    end if;

  elsif v_series.segment_class = 'esfera' then
    if p_class is null or p_class not in ('FED', 'EST', 'MUN') then
      raise exception 'Serie % exige esfera FED, EST ou MUN (recebido: %)',
        p_series, coalesce(p_class, 'nulo');
    end if;

  elsif v_series.segment_class = 'none' then
    if p_class is not null then
      raise exception 'Serie % nao aceita segmento classificatorio (recebido: %)',
        p_series, p_class;
    end if;
  end if;

  v_scope := v_period || coalesce('-' || p_class, '');

  -- Loop de seguranca. O contador sozinho ja garante unicidade entre chamadas
  -- concorrentes, mas se um codigo tiver sido gravado por fora do emissor (ou
  -- importado de sistema legado), pulamos para o proximo em vez de devolver um
  -- codigo que causaria 23505 na insercao. Esse era exatamente o cenario que
  -- travou o cadastro do partner em 05/08.
  loop
    v_tries := v_tries + 1;
    if v_tries > 50 then
      raise exception 'Nao foi possivel emitir codigo livre para % apos 50 tentativas', p_series;
    end if;

    insert into public.v3_code_counters (series_id, scope_key, last_seq, updated_at)
    values (p_series, v_scope, 1, now())
    on conflict (series_id, scope_key)
    do update set last_seq   = public.v3_code_counters.last_seq + 1,
                  updated_at = now()
    returning last_seq into v_seq;

    v_code := v_series.prefix
           || '-' || v_period
           || coalesce('-' || p_class, '')
           || '-' || lpad(v_seq::text, v_series.seq_width, '0');

    if v_series.target_table is null or v_series.target_column is null then
      return v_code;
    end if;

    execute format(
      'select exists (select 1 from public.%I where %I = $1)',
      v_series.target_table, v_series.target_column
    ) into v_exists using v_code;

    exit when not v_exists;
  end loop;

  return v_code;
end;
$$;

comment on function public.next_v3_code(text, text, timestamptz) is
  'Emissor unico de codigo V3. Atomico e resiliente a vaos na numeracao. Nenhuma rota deve gerar codigo por conta propria: ver SOP de Governanca de Numeracao.';

-- Menor privilegio: apenas o service_role emite codigo. As rotas do portal ja
-- rodam server-side com service_role. Um usuario autenticado nao deve poder
-- consumir contador diretamente, porque isso abriria vaos na numeracao.
revoke all on function public.next_v3_code(text, text, timestamptz) from public;
revoke all on function public.next_v3_code(text, text, timestamptz) from authenticated;
grant execute on function public.next_v3_code(text, text, timestamptz) to service_role;


-- -----------------------------------------------------------------------------
-- 4. SEED DAS SERIES
--    Decisao de Joao Lemos em 05/08/2026: congelar o historico. Os 24 codigos
--    ja emitidos no formato V3-AAAA-MM-SET-NNN ficam intocados, porque
--    folder_registry, vdr_audit_trail e search_documents_rag ligam por string e
--    renomear quebraria o vinculo. A vertical passa a existir apenas nos novos.
-- -----------------------------------------------------------------------------

insert into public.v3_code_series
  (id, label, prefix, segment_class, scope_grain, seq_width, target_table, target_column, notes)
values
  ('MA',  'M&A e Cross-Border',      'V3-MA',  'setor',  'ano_mes', 3,
   'ma_deals', 'v3_code',
   'Sucede o formato V3-AAAA-MM-SET-NNN. Os 24 codigos anteriores permanecem validos e intocados.'),

  ('CR',  'Credito Nacional',        'V3-CR',  'setor',  'ano_mes', 3,
   'credit_desk_proposals', 'code',
   'Sucede CRED-26-NNNN. Emitido quando a linha de credito tem escopo nacional.'),

  ('CRI', 'Credito Internacional',   'V3-CRI', 'setor',  'ano_mes', 3,
   'credit_desk_proposals', 'code',
   'Modalidade do credito, nao vertical propria. O prefixo e derivado do dicionario regras_linhas_credito, nunca escolhido pelo operador. Confirmado por Joao em 05/08/2026: as 8 linhas internacionais sao op_int_garantia, op_int_cash, acc, ace, finimp, fin_exterior, cambio_pronto e cash_collateral.'),

  ('BA',  'Bolsa de Ativos',         'V3-BA',  'setor',  'ano_mes', 3,
   'cm_asset_listings', 'anonymous_id',
   'Sucede CM-OT-FED-NNNN para ativos que nao sao precatorio.'),

  ('PR',  'Precatorios',             'V3-PR',  'esfera', 'ano_mes', 3,
   'cm_asset_listings', 'anonymous_id',
   'Usa esfera no lugar de setor: em precatorio o que classifica o ativo e ser Federal, Estadual ou Municipal. Sucede CM-PR-FED-NNNN, cujo FED era fixo no codigo enquanto a coluna esfera estava nula em todos os 38 registros.'),

  ('CS',  'Consorcios',              'V3-CS',  'none',   'ano_mes', 4,
   'consorcio_cartas', 'code',
   'Sucede CARTA-26-NNN. Sem setor: carta de credito nao tem setor economico. Largura 4 porque ja sao 301 cartas emitidas.'),

  ('V3C-ORG', 'Contrato de Originacao', 'V3C-ORG', 'none', 'ano', 4,
   null, null,
   'Serie propria em vez de sufixo do codigo da operacao: contrato tem ciclo de vida proprio (aditivo, distrato, renovacao) e pode cobrir mais de uma operacao. O vinculo com a operacao e feito por coluna com constraint, nao por texto dentro do codigo.'),

  ('V3C-MAN', 'Contrato de Mandato',    'V3C-MAN', 'none', 'ano', 4, null, null, null),
  ('V3C-PAR', 'Adesao de Partner',      'V3C-PAR', 'none', 'ano', 4, null, null,
   'Unica serie de contrato que nao exige operacao de origem: a adesao do partner a rede nao nasce de operacao nenhuma.'),
  ('V3C-CES', 'Contrato de Cessao',     'V3C-CES', 'none', 'ano', 4, null, null, null),
  ('V3C-NDA', 'NDA',                    'V3C-NDA', 'none', 'ano', 4, null, null, null)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- 5. RLS
--    Leitura para usuario autenticado (a UI precisa exibir o padrao vigente).
--    Escrita apenas por service_role e migration.
-- -----------------------------------------------------------------------------

alter table public.v3_code_series   enable row level security;
alter table public.v3_code_counters enable row level security;

drop policy if exists v3_code_series_read on public.v3_code_series;
create policy v3_code_series_read
  on public.v3_code_series for select
  to authenticated
  using (true);

-- v3_code_counters nao recebe policy de leitura de propósito: e estado interno
-- do emissor. O acesso acontece dentro de next_v3_code(), que e security definer.
