# BRIEF: Aba "Enterprises" para o ADMIN + listas separadas (V3 sem a equipe do Enterprise; Enterprise só com a própria equipe)

> Data: 2026-11-20 (revisado 2026-11-21) | Autor: Claude (pedido do Hamilton) | Status: LIBERADO pelo QA (rodada 3), aguardando go
> Salvar em `docs/briefs/2026-11-20_aba-enterprises-admin-e-equipe-fora-das-listas.md` e commitar junto com o código.

## PEDIDOS E DECISÕES DO HAMILTON (no chat)
- 20/11: "faz uma aba nova enterprise para o admin"
- 20/11: "lembrando também que os usuários do enterprise (master) não deve aparecer nos usuários e partners da v3"
- 20/11: o **master continua em Usuários** (cliente direto da V3: contrato, cobrança, 55%), com selo Enterprise; **só a equipe abaixo dele sai** das listas da V3.
- 21/11: "o ranking por exemplo deve aparecer somente dos usuarios do enterprise, correto?" → regra geral: **toda lista de pessoas vista por um login Enterprise mostra só a equipe dele.**
- 21/11: "sim, master aparece junto com os usuários" (no ranking do Enterprise).

## SITUAÇÃO HOJE (levantamento de 20–21/11, conferido pelo QA rodada 1)
- Equipe de um Enterprise: `role = 'ENTERPRISE'` e `enterprise_id = <master>`. Master: `role = 'ENTERPRISE'` e `enterprise_id is null`.
- Listas da V3 que **já não mostram** a equipe (filtram papéis sem ENTERPRISE): ranking, comissões do ADMIN, metas, `admin-dashboard`, `cm/partners-list`; listas financeiras usam `.is("enterprise_id", null)`.
- Listas da V3 que **mostram** a equipe hoje: tela **Usuários** (`GET /api/usuarios`, `select *`), **ranking da Academy** (`app/api/academy/ranking`, só ADMIN/GESTAO), seletor **`/api/partners`** (Mesa Operacional, Mesa de Capitais, contratos), **onboarding do ADMIN** (`app/api/onboarding/admin/route.ts:33`), seletor **"quem indicou" da Prospecção** (`app/api/prospeccao/route.ts:59`) e **match de partners do Marketplace** (`app/api/marketplace/products/[id]/match-partners/route.ts:40`).
- Telas que o **Enterprise vê no menu mas não abre**: **Ranking** (`app/(platform)/ranking/page.tsx:83` manda ENTERPRISE para `/unauthorized`) e **Metas & Performance** (`app/(platform)/metas/page.tsx:23`, mesmo problema). O menu (`components/layout/sidebar.tsx:58` e `:170`) mostra os dois itens ao ENTERPRISE.
- `lib/enterprise.ts`: `contextoEnterprise` devolve `masterId`; `usuariosIds` só vem preenchido para o master.
- **Comunicados** (`app/api/comunicados/route.ts`): não usam `lib/email.ts` (Resend direto, linha 158) e o filtro "todos" (linha 136) não inclui ENTERPRISE. Hoje nem master nem equipe recebem comunicados.
- **Chat Partners da Mesa** (`chat/rooms`, `PARTNER_ROLES` com ENTERPRISE) continua mostrando a equipe à Mesa por necessidade de atendimento, como os seletores. Fica como está.
- **Consórcio (achado do QA rodada 2, 21/11)**: `GET /api/consorcio/projetos` (linha 36) devolve `select *` de todos os projetos da rede a qualquer login, com `client` e `client_cpf_cnpj`, exibidos em `/consorcio/projetos` (linha 141); `GET /api/consorcio/ofertas` devolve `interessado_nome`, `interessado_tel` e `interessado_cpf_cnpj` de todas as ofertas a qualquer login (a tela só busca para admin, mas a API responde a todos). Atinge partners da V3 e o login Enterprise. **Tratado em BRIEF próprio de segurança, aberto em 21/11: `docs/briefs/2026-11-21_consorcio-projetos-ofertas-vazamento.md`.** [VALIDAR COM ROBSON] pendente no BRIEF de segurança; não bloqueia este.
- Fora do escopo, visto pelo QA: `ranking/page.tsx` entrega a todos os papéis a prop `goals` com as metas de toda a rede; `match-partners` aceita `x-internal-key` com valor padrão fixo quando `INTERNAL_API_KEY` não existe. Entram no mesmo BRIEF de segurança. Ordem de entrega: **este BRIEF entra primeiro**; o de segurança, ao filtrar `goals` para todos os papéis em `ranking/page.tsx`, parte do código já mergeado daqui.
- E-mails automáticos que passam por `lib/email.ts` (relatório mensal, monthly-report, academy-live-reminder) já saem com a marca do Enterprise para o master e a equipe.

## SCOPE
1. Página **`/admin-enterprises`** (só ADMIN) e item **"Enterprises"** no menu, com a lista dos masters Enterprise e o botão "Abrir painel" (modo ADMIN do PR #414).
2. **Equipe do Enterprise fora das listas da V3**: Usuários, ranking da Academy, onboarding do ADMIN, match do Marketplace. Nos seletores `/api/partners` e "quem indicou" a equipe **continua**, no fim e com rótulo de exibição (a Mesa precisa vincular proposta ao usuário certo, senão o repasse do Enterprise quebra).
3. **Listas do Enterprise só com a própria equipe**:
   - **Ranking** (`/ranking`): ENTERPRISE passa a abrir; vê **master + usuários** do mesmo Enterprise, mesma tela e mesma pontuação da V3.
   - **Metas & Performance** (`/metas`): ENTERPRISE passa a abrir; o **master** vê ele + a equipe (como o ADMIN vê a rede); o **usuário** vê só ele mesmo (como o partner da V3).
4. Master em Usuários ganha o selo "Enterprise · {marca}" e "{n} usuários".
5. **Bloqueio de conta da equipe pela V3 continua possível** (status quo): na página Enterprises, o ADMIN tem "Bloquear acesso" / "Liberar acesso" por usuário da equipe, pela mesma rota que a tela Usuários usa hoje.

Fora do escopo: **Consórcio (projetos e ofertas)**, no BRIEF de segurança próprio citado acima; **comunicados** ao Enterprise (hoje não chegam; corrigir em BRIEF próprio, com decisão do Hamilton sobre incluir master e equipe); editar ou excluir usuário da equipe pela V3 (aguarda Robson); renomear itens de menu.

## IMPACT
- `app/(platform)/admin-enterprises/page.tsx` (novo, server): `requireRole(["ADMIN"])` (mesmo padrão de `app/(platform)/usuarios/page.tsx`; não ADMIN → `/unauthorized`, sem sessão → `/login`). Depois, leitura com service role: masters (`role = 'ENTERPRISE'` e `enterprise_id is null`); equipe (`select id, full_name, email, is_active, enterprise_id` onde `enterprise_id is not null`), contada e agrupada **no servidor, em JS** (sem RPC, sem view); marca, logo, domínio e status, `is_active`, `trial_expires_at`, `created_at` do master.
- `components/admin-enterprises/admin-enterprises-client.tsx` (novo): tabela, busca, linha expansível com a equipe e o botão Bloquear/Liberar.
- `components/layout/sidebar.tsx`: item `{ href: "/admin-enterprises", label: "Enterprises", icon: "Building2", roles: ["ADMIN"] }` logo abaixo de "Usuários".
- `app/api/usuarios/route.ts` (`GET`): exclui `enterprise_id is not null`; acrescenta a cada master `enterprise_usuarios` (total) e `enterprise_usuarios_ativos`, e `enterprise_marca`.
- `app/api/usuarios/[id]/route.ts` (`PATCH`): **sem mudança**; continua aceitando perfis da equipe (é a rota que o Bloquear/Liberar usa). Já exige ADMIN e grava `audit_logs`.
- `components/usuarios/users-client.tsx`: selo "Enterprise · {marca}" (sem `white_label_nome`: "Enterprise · Sem marca") e "{n} usuários" na linha do master, junto do link "Abrir painel" que já existe (linha 527); contadores do topo sem a equipe.
- `app/api/academy/ranking/route.ts`, `app/api/onboarding/admin/route.ts`, `app/api/marketplace/products/[id]/match-partners/route.ts`: `.is("enterprise_id", null)` (master fica; equipe sai). Marketplace: oportunidades da V3 vão para a rede da V3 e para o master, que distribui na equipe dele.
- `app/api/partners/route.ts` e `app/api/prospeccao/route.ts` (seletor "quem indicou"): mantêm a equipe e devolvem o campo novo `rotulo`. **Ordenação na rota, depois da consulta**: grupo 1 = perfis com `enterprise_id` nulo (inclui o master Enterprise, cliente direto da V3), por `full_name` com `localeCompare('pt-BR')`; grupo 2 = equipe (`enterprise_id` não nulo), por marca e depois `full_name`, os dois com `localeCompare('pt-BR')`. `rotulo` = `"{full_name} · {marca}"` no grupo 2; `full_name` no grupo 1.
- **`rotulo` é só exibição no item da lista.** O que é gravado, enviado à API ou injetado em documento (qualificação, NCNDA, `qualParties.full_name`, `npPartnerName`) continua sendo `id` e `full_name`. A busca do seletor acha por `full_name` e pela marca. Seletores: `components/mesa-operacional/mesa-op-client.tsx` (linhas 1018, 1383, 2066), `components/cm/mesa-capitais-client.tsx:540`, `components/cm/contracts-panel-client.tsx:182/190`, `components/cm/contract-templates-client.tsx:271/279/324`, e o seletor "quem indicou" da Prospecção.
- `lib/enterprise.ts`: função nova `idsDoEnterprise(db, perfil)` → `[masterId, ...todos os usuários do masterId]`, para qualquer perfil da equipe ou o master (a `idsDaEquipe` atual continua igual, porque é usada em permissão de proposta). `EnterpriseContexto` ganha `masterNome` (`full_name` do master, já lido no mesmo select). Função nova `nomeDaMarca(ctx)`: **fallback único da marca** = `white_label_nome`, senão `masterNome`, senão "Enterprise"; texto vazio ou só espaços conta como ausente (`trim()`). Usada na ordenação e no rótulo dos seletores, no subtítulo do ranking e nos selos; nunca imprime "null".
- `app/(platform)/ranking/page.tsx`: ENTERPRISE entra na lista de papéis permitidos; para ENTERPRISE, `partners` = `idsDoEnterprise` (com `full_name`), e propostas, deals, comissões e metas (`goals`) filtradas por esses ids. **Para ENTERPRISE, todos os ids ativos entram no ranking mesmo com 0 pontos; usuário bloqueado (`is_active = false`) sai do ranking e das metas** (o filtro que descarta quem tem zero em tudo não se aplica). **Desempate por `full_name` com `localeCompare('pt-BR')`** para todos os papéis (hoje empates não têm ordem). Se o contexto Enterprise falhar: lista vazia e a mensagem "Nenhum dado disponível no período selecionado.", nunca a lista geral. Para os outros papéis, a lista continua igual (ENTERPRISE fora do ranking da V3). `currentUserId` passa a ser enviado ao client.
- `components/ranking/ranking-client.tsx`: para ENTERPRISE, esconde o aviso "Programa de Premiação V3 Partners" (a premiação é da rede V3); subtítulo "Ranking da equipe {marca} · {período}" (sem travessão); selo "Top {n}" no lugar de "Top {n} Partners"; papel da linha "Equipe {marca}" no lugar de "Partner"; nota abaixo do título: "As comissões da equipe são pagas ao master do {marca}."; card "sua posição" buscado por `currentUserId` (hoje cai no 1º colocado quando o usuário não está na lista); se o usuário não está na lista (partner da V3 sem pontos no período), o card mostra "Você ainda não pontuou neste período." Travessões nos textos da tela trocados por ponto médio ou vírgula: "Bem-vindo, X · período", "desbloqueie acumulando resultados".
- `app/(platform)/metas/page.tsx`: ENTERPRISE permitido; master → `idsDoEnterprise`, **ordenado no servidor antes de montar a performance: master primeiro, depois a equipe por `full_name` com `localeCompare('pt-BR')`**; usuário da equipe → só ele. Lista do ADMIN também ordenada por `full_name` com `localeCompare('pt-BR')`. Texto "Nenhuma meta definida — clique em..." (`metas-client.tsx:313`) sem travessão: "Nenhuma meta definida. Clique em Definir Metas."
- `components/metas/metas-client.tsx`: flag novo `visaoEquipe` (master Enterprise): mostra o resumo geral e os cards da equipe e **esconde "Definir Metas/Editar Metas"**; `isAdmin` continua `false` para o Enterprise. **O master não define metas**: só a V3 (ADMIN/GESTAO) escreve em `partner_goals`, inclusive para a equipe (`POST /api/partner-goals` sem mudança, já recusa outros papéis). Texto sem meta, para master e usuário Enterprise: "Metas ainda não definidas pela V3 para este mês." Nota no card de comissões: "As comissões da equipe são pagas ao master."
- `app/api/usuarios/[id]/route.ts` (`PATCH`, só no registro de auditoria): o `audit_logs` do bloquear/liberar passa a ser gravado com `await` e `old_data: { is_active: <valor anterior> }` (hoje sem await e com old_data nulo). Quem pode chamar não muda.
- Tabelas: nenhuma alterada (sem DDL). Só leitura de `profiles`, `credit_desk_proposals`, `ma_deals`, `commissions`, `partner_goals`.

## UX: ONDE O USUÁRIO VÊ ISSO
- **Menu (ADMIN)**: "Enterprises", ícone de prédio, logo abaixo de "Usuários".
- **Página Enterprises** (ADMIN): título "Enterprises", subtítulo "Clientes Enterprise da V3, a equipe de cada um e o white label." Ordenada por data de criação do master (mais recente primeiro). Colunas:
  - **Enterprise**: logo pequeno (ou ícone de prédio) + marca (ou "Sem marca") + nome do master;
  - **Usuários**: "{n} de 10" (conta todos, ativos e bloqueados); tooltip "{x} ativos";
  - **Domínio**: endereço + selo Ativo / Aguardando DNS / Erro, ou "Sem domínio";
  - **Acesso até**: `formatDateBr` de `lib/cm-indicators.ts` (DD/MM/AAAA, America/Sao_Paulo); nulo = "Sem data"; data passada = selo vermelho "Vencido";
  - **Situação**: Ativo / Bloqueado;
  - **Ação**: "Abrir painel" → `/enterprise?master=<id>`; "Ver equipe" abre a linha com os usuários (nome, e-mail, situação), ordenados por `full_name` com `localeCompare('pt-BR')`, e o botão "Bloquear acesso" / "Liberar acesso". Confirmação pelo modal `confirmar()` de `lib/aviso.ts` (nunca `window.confirm`; `perigo: true` no Bloquear): "Bloquear o acesso de {nome} à plataforma? Ele deixa de entrar até ser liberado." / "Liberar o acesso de {nome}?". Mensagem de sucesso: "Acesso bloqueado." / "Acesso liberado."
  Busca no topo ("Buscar por empresa ou master"). Estado vazio: "Nenhum cliente Enterprise ainda." Equipe vazia: "Este Enterprise ainda não cadastrou usuários."
- **Usuários (ADMIN)**: equipe some; master com selo dourado "Enterprise · AGS Finance" e "3 usuários" ao lado do nome. Tooltip do selo: "A equipe deste Enterprise fica na aba Enterprises."
- **Seletores de partner** (Mesa Operacional, Mesa de Capitais, contratos, "quem indicou"): rede V3 primeiro (master Enterprise incluído); equipe no fim, como "Fulano · AGS Finance". O nome gravado e o nome nos documentos saem só "Fulano".
- **Ranking da Academy, onboarding do ADMIN, match do Marketplace**: só a rede da V3 (com o master).
- **Ranking, login Enterprise** (master ou usuário): mesma tela da V3, com o master e os usuários da AGS, subtítulo "Ranking da equipe AGS Finance · Novembro", selo "Top {n}", sem o aviso de premiação da V3. Equipe sem atividade no período: todos aparecem com 0 pontos, em ordem alfabética. Empates: ordem alfabética.
- **Metas & Performance, login Enterprise**: master vê o resumo e os cards dele + da equipe (ele primeiro, equipe em ordem alfabética), sem botão de editar metas; usuário vê só o próprio card. Sem meta: "Metas ainda não definidas pela V3 para este mês."
- **Comunicações**: sem mudança nesta entrega.

## DEPENDENCIES
- PR #414 no ar (modo ADMIN em `/enterprise?master=`): ok.
- Migrations: nenhuma.

## RISKS (nunca "nenhum")
- **Breaking change na tela Usuários**: a equipe some dali. Editar e excluir usuário da equipe pela V3 deixam de existir na interface (a rota continua). Bloquear/Liberar é preservado na página Enterprises. Sem migração de dados.
- **Rótulo vazando para documento**: mitigado pela regra "rotulo só exibição" e pelo teste de documento abaixo.
- **Ranking e Metas para o Enterprise usam service role**: a trava é o papel lido do banco no servidor e o filtro por `idsDoEnterprise`; um erro no filtro mostraria a rede inteira da V3 a um cliente. Mitigação: teste com usuário de teste confirmando que nenhum id fora da equipe aparece; falha ao montar o contexto Enterprise devolve lista vazia, nunca a lista geral.
- **Contadores e listas mudam** (Usuários, onboarding, ranking da Academy, Marketplace): menos itens. Esperado.
- **LGPD**: nenhuma exposição nova. A página Enterprises mostra ao ADMIN nome e e-mail da equipe, que o ADMIN já vê hoje na tela Usuários. O ranking do Enterprise mostra ao master e à equipe só nomes e números da própria equipe.
- **Segurança de acesso ao banco**: sem mudança de RLS, policy, view, função ou grant. A service role ignora RLS; a trava é a checagem de papel no servidor, com o papel lido do banco (`requireRole` / `exigirAdmin`).
- **Performance**: 1 consulta extra por tela (tabelas pequenas); ranking do Enterprise filtra por ids, mais leve que o da V3.

## APPROACH
- Escolhida: página nova de lista + reaproveitar o painel `/enterprise?master=`; filtros pontuais nas listas; rótulo de exibição nos seletores em vez de esconder; ranking e metas reaproveitam as telas da V3 com outra lista de ids.
- Descartada 1: esconder a equipe também nos seletores: a Mesa não vincularia proposta ao usuário e o repasse do Enterprise quebraria.
- Descartada 2: tirar o master de Usuários (decisão do Hamilton: o master é cliente direto da V3).
- Descartada 3: aba dentro da tela Usuários: a tela já é longa; página própria facilita crescer (cobrança, KPI x10 da garantia).
- Descartada 4: ranking próprio do Enterprise em tela nova: duplicaria a pontuação; o pedido é o mesmo layout da V3.

## PLANO DE TESTE
- ADMIN abre "Enterprises": vê AGS Finance (Marciano), "0 de 10", "Sem domínio", acesso até 11/11/2027; "Abrir painel" leva ao painel em modo ADMIN.
- GESTAO, MESA_OPERACIONAL, PARTNER e ENTERPRISE em `/admin-enterprises`: redireciona para `/unauthorized`; item não aparece no menu. Sem sessão: `/login`. `GET /api/usuarios` sem sessão: 401.
- Usuários: master com selo; nenhum perfil com `enterprise_id` na lista (conferir com usuário de teste da equipe, criado num master de teste, nunca no cliente real).
- Bloquear/Liberar um usuário de teste pela página Enterprises: `is_active` muda e `audit_logs` registra.
- Ranking da Academy, onboarding do ADMIN e match do Marketplace sem a equipe (master presente).
- Seletores: rede V3 primeiro (com o master), equipe no fim com "· {marca}"; seleção grava o id certo; **adicionar um usuário de teste da equipe como parte num documento de teste e conferir que o nome sai sem o sufixo**.
- **Isolamento entre dois Enterprises**: criar dois masters de teste (A e B), cada um com pelo menos um usuário com proposta no período. Login A (master e usuário) em `/ranking` e `/metas`: ninguém de B e nenhum partner da V3; o mesmo para B. Usuário sem atividade aparece com 0. Sem sessão em `/ranking` e `/metas`: `/login`. ADMIN e PARTNER continuam sem ver ENTERPRISE no ranking da V3.
- Master sem marca configurada: rótulo e subtítulo usam o nome do master, nunca "null".
- Metas: master de teste vê ele primeiro + equipe em ordem alfabética, sem botão de editar; usuário de teste vê só ele.
- Bloquear/Liberar: `audit_logs` com `old_data.is_active` anterior.
- Ranking e Metas com PARTNER e ADMIN: idênticos a hoje, salvo empates agora em ordem alfabética, lista do ADMIN em Metas em ordem alfabética e o card "Você ainda não pontuou neste período." para quem não pontuou.
- Usuário de teste bloqueado: some do ranking e das metas do Enterprise.

## ESTIMATE
M/L. Cerca de 4 horas. Confiança alta.

## PARECER DE COMPLIANCE
N/A para dado pessoal novo: a página Enterprises mostra ao ADMIN dados que ele já vê em Usuários; o ranking do Enterprise mostra só a própria equipe. O bloqueio de conta da equipe pela V3 é a capacidade que já existe hoje na tela Usuários, preservada sem ampliação; editar e excluir usuário da equipe pela V3 ficam fora até o parecer do Robson sobre a atuação da V3 nas contas da equipe (pendência já registrada em 19/11). Comunicados ao Enterprise: fora do escopo, BRIEF próprio.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (21/11): BLOQUEADO, 5 falhas: (1) ordenação do seletor incompleta → corrigida em IMPACT; (2) rótulo podia vazar para documento → regra "rotulo só exibição" + teste; (3) afirmação falsa sobre comunicados → corrigida em SITUAÇÃO HOJE, comunicados fora do escopo; (4) levantamento de listas incompleto → onboarding, prospecção e marketplace incluídos com decisão; (5) ADMIN perderia o bloqueio da equipe → Bloquear/Liberar preservado na página Enterprises (status quo). Sugestões aplicadas: `requireRole`, `formatDateBr`, "Sem data"/"Vencido", contagem com ativos no tooltip, contagem em JS sem RPC, texto de segurança, teste sem sessão.
Rodada 2 de 6 (21/11): BLOQUEADO, 6 falhas: (F1) ranking com zeros e desempate → todos entram com 0, desempate por nome; (F2) ordem das metas → master primeiro, equipe por nome; (F3) escrita de metas → master não define, flag `visaoEquipe`, textos; (F4) vazamento no Consórcio → BRIEF de segurança próprio aberto em 21/11, Robson a avisar; (F5) isolamento entre Enterprises → teste com A e B; (F6) marca nula → fallback único. Sugestões aplicadas: auditoria com await, modal `confirmar()`, textos do ranking, `currentUserId`, sem travessão, Chat Partners registrado.
Rodada 3 de 6 (21/11): **LIBERADO**, zero falhas. F1 a F6 resolvidas; F4 atendida pela opção b (BRIEF de segurança próprio, ainda pendente de QA e do aviso ao Robson). Sugestões aplicadas depois do veredito, sem mudar escopo nem regra de acesso: texto da tag do Robson, ordem de entrega entre os dois BRIEFs, `masterNome` + `trim()` no fallback, usuário bloqueado fora do ranking/metas, card "Você ainda não pontuou", ordem da lista do ADMIN em Metas, travessões, selo "Sem marca", texto do teste.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO, rodada 3, 21/11/2026
- Go: (pendente)
- Migration aplicada em produção: não se aplica

## EXCEÇÃO PONTUAL (23/11/2026)
O Hamilton autorizou no chat a criação de um usuário de teste na equipe AGS por script com service role, porque o modo ADMIN não cria usuários de Enterprise (só o master). Mesmo cadastro de `POST /api/enterprise/usuarios` (role ENTERPRISE, enterprise_id = master AGS, repasse 0%, troca de senha no 1º acesso, senha temporária só no e-mail).
- Usuário: "Teste AGS V3", v3partnersbrasil@gmail.com, id 07668ecf-b524-4495-8bf2-ef18bb23db51. Ocupa 1 das 10 vagas e aparece ao Marciano na equipe e no ranking.
- O registro em `audit_logs` falhou (coluna `record_id` não existe); fica este registro.
- Remover o usuário depois do teste.
