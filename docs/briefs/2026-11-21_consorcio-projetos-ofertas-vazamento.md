# BRIEF: Correção de segurança. Consórcio (projetos, ofertas e cartas), metas no ranking e chave interna do Marketplace

> Data: 2026-11-21 | Autor: Claude (achado do QA de governança, rodada 2 do BRIEF `2026-11-20_aba-enterprises-admin-e-equipe-fora-das-listas.md`) | Status: EM QA, rodada 3 (pg_policies colado em 23/11; aguardando Robson/override e decisão sobre carta)

## ACHADOS (conferidos pelo QA rodada 1)
1. `GET /api/consorcio/projetos` (`route.ts:32-42`): exige só sessão; com service role devolve `select *` de **todos** os projetos da rede, com `client` e `client_cpf_cnpj`. Tela `/consorcio/projetos` (único consumidor, linha 42) mostra `client` (linha 141).
2. `GET /api/consorcio/ofertas` (`route.ts:19-35`): exige só sessão; devolve **todas** as ofertas com `interessado_nome`, `interessado_tel`, `interessado_cpf_cnpj`. Único consumidor: `cartas-contempladas/page.tsx:231-233`, só para admin. Devolve `error.message` cru (linha 33).
3. `GET /api/consorcio/cartas` (`route.ts:32-42`): devolve `select *` de todas as cartas a qualquer login, com `asking_price` (preço de custo da V3) e `metadata`. A tela soma a margem de 7% no navegador (`cartas-contempladas/page.tsx:135-137`), então qualquer partner ou cliente Enterprise lê o preço de custo e a margem da V3 na resposta.
4. `POST /api/consorcio/ofertas` (`route.ts`): qualquer login muda para `NEGOCIACAO` o status de **qualquer** `carta_id` (linhas 96-100), sem conferir se a carta existe, está ativa ou já foi `VENDIDA`; `carta_code` e `carta_credit_value` vêm do corpo; `responsavel_id` aceita qualquer perfil; o e-mail aos admins interpola `interessado_nome` e `observacoes` sem escapar (linhas 159 e 171).
5. `POST /api/consorcio/cartas` (`route.ts:44-82`): qualquer papel inclui carta no catálogo da rede; o botão "Incluir Carta" aparece para todos (`page.tsx:315`).
6. `app/(platform)/ranking/page.tsx`: envia a todos os papéis a prop `goals` com as metas (`partner_goals`) de toda a rede; o client nem usa (`ranking-client.tsx:575`).
7. Marketplace: `match-partners/route.ts:18` e o único chamador `app/api/marketplace/products/route.ts:154-157` usam `process.env.INTERNAL_API_KEY ?? "v3-internal"`; o chamador engole a falha com `.catch(() => {})`.
- Sem sinal conhecido de exploração. Não há log de leitura nessas rotas, então não dá para provar que ninguém leu.

## ESTADO ATUAL DA RLS
- `consorcio_projetos`: SELECT só para ADMIN/GESTAO/MESA_OPERACIONAL desde `20261031a_fim_leitura_direta_externo.sql:83-85`. A leitura pela REST com a chave anon já está fechada; o vazamento é pela rota do servidor (service role).
- `consorcio_cartas`: a política "autenticados podem ler cartas" (`using (auth.uid() IS NOT NULL)`) foi derrubada em `20261101d_leituras_abertas_fechadas.sql:15` (rollback em `20261101d_..._rollback.sql.txt:10`). Não se sabe pelo repo se sobrou outra política de SELECT.
- `consorcio_ofertas`: o repo só tem a política de UPDATE (`20260810d:122-127`); nenhuma de SELECT nas migrations.
- **Antes do go**, rodar (só leitura) e colar aqui:
  `select tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename in ('consorcio_projetos','consorcio_ofertas','consorcio_cartas');`
  `select t, has_table_privilege('anon', 'public.'||t, 'select') as anon_sel, has_table_privilege('authenticated', 'public.'||t, 'select') as auth_sel from unnest(array['consorcio_projetos','consorcio_ofertas','consorcio_cartas']) t;`
  **Se houver SELECT aberto para `authenticated` ou `anon` em cartas ou ofertas, o escopo passa a ter DDL (drop policy), com migration, seção 6 e segundo go: o BRIEF volta ao QA.**
  **Resultado (rodado pelo Hamilton no SQL Editor de produção em 23/11/2026, consulta única só de leitura `consorcio-consulta-rls.sql`):**

  | Tabela | RLS ligada | GRANT select anon / authenticated | Políticas |
  |---|---|---|---|
  | `consorcio_cartas` | sim | sim / sim | UPDATE, DELETE e INSERT só ADMIN/GESTAO/MESA_OPERACIONAL. **Nenhuma de SELECT.** |
  | `consorcio_ofertas` | sim | sim / sim | SELECT `admins_see_all_ofertas` e UPDATE só ADMIN/GESTAO/MESA_OPERACIONAL. **INSERT `authenticated_insert_oferta` com `with check (auth.uid() IS NOT NULL)`, papel `public`.** |
  | `consorcio_projetos` | sim | sim / sim | SELECT `autenticados podem ler projetos` (apesar do nome: `get_user_role()` em ADMIN/GESTAO/MESA_OPERACIONAL), UPDATE, DELETE e INSERT só esses papéis. |

  Conclusão:
  - **Leitura direta pela REST está fechada nas três tabelas:** RLS ligada e nenhum SELECT aberto para `anon`/`authenticated` (o GRANT de tabela existe, mas sem política que libere linha o resultado é vazio). A condição "SELECT aberto → DDL" não se confirmou.
  - **Achado novo, escrita direta:** `authenticated_insert_oferta` deixa qualquer login inserir oferta pela REST (chave anon + JWT), sem passar pela rota: em nome de qualquer `created_by`, com qualquer `carta_code`/valor, e fora do controle do item 4. O app não usa essa política: a única gravação (`app/api/consorcio/ofertas/route.ts:74-90`) é com service role, que ignora RLS, e nenhum outro arquivo de `app/`, `lib/` ou `components/` grava em `consorcio_ofertas` pelo cliente (grep 23/11). Vira o item 8 do SCOPE (migration).

## SCOPE
1. **Projetos (GET)**: ADMIN, GESTAO e MESA_OPERACIONAL veem todos, com todas as colunas. Os demais veem só projetos com `created_by` em `idsDaEquipe(perfil)` (o próprio; o master Enterprise também os da equipe), e só as colunas que a tela usa: `id, code, name, type, credit_value, status, client, admin, created_at` (sem `client_cpf_cnpj`). Ordem: `created_at` desc (como hoje). Projeto com `created_by` nulo: só a equipe interna vê.
2. **Ofertas (GET)**: só ADMIN, GESTAO e MESA_OPERACIONAL (papel lido do banco); os demais recebem 403, inclusive com `?carta_id=`. Ordem: `created_at` desc, como hoje. Erro devolve mensagem genérica ("Não foi possível carregar as ofertas.").
3. **Cartas (GET)**: papel interno recebe tudo. Ordem: `created_at` desc, como hoje. Os demais recebem **só**: `id, code, type, credit_value, admin, group_name, quota, status, created_at`, mais `entrada_partner` (= `asking_price + credit_value × 0,07`, a regra de hoje, calculada no servidor), `desconto_partner` (calculado no servidor pela mesma fórmula de `displayDiscount`/`partnerDiscount` de `cartas-contempladas/page.tsx:139-143`) e `metadata` reduzido às chaves `parcelas_qtd, parcela_valor, taxa_transf, fundo_comum, saldo_devedor, avaliacao_minima`. **Ficam fora** para não internos: `asking_price`, `discount`, `source_ref`, `metadata.entrada` e todo o resto de `metadata` (todos permitem deduzir o preço de custo, ver `lib/consorcio/sync-contemplados.ts:202-216, 298-308`). A tela passa a usar `entrada_partner` e `desconto_partner` para quem não é interno (o cálculo no navegador sai). O POST de cartas devolve a carta no mesmo formato de quem chamou (com `entrada_partner`/`desconto_partner` para não interno), para a carta recém-criada aparecer certa sem recarregar.
4. **Ofertas (POST)**: a carta é lida do banco e precisa existir, não estar excluída e estar `DISPONIVEL` ou `NEGOCIACAO`; senão 409 "Esta carta não está disponível para oferta."; `carta_code` e `carta_credit_value` vêm da carta, não do corpo; `responsavel_id` só aceita perfil interno (ADMIN/GESTAO/MESA_OPERACIONAL), senão é ignorado; `interessado_nome`, `observacoes` e demais campos do usuário escapados no HTML do e-mail com `escapeHtml` de `lib/html-escape.ts` (já existe). Erro ao gravar a oferta devolve mensagem genérica ("Não foi possível registrar a oferta."), não o `error.message` cru (linha 93).
5. **Cartas (POST)**: **decisão do Hamilton em 23/11/2026: só ADMIN, GESTAO e MESA_OPERACIONAL incluem carta contemplada.** Na rota, papel lido do banco (`getAuthedUser`) antes da reserva de cota; demais papéis, e perfil não encontrado, recebem 403 "Só a equipe interna inclui cartas." e nada é gravado. Na tela, o botão "Incluir Carta" (`cartas-contempladas/page.tsx:315-318`) e o formulário só aparecem para esses três papéis (hoje o `isAdmin` da tela cobre o botão Sincronizar; conferir se inclui GESTAO e MESA e, se não, usar uma checagem própria). A inclusão continua gravando `created_by`. Partner que já cadastrou carta: as cartas dele continuam no catálogo (sem mudança retroativa).
6. **Ranking**: ADMIN e GESTAO recebem todas as metas; os demais recebem só a própria linha (`partner_id = user.id`). (O BRIEF da aba Enterprises entra antes e já filtra `goals` para o Enterprise; este completa para os outros papéis.)
7. **Marketplace**: sem valor padrão nos dois lados. Sem `INTERNAL_API_KEY`: a rota recusa (500, log `[match-partners] INTERNAL_API_KEY ausente`) e o chamador registra no log quando a chave falta ou a resposta não é 2xx. Comparação da chave: hash SHA-256 dos dois valores e `timingSafeEqual` dos hashes (resolve tamanhos diferentes).
8. **Ofertas (RLS, migration)**: `drop policy if exists "authenticated_insert_oferta" on public.consorcio_ofertas` (idempotente). Sem política de INSERT, só a service role (rota do item 4) grava: **nenhum login insere oferta pela REST, nem ADMIN, GESTAO ou MESA** (eles continuam pela tela, que usa a rota). Arquivo `supabase/migrations/20261123_consorcio_ofertas_sem_insert_direto.sql` + `_rollback.sql.txt`. Essa política não está em nenhuma migration do repo (só existe em produção), então o rollback a recria com a definição exata colada do `pg_policies` de 23/11: `create policy "authenticated_insert_oferta" on public.consorcio_ofertas for insert to public with check (auth.uid() IS NOT NULL);`. Nada de SELECT, UPDATE, GRANT ou coluna muda. Aplicação em produção só com segundo go, depois do merge.

Fora do escopo, com acompanhamento:
- **RLS por dono** em `consorcio_projetos`/`ofertas`/`cartas` (leitura pela sessão em vez de service role): BRIEF de acompanhamento até 05/12/2026.
- Lixeira de projetos e cartas quebrada (`page.tsx:70` chama DELETE que devolve 410; a rota indicada `projetos/{id}/delete` não existe); CPF/CNPJ e telefone sem máscara nem validação nos formulários de projeto e de oferta (`cartas-contempladas/page.tsx:708-714`): BRIEF próprio até 05/12/2026.

## EXCEÇÃO À REGRA DE ACESSO PELO BANCO
A regra "partner vê só o dele" fica imposta **na rota** (service role), não na RLS, nesta entrega. Precisa ser aceita por escrito pelo Hamilton ou pelo João como override, junto com o go. Motivo: a correção é urgente e cabe em ~2 horas; a RLS por dono exige revisar todas as rotas do Consórcio (acompanhamento acima).

## IMPACT
- `app/api/consorcio/projetos/route.ts` (GET), `app/api/consorcio/ofertas/route.ts` (GET e POST), `app/api/consorcio/cartas/route.ts` (GET e POST), `app/(platform)/consorcio/cartas-contempladas/page.tsx` (usar `entrada_partner`), `app/(platform)/ranking/page.tsx` (`goals`), `app/api/marketplace/products/[id]/match-partners/route.ts`, `app/api/marketplace/products/route.ts` (chamador).
- Usar `escapeHtml` de `lib/html-escape.ts` (já existe; não criar outro).
- Tabelas: `consorcio_ofertas` só na política de INSERT (item 8: drop de `authenticated_insert_oferta`). Sem coluna, GRANT, função ou view nova.
- Conferir antes do deploy se `INTERNAL_API_KEY` existe em Production na Vercel; se não, criar antes.

## UX: ONDE O USUÁRIO VÊ ISSO
- `/consorcio/projetos`, partner/Enterprise: só os projetos dele (master Enterprise: também os da equipe). Estado vazio que já existe: "Nenhum projeto cadastrado".
- `/consorcio/cartas-contempladas`, partner/Enterprise: mesma vitrine e mesmos valores de hoje, inclusive parcelas, taxa de transferência, fundo comum, saldo devedor e avaliação mínima (entrada e desconto do partner agora vêm prontos do servidor). Ofertar carta vendida ou excluída: mensagem "Esta carta não está disponível para oferta.".
- Mesa e ADMIN: nada muda.
- Ranking: nada muda na tela.
- Marketplace: nada muda se a chave estiver configurada.

## DEPENDENCIES
- `idsDaEquipe` em `lib/enterprise.ts` (existe).
- `INTERNAL_API_KEY` em Production (a conferir).
- Resultado de `pg_policies` colado na seção ESTADO ATUAL DA RLS (feito 23/11).
- Decisão do Hamilton sobre quem inclui carta contemplada: tomada em 23/11/2026, só ADMIN/GESTAO/MESA_OPERACIONAL (item 5).
- Migrations: `20261123_consorcio_ofertas_sem_insert_direto.sql` (item 8), com rollback; aplicada só com segundo go.

## RISKS
- Breaking change: partners deixam de incluir carta contemplada (decisão do Hamilton); partners que hoje veem projetos de outros deixam de ver; a resposta de cartas muda de formato para não internos (a tela é ajustada no mesmo PR).
- LGPD: exposição atual de nome, CPF/CNPJ e telefone de clientes a todos os logins; e exposição comercial do preço de custo e da margem da V3. [VALIDAR COM ROBSON]: avisar e pedir orientação sobre registro interno de incidente.
- Ofertas: uma carta hoje em `NEGOCIACAO` por oferta indevida continua assim (sem correção retroativa); listar no PR as cartas em `NEGOCIACAO` para a Mesa conferir.
- Marketplace: se a chave não estiver configurada, o match automático para (agora com log).
- Acesso só na rota: um erro no filtro reabre o vazamento; mitigado pelos testes abaixo e pelo BRIEF de RLS.
- Migration do item 8: se algum fluxo fora do repo (script, n8n, app externo) inserisse oferta com JWT de usuário, ele passa a falhar com 42501. Não há nenhum no repo; o rollback recria a política.
- Performance: nenhuma relevante.

## APPROACH
- Escolhida: filtro por papel e dono nas rotas + minimização de colunas + validação no POST + remoção da política de INSERT direto em ofertas (única DDL, item 8).
- Descartada para o item 8: apertar a política para `with check (created_by = auth.uid())`: ainda deixaria o partner gravar oferta sem a checagem de carta do item 4; como o app não usa a política, remover é mais simples e mais forte.
- Descartada: RLS por dono agora: mais forte, mas exige migration e revisão de todas as rotas do Consórcio que usam service role; fica no acompanhamento com data.

## PLANO DE TESTE
- Sem sessão: `GET /api/consorcio/projetos`, `/ofertas`, `/cartas` → 401.
- Projetos: partner A cria; partner B não vê (rota e tela). Master Enterprise vê o dele e os da equipe; usuário da equipe vê só o dele; usuário de equipe de **outro** master não vê nenhum. GESTAO, MESA e ADMIN veem todos. Resposta ao partner sem `client_cpf_cnpj`.
- Ofertas GET: PARTNER e ENTERPRISE → 403, inclusive com `?carta_id=<x>`; GESTAO, MESA e ADMIN → 200.
- Cartas GET: JSON do PARTNER sem `asking_price`, `discount`, `source_ref` e `metadata.entrada`, e com só as 6 chaves de `metadata`; `entrada_partner` e `desconto_partner` iguais aos valores que a tela mostra hoje; vitrine do partner com os mesmos campos de hoje (screenshot antes/depois); ADMIN com tudo.
- **Leitura direta pela REST** (chave anon + JWT de partner) em `consorcio_projetos`, `consorcio_ofertas` e `consorcio_cartas`: zero linhas.
- Cartas POST: PARTNER e ENTERPRISE → 403 e nenhuma carta criada (nem vaga de cota consumida); botão "Incluir Carta" ausente para eles; GESTAO, MESA e ADMIN → criam normalmente.
- Ofertas POST: carta `VENDIDA` ou excluída → 409 e status da carta inalterado; `carta_code` falso no corpo é ignorado; `responsavel_id` de partner é ignorado; `interessado_nome` com `<b>x</b>` aparece escapado no e-mail.
- Ranking logado como PARTNER: o payload da página traz no máximo uma linha de `partner_goals`; como ADMIN, todas.
- match-partners: sem `INTERNAL_API_KEY` → recusado com log; chave certa → 200; chave errada ou de tamanho diferente → 401.
- `pg_policies` e `has_table_privilege` rodados e colados antes do go (feito 23/11).
- Item 8, **antes de aplicar** (SQL Editor de produção, tudo desfeito no fim): `begin; drop policy if exists "authenticated_insert_oferta" on public.consorcio_ofertas; set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid de um partner>","role":"authenticated"}'; insert into public.consorcio_ofertas (carta_id, carta_code, carta_credit_value, interessado_nome, valor_oferta, created_by) values (<carta real>, 'X', 1, 'teste', 1, '<uuid do partner>');` → deve dar 42501. Repetir num segundo `begin ... rollback` com `set local role anon` (sem claims) → 42501. Repetir com o `sub` de um ADMIN → 42501 (confirma que só a service role grava). O 42501 tem que vir com "new row violates row-level security policy" (prova que barrou a RLS, não a falta de GRANT), e o INSERT de teste preenche todas as colunas obrigatórias. Fechar sempre com `rollback;`, e conferir depois que `pg_policies` ainda mostra a política (nada foi aplicado).
- Item 8, depois de aplicar: `pg_policies` de `consorcio_ofertas` sem política de INSERT; INSERT pela REST com JWT de partner → 42501 (rodado com `set local role authenticated` + `request.jwt.claims` no SQL Editor, dentro de transação com rollback); oferta pela tela (rota) continua sendo gravada.

## ESTIMATE
M. Cerca de 2 a 3 horas. Confiança alta.

## PARECER DE COMPLIANCE
[VALIDAR COM ROBSON]: exposição de dados pessoais de clientes (nome, CPF/CNPJ, telefone) e do preço de custo/margem das cartas a usuários autenticados de toda a rede, inclusive cliente Enterprise. Pergunta ao Robson: precisa de registro interno de incidente e/ou comunicação? Bloqueia até a resposta (data, quem respondeu, texto) ou até "go mesmo assim" do Hamilton/João com esta falha aceita listada (correção urgente, como em 20/11).

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (21/11): BLOQUEADO, 8 falhas: (1) RLS não descrita e exceção não declarada → seções ESTADO ATUAL DA RLS e EXCEÇÃO + acompanhamento com data; (2) GET cartas com preço de custo → item 3; (3) POST ofertas/cartas sem checagem → itens 4 e 5 (quem inclui carta: decisão do Hamilton); (4) chamador do match-partners → item 7; (5) metas no ranking → só a própria linha; (6) testes de acesso → plano ampliado; (7) ordenação → `created_at` desc; (8) Robson → pendente. Sugestões aplicadas: colunas mínimas, mensagem genérica de erro, emoji removido, defeitos da lixeira e do CPF/CNPJ registrados como acompanhamento.
Rodada 2 de 6 (21/11): BLOQUEADO, 4 falhas: (1) RLS incompleta e exceção só na rota → 20261101d citada, consultas `pg_policies` + `has_table_privilege`, teste REST, override a registrar; (2) vitrine de cartas → colunas exatas, `desconto_partner`, metadata reduzido, campos que deduzem o custo fora; (3) ordem não declarada → `created_at` desc em ofertas e cartas; (4) Robson pendente. Sugestões aplicadas: `escapeHtml` existente, erro genérico no POST, resposta do POST no formato do chamador, CPF/telefone da oferta no acompanhamento.
Rodada 3 de 6 (23/11): BLOQUEADO, 3 falhas: (1) [6.8] teste da migration só depois de aplicar → teste antes em transação desfeita (authenticated, anon e ADMIN → 42501) acrescentado; (2) [6.5] override pendente (humano; deve citar também o POST de cartas); (3) Robson pendente (humano). Sugestões aplicadas: `drop policy if exists`, rollback com a definição exata do pg_policies, nota de que nem ADMIN insere pela REST. Registrado ao QA: só as falhas 2 e 3 restam e dependem de humano; pelo protocolo o BRIEF segue com override + "go mesmo assim". Decisão do item 5 (só interno inclui carta) registrada em 23/11. Sugestões para o BRIEF de RLS (05/12): revogar GRANT de anon nas três tabelas; 409 recarregar a vitrine.

Rodada 4 de 6 (23/11): BLOQUEADO, 2 falhas, ambas só humanas: (1) override do 6.5 por escrito; (2) Robson ou "go mesmo assim" com a falha aceita. Nenhuma falha técnica: 6.8 e item 5 conferidos contra o código. Sugestões aplicadas sem reauditoria (não mudam escopo): IMPACT "GET e POST" em cartas, perfil nulo → 403, mensagem exata do 42501 e colunas obrigatórias no teste.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO na rodada 4 de 6 (23/11/2026), só com as 2 falhas humanas abaixo; nenhuma falha técnica.
- Override do 6.5 e falha de compliance aceitos pelo Hamilton em 23/11/2026, texto capturado pelo gate: "go mesmo assim: aceito seguir sem o parecer do Robson por ser correção urgente, e aceito o filtro de acesso nas rotas (projetos, ofertas e cartas, inclusive o cadastro de cartas) em vez de RLS, com o BRIEF de RLS por dono até 05/12/2026".
  - Falhas aceitas: [6.5] regra por dono e por papel imposta na rota com service role, não na RLS; [Compliance] [VALIDAR COM ROBSON] sem parecer antes do código. O Robson continua devendo ser avisado (registro interno de incidente).
- Go: "go mesmo assim" do Hamilton, 23/11/2026, válido até 23/11/2026 20:58 UTC.
- Migration aplicada em produção: (pendente; segundo go depois do merge)

## NOTA DE IMPLEMENTAÇÃO (23/11/2026)
- `INTERNAL_API_KEY` **não existe** em Production na Vercel (conferido com `vercel env ls production`). Ou seja, hoje a rota match-partners aceita a chave padrão "v3-internal" escrita no código. A criação pelo agente foi barrada pela permissão da sessão: o Hamilton cria a variável (valor aleatório) **antes do merge**. Sem ela, depois do deploy o match automático do Marketplace para, com log, como previsto em RISKS.
- Helper da vitrine em `app/api/consorcio/vitrine.ts` (dentro do escopo do go; `lib/` estava fora do escopo registrado). Teste: `tests/unit/consorcio-vitrine.test.ts`.
- POST de ofertas: o UPDATE da carta para NEGOCIACAO também filtra `status in (DISPONIVEL, NEGOCIACAO)`, para não haver corrida com uma venda concluída entre a leitura e a gravação.
