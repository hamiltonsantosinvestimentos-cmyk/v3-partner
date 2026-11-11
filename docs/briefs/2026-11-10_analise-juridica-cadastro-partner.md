# BRIEF: Botão "Análise jurídica" no cadastro de partner (CheckTudo, PJ + PF ou só PF)

> Data: 2026-11-10 | Autor: Claude Code (pedido do Hamilton) | Status: GO MESMO ASSIM (Hamilton, 10/11/2026), migration aguardando segundo go
> Pedido literal (10/11/2026): "no cadastro de partner, colocar um botao de analise juridica, onde deve analisar a PJ E PF, ou somente PF, pelo checktudo".

## SCOPE
No modal do cadastro em `/admin-cadastros`, um botão **"Análise jurídica"** consulta o **Dossiê Jurídico Resumido do CheckTudo** (querycode 200, a mesma integração da análise de crédito, `lib/credit-checktudo-juridico.ts`):
- cadastro **PJ**: o ADMIN escolhe **"PJ + PF"** (CNPJ da empresa e CPF do representante) ou **"Somente PF"** (só o CPF do representante);
- cadastro **PF**: só o CPF.

O resultado (total de processos, quantidade e valor como réu, quantidade e valor como autor, por documento) aparece no próprio modal e fica guardado com data, hora e quem consultou. A consulta é sob demanda, nunca automática, porque cada consulta é cobrada pelo CheckTudo. É informação de apoio à decisão de aprovar: não aprova, não reprova e não muda o status do cadastro.

## IMPACT
- Arquivos afetados:
  - `app/api/admin/cadastros/analise-juridica/route.ts` (novo):
    - `GET ?registration_id=` devolve o histórico de consultas do cadastro;
    - `POST { registration_id, escopo: "PJ_PF" | "PF" }` consulta e grava;
    - só ADMIN, padrão da rota `app/api/admin/cadastros/documento` (perfil lido com a service role no servidor; outros papéis recebem 404 genérico; anônimo 401);
  - `lib/analise-juridica-cadastro.ts` (novo): funções puras:
    - `documentosDoEscopo(cadastro, escopo)`: quais documentos consultar, normalizados e validados (ver DOCUMENTOS em DESENHO TÉCNICO);
    - `resumoJuridico(data)`: texto e números para a tela;
    - `mascararDocumento`: CPF `***.456.789-**`; CNPJ com `mascaraCnpj` (formato completo, letras em maiúsculas; dado de empresa, não mascarado);
  - `components/admin-cadastros/analise-juridica-cadastro.tsx` (novo): card com o botão, a escolha do escopo, o modal de confirmação e o resultado;
  - `components/admin-cadastros/admin-cadastros-client.tsx`: inclui o card no modal do cadastro, abaixo dos documentos;
  - `supabase/migrations/20261110_partner_registration_juridico.sql` (nova);
  - `tests/unit/analise-juridica-cadastro.test.ts` (novo).
- Tabelas afetadas:
  - **nova** `public.partner_registration_juridico` (histórico das consultas);
  - `partner_registrations`: só leitura (tipo_pessoa, cpf, cnpj, nome_completo, razao_social).
- Rotas afetadas: as duas novas acima. Nenhuma rota existente muda.
- APIs e integrações: CheckTudo (`checktudoLogin` + `checktudoDossieResumido`, querycode 200), com as credenciais `CHECKTUDO_USERNAME` / `CHECKTUDO_PASSWORD` que a análise de crédito já usa.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso (ADMIN): `/admin-cadastros` → clicar no cadastro → modal do cadastro → card **"Análise jurídica (CheckTudo)"**, logo abaixo de "Documentos". Aparece em qualquer status (pendente, em análise, aprovado, reprovado), porque serve para decidir a aprovação.
- Cadastro PJ: dois botões de escolha, "PJ + PF" (padrão) e "Somente PF", e o botão **"Consultar"**.
- Cadastro PF: só o botão "Consultar CPF".
- **Modal V3 vermelho de confirmação** (`confirmar()` com `perigo`; fecha só pelos botões; nunca ao clicar fora; não usa `window.confirm()`), porque a consulta é cobrada e fica registrada:
  - título: "Consultar processos no CheckTudo";
  - botão: "Consultar";
  - texto: "Cada documento é uma consulta cobrada pelo CheckTudo e fica registrada com o seu nome. Serão consultados: CNPJ {completo, mascaraCnpj} ({razão social}) e CPF {mascarado} ({nome}).". Se já houver consulta nas últimas 24 h, acrescenta "Já existe consulta deste cadastro em {data e hora}; o resultado está abaixo.";
- O botão fica travado enquanto o modal e a consulta estão em andamento, então não há consulta dobrada por clique duplo.
- Resultado, um bloco por documento:
  - "CNPJ 12.ABC.345/01DE-35" (completo, com `mascaraCnpj`) ou "CPF ***.456.789-**" (mascarado);
  - "Processos: {total}";
  - "Como réu: {qtd} · {R$ valor}";
  - "Como autor: {qtd} · {R$ valor}";
  - "Consultado em {dd/mm/aaaa hh:mm} por {nome}", com `timeZone: "America/Sao_Paulo"` explícito;
  - falha: "Não foi possível consultar: {motivo}" (sem prometer custo zero: não há confirmação do CheckTudo sobre cobrança de consulta recusada);
  - valores em BRL; campo ausente na resposta: "não informado" (nunca "null").
- Histórico: as consultas anteriores ficam listadas abaixo, da mais recente para a mais antiga (ordenação por data decrescente).
- Estado vazio: "Nenhuma análise jurídica feita para este cadastro."
- Nota do porquê (tooltip no título do card): "Consulta processos judiciais em que a pessoa ou a empresa é ré ou autora, para apoiar a decisão de aprovar o partner. Não aprova nem reprova sozinha."

## DEPENDENCIES
- Deve existir antes:
  - credenciais do CheckTudo em produção (já usadas pela análise de crédito);
  - `confirmar()` com `perigo` (PR #390, em produção).
- Migrations pendentes: `20261110_partner_registration_juridico.sql` (deste BRIEF). Ela é aplicada só com o **segundo go**, depois de mostrado o SQL.

## RISKS (nunca "nenhum")
- Custo: cada documento é uma consulta paga. Mitigação:
  - o botão nunca roda sozinho;
  - o modal diz quantas consultas serão feitas;
  - quando já existe consulta nas últimas 24 h, o modal avisa.
  Não há bloqueio de reconsulta além da trava de 5 minutos por documento, porque o ADMIN pode precisar atualizar.
- LGPD e compliance: consulta a processos judiciais (dado pessoal público, mas sensível para a reputação) de candidatos a partner, pessoa física e representante da PJ. **[VALIDAR COM ROBSON]**: ver Parecer.
- Breaking changes: não. É um card novo e uma tabela nova; nada existente muda.
- Segurança de acesso ao banco:
  - a tabela nova tem **RLS habilitado e nenhuma política** (nem para `anon` nem para `authenticated`);
  - só a service role do servidor lê e grava, pela rota que confere ADMIN;
  - nenhum grant a `anon`;
  - nenhuma view; uma função de gatilho (somente inclusão) sem SECURITY DEFINER, com `search_path` fixo e revoke de public, anon e authenticated.
- Documento consultado: o CPF e o CNPJ vêm do próprio cadastro (não são digitados na hora). Antes de consultar, os dígitos verificadores são validados; documento inválido não é consultado e não gera custo.
- Performance: cada documento faz login no CheckTudo (`AbortSignal.timeout(15000)`) e a consulta (`AbortSignal.timeout(30000)`), no código que já existe. As 1 ou 2 consultas rodam em paralelo, então o pior caso é cerca de 45 s. A rota declara `maxDuration = 60`.
- Vercel timeout (60s): sem chamada à IA. Pior caso, cerca de 45 s, abaixo do limite.
- Resposta do CheckTudo: o resumido traz totais, não a lista de processos (é o que já existe na análise de crédito). Para ver os processos, é preciso o dossiê completo (querycode 219), que não é oficial no CheckTudo e fica fora deste BRIEF.

## APPROACH
- Abordagem escolhida: reaproveitar `consultarJuridicoCheckTudo`, já em produção na análise de crédito, com uma tabela própria de histórico. Assim cada consulta paga fica registrada com autor, data e resultado, e a auditoria fica sem mexer no cadastro.
- Alternativas descartadas:
  - coluna jsonb em `partner_registrations`: perde o histórico, e cada reconsulta apagaria a anterior;
  - rodar automático ao receber o cadastro: gera custo para cadastros que nem serão analisados (a maioria fica pendente ou é spam).

## DESENHO TÉCNICO
- DOCUMENTOS (QA rodada 1, item 1.3):
  - normalização com as funções canônicas de `lib/cadastro-partner/documento.ts`: `normalizarCpf` (só dígitos) e `normalizarCnpj` (dígitos e letras, em maiúsculas). Nunca `replace(/\D/g, "")` no CNPJ. Isso cobre cadastros anteriores a 09/11/2026, gravados com máscara ou em formato misto;
  - validação com `isValidCPF` / `isValidCNPJ` (`lib/validators/cpf-cnpj.ts`), que aceitam o CNPJ alfanumérico;
  - formato enviado ao CheckTudo: o valor normalizado (CPF com 11 dígitos; CNPJ com 14 caracteres, maiúsculos, sem pontuação). É igual ao da análise de crédito para CPF e CNPJ numérico; o CNPJ alfanumérico nunca foi enviado pelo portal (a análise de crédito usa `replace(/\D/g, "")` em `lib/credit-source-config.ts`, fora deste escopo), e o comportamento do CheckTudo com ele é desconhecido: se recusar, a linha fica `ok = false` com o motivo;
  - exibição: CPF mascarado `***.456.789-**`; CNPJ completo com `mascaraCnpj` (ex.: `12.ABC.345/01DE-35`), no modal de confirmação e no resultado, igual nos dois;
  - documento inválido depois da normalização: não é consultado e não gera custo. A tela mostra "CPF do cadastro inválido: corrija o cadastro antes de consultar" (ou CNPJ);
  - cadastro PJ sem CPF do sócio (legado): a opção "PJ + PF" vira "Somente PJ" e a opção "Somente PF" fica desabilitada, com a mensagem "Este cadastro não tem CPF do representante". Sem consulta e sem custo para o CPF ausente. O escopo `PJ` entra no `check` da tabela;
  - CNPJ alfanumérico recusado pelo CheckTudo: a linha é gravada com `ok = false` e o motivo devolvido, e a tela mostra "Não foi possível consultar: {motivo}".
- Migration `supabase/migrations/20261110_partner_registration_juridico.sql`:
```sql
create table if not exists public.partner_registration_juridico (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.partner_registrations(id) on delete restrict,
  doc_tipo text not null check (doc_tipo in ('cpf', 'cnpj')),
  doc_mascarado text not null,
  escopo text not null check (escopo in ('PJ_PF', 'PF', 'PJ')),
  ok boolean not null,
  resultado jsonb,
  erro text,
  consultado_por uuid references public.profiles(id),
  consultado_por_nome text,
  consultado_em timestamptz not null default now()
);
-- Histórico de consulta paga: não se apaga junto com o cadastro (sem cascade) e não se altera.
create index if not exists partner_registration_juridico_reg_idx
  on public.partner_registration_juridico (registration_id, consultado_em desc);
alter table public.partner_registration_juridico enable row level security;
revoke all on public.partner_registration_juridico from anon, authenticated;
create or replace function public.partner_registration_juridico_somente_inclusao()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'partner_registration_juridico é somente inclusão (histórico de consultas pagas)';
end $$;
revoke all on function public.partner_registration_juridico_somente_inclusao() from public, anon, authenticated;
drop trigger if exists partner_registration_juridico_somente_inclusao on public.partner_registration_juridico;
create trigger partner_registration_juridico_somente_inclusao
  before update or delete on public.partner_registration_juridico
  for each row execute function public.partner_registration_juridico_somente_inclusao();
drop trigger if exists partner_registration_juridico_sem_truncate on public.partner_registration_juridico;
create trigger partner_registration_juridico_sem_truncate
  before truncate on public.partner_registration_juridico
  for each statement execute function public.partner_registration_juridico_somente_inclusao();
comment on table public.partner_registration_juridico is
  'Histórico das análises jurídicas (CheckTudo, querycode 200) dos cadastros de partner. Só a service role acessa (rota ADMIN). BRIEF 2026-11-10_analise-juridica-cadastro-partner.';
```
- Reversão: `drop table if exists public.partner_registration_juridico; drop function if exists public.partner_registration_juridico_somente_inclusao();` (arquivo `supabase/migrations/20261110_partner_registration_juridico_rollback.sql.txt`, no padrão do repositório).
- `on delete restrict`: um cadastro com consulta jurídica não pode ser apagado do banco sem antes tratar o histórico. Hoje o fluxo não apaga cadastros, só muda o status, então nada muda na operação.
- Minimização (QA rodada 1, item 3.1): o documento completo **não** é gravado, só a forma mascarada (`doc_mascarado`). O `resultado` guarda **só os 5 totais** (`total_processos`, `reu_quantidade`, `reu_valor`, `autor_quantidade`, `autor_valor`) e `consultado_em`. O `dossie_bruto` do CheckTudo **não é gravado** nem devolvido ao navegador. Para ver o detalhe, é preciso uma nova consulta (paga).
- A rota POST:
  1. confere ADMIN;
  2. lê o cadastro;
  3. `documentosDoEscopo` (PF: CPF; PJ + PJ_PF: CNPJ e CPF; PJ + PF: CPF; PJ + PJ_PF sem CPF do sócio: só CNPJ, gravado com escopo `PJ`);
  4. valida os dígitos;
  5. consulta em paralelo;
  6. grava uma linha por documento, com sucesso ou falha;
  7. devolve as linhas.
  O registro em `audit_logs` (ação `cadastro_analise_juridica`, com registration_id, escopo e documentos mascarados) é gravado com `await` **antes** da consulta paga; se a gravação falhar, a rota aborta sem consultar (padrão da rota `documento`).
- Trava contra consulta dobrada: a checagem lê o `audit_logs` (gravado **antes** da consulta, ação `cadastro_analise_juridica`), não a tabela de resultados, para pegar também duas abas simultâneas. Se houver registro do mesmo documento no mesmo cadastro nos últimos 5 minutos, a rota devolve 409 "Consulta deste documento feita há menos de 5 minutos; aguarde o resultado na tela" sem consultar. Isso protege contra o modal aberto em duas abas.
- `export const maxDuration = 60` na rota.
- Sem mudança no `partner_registrations`.

## PLANO DE TESTE
- Unitário:
  - `documentosDoEscopo`: PF → só CPF; PJ + PJ_PF → CNPJ e CPF; PJ + PF → só CPF; CPF com dígito errado → recusado sem consulta; CNPJ alfanumérico válido aceito;
  - `resumoJuridico`: valores em BRL, campo ausente → "não informado", nunca "null";
  - `mascararDocumento`: CPF `***.456.789-**`; CNPJ alfanumérico em minúsculas sai em maiúsculas com `mascaraCnpj`;
  - CNPJ legado com máscara (`12.345.678/0001-95`) é normalizado e validado; CNPJ alfanumérico em minúsculas é normalizado para maiúsculas e aceito;
  - cadastro PJ sem CPF do sócio: escopo "PF" recusado com "não tem CPF do representante"; "PJ_PF" vira só CNPJ (escopo "PJ").
- Prova de acesso ANTES de aplicar (QA rodada 1, item 6.8), em transação desfeita (`begin; ... rollback;`) no banco de produção, mostrada junto do SQL no pedido do segundo go:
  - cria a tabela, insere uma linha de teste como service role;
  - `set local role anon;` → `select` e `insert` negados;
  - `set local role authenticated;` com `request.jwt.claims` de um perfil PARTNER comum → `select` e `insert` negados;
  - `set local role authenticated;` com `request.jwt.claims` do perfil ADMIN → `select` e `insert` negados (acesso só pela service role da rota);
  - `set local role service_role;` → `select` devolve a linha; `update`, `delete` e `truncate` falham pelos gatilhos de somente inclusão;
  - `rollback;`.
- Produção (ADMIN), depois do segundo go e da migration:
  - consultar "Somente PF" num cadastro interno de teste (1 consulta);
  - conferir o bloco e o histórico;
  - conferir que um usuário não ADMIN recebe 404 na rota;
  - conferir no banco que `anon` não lê a tabela.
- O que não é testável antes: a cobrança real no CheckTudo.

## ESTIMATE
M, cerca de 3 h, confiança alta (a integração já existe).

## PARECER DE COMPLIANCE
**[VALIDAR COM ROBSON]**: bloqueia até a resposta, ou até um "go mesmo assim" do João ou do Hamilton com este item aceito. Pergunta ao Robson:
- Podemos consultar, no CheckTudo, os processos judiciais do candidato a partner (CPF da pessoa física e, no PJ, CNPJ da empresa e CPF do representante) antes de aprovar o cadastro, e guardar o resultado (totais) com o nome de quem consultou?
- A base legal seria o legítimo interesse e os procedimentos preliminares de contrato (LGPD, art. 7º, IX e V), para a diligência da contraparte.
- É preciso avisar o candidato no formulário de cadastro, por exemplo com a frase "podemos consultar processos judiciais em seu nome e da empresa para avaliar o cadastro"?
- Retenção: guardamos só os 5 totais (sem a lista de processos nem o dossiê bruto), sem prazo de exclusão, como histórico da diligência. Está adequado ou precisa de prazo?
- Data, quem respondeu e texto da resposta: (pendente).

---

## RELATÓRIO DO QA DE GOVERNANÇA
### Rodada 2 de 6: BLOQUEADO (1 falha)
- Única falha: compliance `[VALIDAR COM ROBSON]`, sem resposta. As falhas 1.3, 3.1 e 6.8 da rodada 1 foram dadas como resolvidas.
- Sugestões acolhidas: contradições de RISKS (função de gatilho e trava de 5 min) corrigidas; escopo `PJ` no passo 3; frase do formato enviado ao CheckTudo corrigida; prova de acesso com `set local role service_role`; gatilho de `truncate`; trava de 5 min baseada no `audit_logs`.

### Rodada 1 de 6: BLOQUEADO (4 falhas)
1. 1.3 Normalização e formato de CPF/CNPJ. **Corrigido**: funções canônicas, formato enviado, máscara do CNPJ alfanumérico, PJ legado sem CPF do sócio, recusa do CheckTudo, testes.
2. 3.1 `dossie_bruto` com dado pessoal. **Corrigido**: só os 5 totais são gravados; o bloco bruto não é gravado nem devolvido.
3. 6.8 Prova de acesso antes do go. **Corrigido**: plano em transação desfeita com anon, authenticated (PARTNER e ADMIN) e service role, mostrado no pedido do segundo go.
4. Compliance `[VALIDAR COM ROBSON]`: pendente; pergunta ampliada com a retenção.
- Sugestões acolhidas: timeout real (cerca de 45 s) e `maxDuration = 60`; texto de falha sem prometer custo zero; `audit_logs` com `await` antes da consulta; trava de 5 minutos por documento; nome do rollback `.sql.txt`; gatilho de somente inclusão e `on delete restrict`; fuso explícito; CNPJ igual no modal e no resultado.
- Fora do escopo, registrado: o CPF completo já aparece sem máscara em "Dados Cadastrais" (`admin-cadastros-client.tsx`, linha 216). Fica para um BRIEF próprio.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 2). Única falha: [VALIDAR COM ROBSON], coberta pelo override abaixo.
- Override: sim, "go mesmo assim" do Hamilton em 10/11/2026, aceitando **só** o item de compliance (base legal da consulta, aviso ao candidato no formulário e retenção dos totais). As perguntas seguem abertas para o Robson; se ele pedir o aviso no formulário, entra em BRIEF próprio; se negar a base legal, o card é desligado.
- Go dado por: Hamilton, 10/11/2026 ("go mesmo assim", registrado pelo hook)
- Prova de acesso (item 6.8), rodada pelo Hamilton no SQL Editor de produção em 10/11/2026, transação desfeita: "anon select: negado | anon insert: negado | partner select: negado | partner insert: negado | admin (PostgREST) select: negado | admin (PostgREST) insert: negado | service_role select: 1 linha(s) | service_role update: bloqueado | service_role delete: bloqueado | service_role truncate: bloqueado". Conferido depois pelo PostgREST: a tabela não ficou criada (PGRST205).
- Migration aplicada em produção: não (exige segundo go)
