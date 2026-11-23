# BRIEF: Enterprise com menu enxuto e aba Comissões (master define o % de cada usuário; usuário vê só a comissão dele)

> Data: 2026-11-23 | Autor: Claude (pedido do Hamilton) | Status: QA rodada 2 sem falha técnica; 2 dependências humanas (Robson e aceite do risco (a))

## PEDIDO E DECISÕES DO HAMILTON (23/11/2026, no chat)
- "tirar do enterprise, a aba meus compradores, meus ativos, indicações, bolsa de ativos, atendimento IA, e liberar para o master a comissão, que irá definir para cada usuario deles, o % de comissao, e para os usuarios liberar a aba comissao, com a comissao ajustada pelo master."
- Decisão 1: o master define o % **dentro de Comissões** (quadro "Comissão da equipe"); Enterprise › Usuários continua com o mesmo campo, os dois gravam no mesmo lugar.
- Decisão 2: o usuário da equipe vê **só a comissão dele** (operação, data, valor, a receber/recebida). Não vê o valor do master nem o %.

## SITUAÇÃO HOJE (levantamento no código, 23/11)
- Menu (`components/layout/sidebar.tsx`): ENTERPRISE vê Meus Compradores (l.56), Meus Ativos (l.57), Indicações (l.59), Bolsa de Ativos (l.103, e o filho Vitrine l.105), Atendimento IA (l.167) e Comissões (l.175).
- Páginas: `meus-compradores/page.tsx:28`, `meus-ativos/page.tsx:28`, `indicacoes/page.tsx:23` e `meu-atendimento-ia/page.tsx:10` aceitam ENTERPRISE; `bolsa/page.tsx` não confere papel (qualquer login). `comissoes/page.tsx:19,56` **barra** ENTERPRISE (`/unauthorized`), embora o menu mostre.
- Comissão do Enterprise (`lib/credit-commissions.ts:83-150`): venda de usuário da equipe gera a comissão em nome do **master** (`commissions.partner_id = master`, 55%) e 1 linha em `enterprise_repasses` para o usuário; o valor do repasse = comissão do master × `profiles.enterprise_repasse_percent` do usuário, calculado na leitura (`lib/enterprise-repasses.ts`). O % é editado pelo master em `/enterprise › Usuários` via `PATCH /api/enterprise/usuarios` (`somenteMaster`). Alterar o % vale para as próximas comissões; repasses gerados guardam o % da época.
- O usuário da equipe hoje vê em `/enterprise › Meus repasses` (`enterprise-client.tsx:184-290`) e no PDF `GET /api/enterprise/repasses/pdf` a coluna "Comissão Enterprise" (valor do master) e o %.

## SCOPE
1. **Menu e páginas fora do Enterprise** (master e equipe): ENTERPRISE sai dos `roles` dos itens Meus Compradores, Meus Ativos, Indicações, Bolsa de Ativos (pai e Vitrine) e Atendimento IA. As páginas `/meus-compradores`, `/meus-ativos`, `/indicacoes`, `/bolsa` (e subpáginas de partner) e `/meu-atendimento-ia` mandam ENTERPRISE para `/unauthorized`. As rotas de API usadas só por essas telas (`/api/cm/deal-notes`, `/api/cm/investor-demands*`, `/api/cm/kyc-documents`, `/api/cm/intake/generate`, `/api/cm/listings*`, `/api/cm/vitrine` e `/api/partner/sdr/*` **exceto `/api/partner/sdr/addon-status`**, usada também por Minha Assinatura em `components/minha-assinatura/minha-assinatura-client.tsx:109`, tela que o Enterprise mantém) passam a devolver 403 para ENTERPRISE, com um helper único `bloqueiaEnterprise(role)`; antes de editar cada rota, conferir no código se ela é usada por outra tela que o Enterprise mantém (se for, a rota fica e isso é registrado no PR).
2. **Comissões liberada para ENTERPRISE** (`app/(platform)/comissoes/page.tsx`):
   - **Master**: vê as comissões dele como qualquer partner (`commissions.partner_id = master`, mesmas colunas, mesmo client `components/financeiro/comissoes-partner-client.tsx`, ordem `created_at` desc como hoje). Acima da lista, o quadro **"Comissão da equipe"**: cada usuário (nome, ativo/inativo) com o % editável, **ordem: ativos primeiro, depois nome (`localeCompare("pt-BR")`)**. Campo de %: aceita vírgula decimal pt-BR (ex.: "12,5"), converte para número antes de enviar, 0 a 100, duas casas; mostra o valor salvo com vírgula ("35,00%"). Grava pelo mesmo `PATCH /api/enterprise/usuarios` de hoje (`somenteMaster`, mesma validação `percentualValido` no servidor). **Auditoria nova no PATCH**: hoje a rota não grava log; passa a gravar com `logAuditStrict` aguardado **antes** do update (usuário, % antigo, % novo, quem, quando); se o log falhar, nada é gravado. Se o update falhar depois do log, grava-se um segundo registro de falha (mesmo padrão de `logFalhaAdmin`), para o rastro não mostrar uma mudança que não aconteceu. Ao salvar, confirmação "De 30,00% para 35,00%. Vale para as próximas comissões.". Texto de apoio: "O % vale para as próximas comissões. As já geradas mantêm o % da época." Sem usuários: "Você ainda não tem usuários. Cadastre em Enterprise › Usuários."
   - **Usuário da equipe**: em vez das comissões do master, a página mostra **"Minha comissão"**: as linhas de `enterprise_repasses` dele, com Data (DD/MM/AAAA), Operação, **Sua comissão** (BRL, `Intl` pt-BR) e Situação ("A receber", "Recebido em DD/MM/AAAA", "Cancelado"); totais "A receber", "Recebido" e "Total" em BRL. Datas formatadas com `timeZone: "America/Sao_Paulo"`. Ordem: data desc. **A página (componente de servidor) monta e entrega ao client só esses 4 campos por linha e os 3 totais**: `comissaoMaster`, `percentual` e `porUsuario` de `listarRepasses` são descartados no servidor e não vão serializados ao navegador. Estado vazio: "Nenhuma comissão ainda. Ela aparece aqui quando uma operação sua for liberada."
   - Leads do Marketplace: para ENTERPRISE a consulta a `marketplace_leads` nem é feita (o Marketplace não é do Enterprise).
3. **Minimização no servidor**: para o usuário da equipe, `GET /api/enterprise/repasses` e `GET /api/enterprise/repasses/pdf` deixam de devolver `comissaoMaster` e `percentual` (e o PDF perde as colunas "Comissão Enterprise" e "%"). Master e ADMIN continuam recebendo tudo.
4. **/enterprise só para o master**: o item "Enterprise" do menu passa a ser só do master. Como master e equipe têm o mesmo papel ENTERPRISE (o que muda é `enterprise_id`, nulo no master), o layout da plataforma calcula no servidor `ehMasterEnterprise` a partir de `whiteLabelDaSessao()` (`contextoEnterprise`, já usado no layout) e passa por `PlatformShell` ao `Sidebar` como prop; o item "Enterprise" exige `role === "ENTERPRISE" && ehMasterEnterprise` (o usuário da equipe já tem "Comissões"); `/enterprise` acessado por usuário da equipe redireciona para `/comissoes`. O modo ADMIN não muda.

## IMPACT
- Arquivos: `components/layout/sidebar.tsx`; `components/layout/platform-shell.tsx` e `app/(platform)/layout.tsx` (prop `ehMasterEnterprise`); `app/api/enterprise/usuarios/route.ts` (auditoria no PATCH); `app/(platform)/{meus-compradores,meus-ativos,indicacoes,bolsa,meu-atendimento-ia,comissoes,enterprise}/page.tsx`; rotas de API do item 1; `lib/enterprise-bloqueio.ts` (novo, helper); `components/financeiro/comissoes-partner-client.tsx` e `components/financeiro/comissao-equipe-enterprise.tsx` + `components/financeiro/minha-comissao-enterprise.tsx` (novos); `app/api/enterprise/repasses/route.ts` e `.../pdf/route.ts`; `components/enterprise/enterprise-client.tsx` (aba "Meus repasses" sai, já que o usuário não entra mais em /enterprise).
- Tabelas: nenhuma alteração. Leitura de `commissions`, `enterprise_repasses`, `profiles` pelo servidor, como hoje.
- Sem migration.

## UX: ONDE O USUÁRIO VÊ ISSO
- Master e equipe da AGS: o menu não mostra mais Meus Compradores, Meus Ativos, Indicações, Bolsa de Ativos e Atendimento IA; link direto cai em "Acesso negado".
- Master da AGS, menu **Comissões**: quadro "Comissão da equipe" com os usuários e o %; abaixo, as comissões dele (55%) como qualquer partner. Menu **Enterprise** continua.
- Usuário da equipe AGS, menu **Comissões**: "Minha comissão", só com o valor dele e a situação. Sem o item Enterprise no menu.
- Partners da V3 e equipe interna: nada muda.

## DEPENDENCIES
- Nenhuma migration. `PATCH /api/enterprise/usuarios` e `listarRepasses` já existem.

## RISKS
- Acesso (6.5): leitura feita no servidor com o cliente de serviço filtrando por dono, como hoje para os partners (`commissions.partner_id = user.id`; repasses por `usuario_id` ou `enterprise_id` da sessão). A RLS por dono segue no BRIEF de acompanhamento até 05/12/2026.
- Margem do master: o usuário deixa de ver o valor do master e o % na tela, no PDF, na API e no payload da página. **Limite assumido (caminho (a) do QA)**: no banco, pela RLS existente (`enterprise_repasses_select` com `usuario_id = auth.uid()`, migration 20260924 l.64, e `profiles_select_own`), o próprio usuário ainda consegue ler o próprio % com a sessão dele pela REST. A ocultação é de tela e API, não de banco; fechar isso exige migration (revoke de coluna ou view), fora desta entrega. Risco aceito a registrar no go.
- Regressão: o Enterprise perde 5 telas que hoje usa; se o Marciano usa alguma (ex.: Bolsa de Ativos), perde o acesso. Dados criados por ele nessas telas continuam no banco, só não ficam visíveis a ele.
- APIs: rota compartilhada com outra tela do Enterprise não pode ser bloqueada; conferência rota a rota antes de editar.
- Mudança de % no quadro novo: mesmo efeito de hoje (só próximas comissões); texto de apoio deixa isso claro.

## APPROACH
- Escolhida: menu e páginas sem as 5 telas + 403 nas APIs exclusivas; Comissões com duas visões (master e equipe) reutilizando os dados de comissão e de repasse que já existem; minimização no servidor.
- Descartada: só esconder do menu (o link direto continuaria abrindo). Descartada: nova tabela de comissão por usuário (o repasse já é exatamente isso).

## PLANO DE TESTE
- Usuário de teste AGS: menu sem os 5 itens e sem Enterprise; payload da página `/comissoes` (RSC) sem `comissaoMaster`, `percentual` e `porUsuario`; Minha Assinatura continua abrindo (`addon-status` não bloqueada); links diretos dos 5 → `/unauthorized`; `/enterprise` → `/comissoes`; Comissões mostra "Minha comissão" (vazio hoje); `GET /api/enterprise/repasses` sem `comissaoMaster` e `percentual`; uma API do item 1 (ex.: `/api/cm/vitrine`) → 403.
- Master AGS (pelo modo ADMIN só o que já existe; tela de Comissões com login do master ou conferência da resposta da rota): quadro "Comissão da equipe" lista o usuário de teste; mudar o % com vírgula ("12,5") grava 12,50 e cria registro em `audit_logs` com % antigo e novo; falha do log impede a gravação; comissões do master aparecem.
- Partner V3: menu e Comissões iguais a hoje; Bolsa e Atendimento IA abrem.
- ADMIN: Comissões e /enterprise (modo ADMIN) iguais a hoje.
- Sem sessão: `/comissoes` → `/login`.

## ESTIMATE
M. 3 a 4 horas. Confiança média (conferência das rotas de API uma a uma).

## PARECER DE COMPLIANCE
[VALIDAR COM ROBSON]: a Decisão 2 esconde do usuário da equipe (pessoa física) o % que define a remuneração dele. Pergunta: há problema de LGPD (acesso do titular ao próprio dado) ou da relação contratual Enterprise × usuário em não mostrar o % na tela? Bloqueia até a resposta (data, quem, texto) ou "go mesmo assim" do Hamilton/João com esta falha aceita. Se o Robson disser que o usuário deve ver o próprio %, a Decisão 2 volta ao Hamilton (opção "comissão dele + %").

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (23/11): BLOQUEADO, 9 falhas: (1) menu sem fonte de master × equipe → `ehMasterEnterprise` do layout; (2) payload da página → só 4 campos cortados no servidor; (3) % ainda legível no banco → caminho (a), risco aceito declarado; (4) PATCH sem auditoria → logAuditStrict antes do update; (5) % sem vírgula → pt-BR declarado; (6) datas → DD/MM/AAAA America/Sao_Paulo; (7) ordem do quadro → ativos e nome; (8) Impacto → componente certo, addon-status fora do bloqueio, layout/shell incluídos; (9) Robson → [VALIDAR COM ROBSON] no Parecer. Sugestões aplicadas: confirmação ao salvar %, consulta de marketplace não feita, BRL.

Rodada 2 de 6 (23/11): BLOQUEADO, zero falhas técnicas; 2 dependências humanas: [VALIDAR COM ROBSON] (usuário não vê o próprio %) e aceite escrito do risco (a) (% ainda legível no banco pelo próprio usuário). Sugestões aplicadas: registro de falha se o update falhar depois do log, cabeçalho atualizado.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO na rodada 2 de 6 (23/11/2026), zero falhas técnicas, 2 dependências humanas aceitas abaixo.
- Falhas aceitas pelo Hamilton em 23/11/2026, texto capturado pelo gate: "go mesmo assim: aceito seguir sem o parecer do Robson sobre o usuário da equipe Enterprise não ver o próprio % na tela, e aceito o risco de o % continuar legível no banco pelo próprio usuário, com o fechamento no banco em BRIEF futuro com migration".
  - [VALIDAR COM ROBSON] seguir sem parecer (o Robson continua devendo ser consultado).
  - [6.5] risco (a): % legível no banco pelo próprio usuário; fechamento em BRIEF futuro com migration.
- Go: "go mesmo assim" do Hamilton, 23/11/2026 (válido até 24/11 05:35 UTC)
- Migration aplicada em produção: não se aplica

## NOTA DE IMPLEMENTAÇÃO (23/11/2026)
- Rotas bloqueadas para ENTERPRISE (403, `lib/enterprise-bloqueio.ts`): 42 arquivos, 64 funções em `/api/cm/deal-notes`, `/api/cm/investor-demands/**`, `/api/cm/kyc-documents/**`, `/api/cm/listings/**`, `/api/cm/vitrine` e `/api/partner/sdr/**`.
- **Fora do bloqueio, por serem usadas por telas que o Enterprise mantém ou por não terem usuário logado**: `/api/cm/intake/generate` (usada também pelo CRM, `components/crm/crm-client.tsx:1355`), `/api/partner/sdr/addon-status` (Minha Assinatura), `/api/partner/sdr/telegram-webhook/*` e `/api/partner/sdr/meta-oauth/callback` (retornos automáticos externos).
- PDF de repasses (`/api/enterprise/repasses/pdf`): em vez de tirar colunas, passa a ser só do master e do ADMIN (403 para a equipe, "Sua comissão está em Comissões."); mais restritivo que o texto, mesma intenção.
- A aba "Meus repasses" continua no código de `enterprise-client.tsx`, mas fica inalcançável: a equipe é redirecionada de `/enterprise` para `/comissoes`.
- PATCH `/api/enterprise/usuarios`: o log antes da gravação cobre todo campo alterado (%, nome, telefone, ativo), não só o %.
