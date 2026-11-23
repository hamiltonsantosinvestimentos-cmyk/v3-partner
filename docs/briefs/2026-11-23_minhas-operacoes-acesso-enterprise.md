# BRIEF: Minhas operações liberada para o papel ENTERPRISE

> Data: 2026-11-23 | Autor: Claude (defeito apontado pelo Hamilton) | Status: QA rodada 2 com 1 falha humana (override 6.5); aguardando "go mesmo assim"
> Corrige uma lacuna do BRIEF `2026-11-23_enterprise-identidade-fase1-chat-operacoes-simuladores.md`, que prometeu "Minhas operações › Portfólio" ao usuário da AGS sem conferir a regra de acesso da página.

## PEDIDO
Hamilton, 23/11/2026, testando com o usuário da AGS: "minhas operações para os usuarios da AGS esta com acesso negado".

## SITUAÇÃO HOJE
- `components/layout/sidebar.tsx:54`: o item "Minhas Operações" aparece para `STARTER, PARTNER, PARTNER_PRO, GOLD, DIAMANTE, PARTNER_HE, ENTERPRISE`.
- `app/(platform)/minhas-operacoes/page.tsx:19`: a página só aceita `PARTNER, PARTNER_PRO, GOLD, DIAMANTE, PARTNER_HE`; ENTERPRISE (master e equipe) cai em `/unauthorized`.
- A página lê no servidor, hoje com o cliente de serviço, **só os registros do próprio usuário**: `credit_desk_proposals.partner_id = user.id`, `ma_deals` com `originator_profile_id` ou `created_by = user.id` (critério único de originador, política de sigilo de 31/10), `consorcio_leads.created_by = user.id`. Nenhum dado de terceiro.

- A tela faz mais, pelo client (conferido pelo QA na rodada 1):
  - **Escrita**: `POST /api/ocr-correcao-feita` (`minhas-operacoes-client.tsx:119`): o partner marca como corrigida uma pendência de OCR **da própria proposta**; a rota (cliente de serviço) grava `metadata.pendencias_ocr`, move a proposta para `TRIAGEM` e avisa ADMIN, GESTAO e MESA_OPERACIONAL. A rota já inclui ENTERPRISE em `isPartner` e confere `partner_id === user.id` (403 se não for dele).
  - **Leituras**: `GET /api/portfolio` e `GET /api/regras-linhas` (`portfolio-viewer.tsx:573-574`, aba Portfólio) e `GET /api/enterprise/identidade` (marca). O ENTERPRISE já recebe portfólio e regras pelas telas da Mesa de Crédito: não é dado novo para ele.
  - Ordenação existente: propostas, deals e leads por `created_at` desc; portfólio por ordem e nome.
  - A aba inicial da tela é **Portfólio**, para todos os papéis.

## SCOPE
1. Incluir `ENTERPRISE` na lista de papéis aceitos pela página. **Regra de leitura (6.5): caminho (b), ver ESTADO DA RLS**: cliente de serviço com filtro por `user.id` no servidor, como para os demais partners, aceito por override. Master e usuário da equipe veem **só as próprias** operações, pelos mesmos filtros de hoje (sem visão da equipe nesta entrega: a equipe do master já aparece na Mesa e nas propostas pela regra de `idsDaEquipe`).
2. Nada mais muda: mesmas consultas, mesmas colunas, mesmo cliente (de serviço, caminho (b)).
3. Fora do escopo, registrado: `STARTER` aparece no menu e também é barrado pela página. Fica como está (o menu do Starter antigo/Access foi decidido no PR #233); se for defeito, BRIEF próprio.

## IMPACT
- Arquivo: `app/(platform)/minhas-operacoes/page.tsx` (só a lista de papéis).
- Tabelas, rotas, APIs: nenhuma mudança de código. Passam a ser usadas pelo ENTERPRISE nesta tela: `POST /api/ocr-correcao-feita` (escrita na própria proposta, ver SITUAÇÃO HOJE), `GET /api/portfolio`, `GET /api/regras-linhas`, `GET /api/enterprise/identidade`.

## UX: ONDE O USUÁRIO VÊ ISSO
- Usuário da AGS (master ou equipe), menu **Minhas Operações**: a página abre com as abas Crédito, M&A, Consórcio e Portfólio, já com "Portfólio AGS Finance 2026" (PR #421). Estado vazio: os textos de hoje para quem ainda não tem operação.

## ESTADO DA RLS (antes do go)
Consulta só de leitura a rodar no SQL Editor e colar aqui:
`select tablename, policyname, cmd, roles, qual from pg_policies where schemaname='public' and tablename in ('credit_desk_proposals','ma_deals','consorcio_leads') and cmd in ('SELECT','ALL') order by 1,2;`
Resultado (rodado pelo Hamilton no SQL Editor de produção, 23/11/2026):

| Tabela | Política | Comando | Usando |
|---|---|---|---|
| `credit_desk_proposals` | `credit_select_partner` | SELECT | `get_user_role()` em ADMIN, GESTAO, MESA_OPERACIONAL |
| `ma_deals` | `ma_select` | SELECT | `get_user_role()` em ADMIN, GESTAO, MESA_OPERACIONAL, FINANCEIRO |
| `consorcio_leads` | (nenhuma política de SELECT) | | |

Conclusão: **nenhum partner (nem os da V3) lê as próprias linhas pela RLS** nessas três tabelas. Usar o cliente da sessão deixaria a página vazia para todos. Caminho (a) inviável sem migration de RLS por dono, que mexe em todos os papéis de partner e em outras telas: fica para o BRIEF de RLS por dono já previsto até 05/12/2026 (BRIEF do Consórcio), que passa a incluir `credit_desk_proposals`, `ma_deals` e `consorcio_leads` lidas pela Minhas operações.
**Caminho escolhido: (b)**, cliente de serviço com filtro por `user.id` da sessão no servidor, igual ao que já vale para PARTNER, PARTNER_PRO, GOLD, DIAMANTE e PARTNER_HE. Exige override escrito do Hamilton ou do João (falha 6.5 aceita).

## DEPENDENCIES
- Nenhuma. Sem migration.

## RISKS
- Acesso: abre uma página a mais para o papel ENTERPRISE; o risco seria mostrar dado de outro usuário, e não mostra: todas as consultas filtram pelo `user.id` da sessão no servidor.
- Expectativa: o master pode esperar ver as operações da equipe aqui; nesta entrega vê só as dele (registrado em UX e SCOPE).
- Regressão: nenhuma para os papéis atuais (lista só cresce).
- Regra por dono só no código (6.5): um erro no filtro exporia operações de outro usuário. Mitigado: filtros já em produção para 5 papéis, sem mudança; RLS por dono no BRIEF de acompanhamento até 05/12/2026.
- Escrita: o usuário da AGS passa a poder marcar a pendência de OCR da própria proposta por esta tela (move para Triagem e avisa a Mesa), como os partners já fazem.

## APPROACH
- Escolhida: incluir ENTERPRISE na lista da página, mantendo os filtros por dono no servidor (caminho (b)).
- Descartada: ler pelo cliente da sessão (caminho (a)): a RLS de hoje não deixa partner nenhum ler as próprias linhas (ver ESTADO DA RLS).
- Descartada: visão da equipe para o master nesta página (exige decidir colunas e sigilo de M&A da equipe; fica para pedido próprio).
- Descartada: tirar o item do menu (o Hamilton quer a página para a AGS).

## PLANO DE TESTE
- Usuário de teste da AGS (equipe): página abre; só as operações dele (hoje nenhuma: estados vazios); aba Portfólio com a marca.
- Master da AGS (modo ADMIN não se aplica: a página é do usuário logado): abre e mostra só as dele.
- Partner V3 (PARTNER): igual a hoje.
- MESA_OPERACIONAL e FINANCEIRO: continuam em `/unauthorized`.
- Sem sessão: vai para `/login`.
- Usuário da AGS marca como corrigida a pendência de OCR da própria proposta: ok (proposta vai para Triagem, Mesa avisada). Mesma chamada com o `proposal_id` de proposta de outro partner: 403.

## ESTIMATE
S. 15 minutos. Confiança alta.

## PARECER DE COMPLIANCE
Não se aplica: nenhum dado novo exposto; o usuário vê só os próprios registros.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (23/11): BLOQUEADO, 2 falhas: (1) [6.5] regra só no filtro da rota → seção ESTADO DA RLS com a consulta e os dois caminhos declarados; (2) [6.5] escrita e leituras não declaradas → POST ocr-correcao-feita e as 3 leituras do client em SITUAÇÃO HOJE/IMPACT/RISKS, testes de 403 e sem sessão. Sugestões aplicadas: aba inicial Portfólio, teste sem sessão. Observações fora do escopo registradas: /api/portfolio e /api/regras-linhas sem login (BRIEF próprio de seção 6), PARTNER_HE fora de isPartner em /api/ocr-correcao-feita (defeito existente).

Rodada 2 de 6 (23/11): BLOQUEADO, 1 falha só humana: [6.5] regra por dono só no filtro do servidor (cliente de serviço) em credit_desk_proposals, ma_deals e consorcio_leads; segue com override escrito + "go mesmo assim", sem nova rodada. Nenhuma falha técnica. Sugestões aplicadas: SCOPE e cabeçalho sem ambiguidade.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO na rodada 2 de 6 (23/11/2026), só com a falha 6.5 (humana)
- Override do 6.5 aceito pelo Hamilton em 23/11/2026, texto capturado pelo gate: "go mesmo assim: aceito a falha 6.5 da Minhas operações para ENTERPRISE, com filtro por usuário no servidor (cliente de serviço) em credit_desk_proposals, ma_deals e consorcio_leads, igual aos demais partners, com a RLS por dono no BRIEF até 05/12/2026"
- Go: "go mesmo assim" do Hamilton, 23/11/2026 (válido até 24/11 03:18 UTC)
- Migration aplicada em produção: não se aplica
