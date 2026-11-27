# BRIEF: Aba "Mesa Operacional" do master Enterprise (só acompanhar as operações da equipe)

> Data: 2026-11-26 | Autor: Claude (pedido do Hamilton: "quero que aparece a aba mesa operacional para o master a AGS, para ele ver todas as operações dos usuarios deles"; escolha: "Só acompanhar") | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md` e commitar junto com o código.

## SCOPE
Criar para o **master** de um Enterprise (role ENTERPRISE com `enterprise_id` nulo, como o Marciano da AGS) uma aba **"Mesa Operacional"** no menu. Ela mostra, **só para acompanhar**, todas as operações de crédito dele e dos usuários da equipe dele, num Kanban pelas etapas da mesa:
- Recebido
- Triagem
- Análise
- Pendência
- Avaliação de Imóvel
- Aprovação
- Contrato Assinado
- Registro de Imóveis
- Recurso Liberado

Há ainda uma coluna "Encerradas", para as propostas reprovadas ou declinadas.

A regra de coluna é a mesma da Mesa Operacional da V3 (`mesa-op-client.tsx:2370-2380`):
- etapa REPROVADO ou DECLINADO vai para Encerradas;
- etapa legada FINALIZADO segue o status: REJECTED ou CANCELLED vão para Encerradas, os demais para Recurso Liberado;
- etapa nula ou desconhecida vai para Recebido;
- as demais vão para a própria etapa.

Ao clicar num card abre uma janela de leitura. **Nada pode ser movido, aprovado, comentado ou enviado.**

A rota é nova (`/enterprise/mesa-operacional`) e **não** reaproveita a Mesa Operacional interna da V3 (`/mesa-operacional`), que continua só para ADMIN, GESTAO e MESA_OPERACIONAL, sem nenhuma mudança.

O que cada proposta mostra vem da **visão do partner** que já existe e foi aprovada (`lib/api-v1/visao-partner.ts`, decisão do Hamilton de 06/11/2026). Ela é montada campo a campo a partir de uma lista fechada, mascara o CPF/CNPJ e **não traz** nada interno da V3: comentários internos da mesa, instituições encaminhadas e feedback de instituição, percentuais de comissão, mandato, cobrança e o resto de `metadata`. A única informação a mais é **qual usuário da equipe originou** a proposta.

Os usuários comuns da equipe (não master) não ganham a aba.

## IMPACT
- Arquivos afetados:
  - `app/(platform)/enterprise/mesa-operacional/page.tsx` (novo, servidor):
    - confere a sessão e o master (`contextoEnterprise(...).ehMaster`); quem não é master vai para `/unauthorized`;
    - lê as propostas da equipe com as colunas fechadas `COLUNAS_VISAO`;
    - monta cada card com `visaoDoPartner` mais o nome do originador;
    - entrega ao cliente só o resultado.
  - `lib/enterprise/mesa-equipe.ts` (novo, puro e testável):
    - `cardDaEquipe(linha, opts)` monta a partir de `visaoDoPartner`, remove `link_analise_credito` e acrescenta `originador`;
    - `colunaDoCard(etapa, status)` decide a coluna pela regra do SCOPE;
    - `resumoDaMesa(cards)` dá a contagem por coluna, o total de ativas (sem Encerradas), o total de Encerradas e o valor solicitado total **só das ativas**. Valor nulo soma 0;
    - `dataBR(iso, comHora)` formata em DD/MM/AAAA, ou DD/MM/AAAA HH:mm, com `timeZone: "America/Sao_Paulo"`. Nulo ou inválido vira "Não informado";
    - `ordenarUsuarios(lista, masterId)` monta o filtro;
    - `acessoMesaEquipe(user, ctx)` é a decisão de acesso, função pura: `"login"`, `"negado"` ou `"master"`.
  - `components/enterprise/mesa-equipe-client.tsx` (novo): Kanban de leitura, filtro por usuário da equipe, busca por cliente ou código, janela de detalhe só de leitura.
  - `components/layout/sidebar.tsx`: item novo `{ href: "/enterprise/mesa-operacional", label: "Mesa Operacional", icon: "Headphones", roles: ["ENTERPRISE"] }`, visível só para o master. A regra de "só master" que hoje vale para `/enterprise` passa a valer para os dois hrefs, por uma lista `HREFS_SO_MASTER`.
  - `components/layout/topbar.tsx`: título "Mesa Operacional" para a rota nova.
  - `tests/unit/mesa-equipe.test.ts` (novo).
- Tabelas afetadas: nenhuma alteração. Só leitura de:
  - `credit_desk_proposals`, com as colunas de `COLUNAS_VISAO` e filtro `partner_id in (idsDaEquipe(master))`;
  - `profiles` (nomes da equipe);
  - `portfolio_linhas` (checklist de documentos).
- Rotas afetadas: só a página nova. Nenhuma API nova; a página é server component.
- APIs e integrações afetadas: nenhuma.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: o master entra (por agsfinance.app ou pelo app da V3) e vê no menu lateral o item **"Mesa Operacional"**, logo abaixo de "Enterprise".
- Na tela:
  - topo com o título "Mesa Operacional" e o subtítulo "Operações da sua equipe, em tempo real. Só acompanhamento: a análise é feita pela mesa.";
  - contadores por etapa, o total de operações ativas, o de Encerradas (separado) e o valor solicitado das ativas;
  - filtro "Usuário": "Todos" primeiro, depois "Você" (o master), depois os usuários por `full_name` com `localeCompare("pt-BR", { sensitivity: "base" })`; quem não tem nome aparece no fim como "Usuário sem nome";
  - busca por cliente ou código;
  - dentro de cada coluna, os cards ficam por última atualização, da mais recente para a mais antiga, também depois de filtrar ou buscar;
  - coluna sem cards mostra "Nenhuma operação nesta etapa".
- Formatos:
  - valores como `"R$ " + formatCurrencyBRLFromNumber(v)` (lib/utils.ts) no card, no valor aprovado e no total (o formatador não põe o símbolo); valor nulo aparece como "Não informado", nunca "R$ 0,00" nem "NaN";
  - datas com `dataBR` (fuso de São Paulo): DD/MM/AAAA para criação e atualização, e DD/MM/AAAA HH:mm para "desde" das pendências e para o recebimento de documentos; nula aparece como "Não informado";
  - documentos pendentes e recebidos aparecem pelo **nome** do documento (de `documentosDaLinha`), não pelo id técnico do checklist; id sem correspondência (anexo do chat, id antigo) aparece como "Outro documento";
  - originador sem nome aparece como "Usuário sem nome", no card e no filtro.
- Card:
  - código e nome do cliente;
  - CPF/CNPJ mascarado (`***.456.789-**` ou `12.345.678/****-**`);
  - linha de crédito;
  - valor solicitado (R$, máscara BRL) e valor aprovado, quando houver;
  - usuário que originou;
  - documentos "X de Y enviados";
  - selo "Pendência" quando houver pendência aberta;
  - data da última atualização.
- Janela do card (só leitura), com tudo o que está no card e mais:
  - prazo e finalidade;
  - pendência aberta (motivo, responsável, desde quando);
  - pendências de documentos (documento, motivo, desde quando);
  - documentos recebidos (tipo, nome do arquivo, data, **sem link para baixar**);
  - documentos que faltam;
  - data de criação.

  Rodapé: "Para tratar uma pendência, o usuário responsável abre a proposta na Mesa de Crédito."
- Estado vazio:
  - sem propostas: "Nenhuma operação da equipe ainda. As propostas criadas por você e pelos usuários da sua equipe aparecem aqui.";
  - busca ou filtro sem resultado: "Nenhuma operação encontrada com esse filtro."
- Sem UI? Não, é uma tela.
- Nota do porquê: o subtítulo explica que a tela é só de acompanhamento.

## DEPENDENCIES
- Deve existir antes: `contextoEnterprise` e `idsDaEquipe` (lib/enterprise.ts) e `visaoDoPartner` com `COLUNAS_VISAO` (lib/api-v1/visao-partner.ts). Tudo já está no ar.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - a Mesa Operacional interna da V3 não muda;
  - a única mudança em tela existente é no menu: `/enterprise` passa a usar a lista `HREFS_SO_MASTER`, com o mesmo resultado de hoje para `/enterprise`.
- LGPD e compliance:
  - o master passa a ver, numa tela só, os clientes dos usuários da equipe dele: nome, CPF/CNPJ **mascarado**, linha, valores, pendências e nomes dos documentos;
  - hoje ele já vê essas mesmas propostas da equipe no Kanban da Mesa de Crédito N1/N2/N3 (`idsDaEquipe`, BRIEF de 23/11) e no Relatório Mensal, então não surge destinatário novo do dado. A tela nova mostra **menos** do que ele já tem, porque o CPF/CNPJ vem mascarado e não há link para baixar documento;
  - o vínculo do usuário é com o Enterprise (contrato de Parceria v2.4), e quem responde pelo trabalho da equipe é o master;
  - sem `[VALIDAR COM ROBSON]` novo. Registro no Parecer.
- Segurança de acesso ao banco (anon, RLS, views, funções):
  - a leitura usa a service role no servidor, como as outras telas de proposta;
  - por isso o acesso é decidido no código: sessão obrigatória, role ENTERPRISE e `ehMaster` verdadeiro, senão `/unauthorized`;
  - o filtro de proposta é sempre `partner_id in idsDaEquipe(master)`, que inclui o próprio id e nunca devolve a rede inteira;
  - as colunas lidas são só as de `COLUNAS_VISAO`, nunca `*`;
  - nada é escrito;
  - nenhuma política, grant, view ou função muda.
- Instituições parceiras: nem `instituicao_encaminhada` nem `instituicao_feedback` estão em `COLUNAS_VISAO`, e `visaoDoPartner` não lê `metadata` além de `client_type`, `prazo`, `finalidade` e `pendencias_ocr`. O nome de instituição parceira não chega à tela.
- Pendência com texto interno: o motivo da pendência (`pending_reason`) é o mesmo que o próprio partner já vê na Mesa de Crédito e na API. Ele é escrito pela mesa para quem originou e não muda aqui.
- Performance: uma consulta por abertura de tela, com limite de 500 propostas (as mais recentes). Acima disso aparece o aviso "Mostrando as 500 operações mais recentes". A AGS tem dezenas.
- Vercel timeout (60s): não se aplica.
- Equipe com papel trocado: `idsDaEquipe` inclui qualquer perfil com `enterprise_id` = master, sem conferir o papel. Um usuário que mudou de papel e manteve o `enterprise_id` continuaria aparecendo para o master. É o mesmo comportamento da Mesa de Crédito de hoje, e fica aceito aqui. Corrigir isso vira BRIEF próprio, porque muda também o N1/N2/N3.
- Outro:
  - o modo ADMIN (`?master=`) não entra neste BRIEF. O ADMIN continua usando a Mesa Operacional da V3;
  - "Minhas Operações" continua mostrando só as operações do próprio usuário.

## APPROACH
- Abordagem escolhida: tela nova, só de leitura, montada com a visão do partner que já existe (lista fechada e testada), com filtro pela equipe do master.
- Alternativas descartadas:
  - **Abrir a Mesa Operacional da V3 filtrada pela equipe:** expõe ações e dados internos (mover etapa, aprovar, mandato, cobrança, comentários, instituições). O Hamilton escolheu "Só acompanhar".
  - **Ampliar "Minhas Operações":** é uma lista, não o Kanban por etapa que o pedido descreve ("aba mesa operacional").
  - **Nova projeção de campos só para esta tela:** duplicaria a lista fechada. Reaproveitar `visaoDoPartner` mantém uma regra só para "o que o lado do partner vê".

## DESENHO TÉCNICO
```ts
// lib/enterprise/mesa-equipe.ts (puro)
import { visaoDoPartner } from "@/lib/api-v1/visao-partner";
import { SLA_STAGES, SLA_STAGE_LABELS } from "@/lib/mesa-operacional-sla";
export const COLUNAS = [...SLA_STAGES, "ENCERRADAS"] as const;
export function colunaDoCard(etapa: string, status: string): (typeof COLUNAS)[number]
  // REPROVADO|DECLINADO → "ENCERRADAS"
  // FINALIZADO → status REJECTED|CANCELLED ? "ENCERRADAS" : "LIBERADO"
  // etapa em SLA_STAGES → etapa; vazia ou desconhecida → "RECEBIDO"
export function cardDaEquipe(linha, opts: { portfolio; nomes: Map<string, string> }) {
  const { link_analise_credito: _omitido, ...v } = visaoDoPartner(linha, { portfolio: opts.portfolio, access: false });
  return { ...v, originador: opts.nomes.get(String(linha.partner_id)) ?? "Usuário", coluna: colunaDoCard(v.etapa, v.status) };
}
export const CAMPOS_CARD = [...CAMPOS_PERMITIDOS sem "link_analise_credito", "originador", "coluna"];
export function resumoDaMesa(cards): { porColuna: Record<coluna, number>; ativas: number; encerradas: number; valorSolicitadoAtivas: number }
export function dataBR(iso: string | null, comHora = false): string     // Intl pt-BR, timeZone America/Sao_Paulo; nulo/inválido → "Não informado"
export function ordenarUsuarios(u: { id: string; nome: string | null }[], masterId: string)
  // [{ id: "todos", rotulo: "Todos" }, { id: masterId, rotulo: "Você" }, ...demais (masterId excluído) por nome pt-BR base, sem nome no fim ("Usuário sem nome")]
export function acessoMesaEquipe(user: { id?: string } | null, ctx: { ehMaster: boolean } | null): "login" | "negado" | "master"
// nomes dos documentos: cardDaEquipe troca ids de documentos_pendentes e tipo_documento pelo nome de documentosDaLinha

// app/(platform)/enterprise/mesa-operacional/page.tsx (server)
//  user = auth.getUser(); sem user → /login
//  svc = service role; ctx = contextoEnterprise(svc, user.id); acessoMesaEquipe(user, ctx): "login" → /login, "negado" → /unauthorized
//  ids = await idsDaEquipe(svc, user.id)              // [master, ...usuários]
//  { data } = svc.from("credit_desk_proposals").select(COLUNAS_VISAO).in("partner_id", ids)
//             .order("updated_at", { ascending: false }).limit(500)
//  semAnaliseDoSite(data) (mesma exclusão da Mesa Operacional e de "Minhas Operações")
//  nomes = profiles(id, full_name).in("id", ids); portfolio = portfolio_linhas ativos
//  cards = data.map(l => cardDaEquipe(l, { portfolio, nomes })) → <MesaEquipeClient cards usuarios limite />
//  erro de consulta → tela de erro "Não foi possível carregar as operações agora." (sem dado parcial)

// components/layout/sidebar.tsx
//  const HREFS_SO_MASTER = ["/enterprise", "/enterprise/mesa-operacional"];
//  (HREFS_SO_MASTER.includes(item.href) && role === "ENTERPRISE" ? enterpriseMaster : item.roles.includes(role))
```
Reversão: reverter o PR. Não há migration.

## PLANO DE TESTE
- `tests/unit/mesa-equipe.test.ts`:
  - `colunaDoCard`:
    - cada etapa de SLA_STAGES;
    - REPROVADO e DECLINADO vão para Encerradas;
    - FINALIZADO com APPROVED vai para Recurso Liberado, e com REJECTED ou CANCELLED vai para Encerradas;
    - etapa vazia ou desconhecida vai para Recebido;
  - `resumoDaMesa`: Encerradas fora do total e do valor; valor nulo soma 0;
  - `dataBR`: "2026-11-26T23:30:00-03:00" vira "26/11/2026" (sem virar 27 por causa do UTC); nulo e lixo viram "Não informado";
  - `ordenarUsuarios`: Todos, Você e os demais em ordem pt-BR ("Álvaro" antes de "Bruno"), sem nome no fim;
  - `acessoMesaEquipe`: sem user dá "login"; ctx nulo (PARTNER, ADMIN, sem perfil) dá "negado"; usuário da equipe (ehMaster falso) dá "negado"; master dá "master";
  - `cardDaEquipe`: as chaves do card são exatamente `CAMPOS_CARD` (paridade, como o teste da API);
  - `cardDaEquipe` sem `link_analise_credito`, com CPF mascarado;
  - uma linha com `instituicao_encaminhada`, `comissao_*`, `mesa_comments` e `metadata` cheio não deixa nenhum desses valores no card (busca do valor no JSON do card);
  - nomes de documento no lugar dos ids.
- Build da Vercel e o teste automático de telas.
- Em produção, com o usuário de teste como master do "AGS Teste" (teste em andamento, BRIEF 2026-11-26_usuario-teste-master-ags-teste). O Hamilton entra, porque o agente não faz login:
  - vê o item "Mesa Operacional" no menu e a tela com o estado vazio (o "AGS Teste" tem 0 propostas);
  - um usuário comum de Enterprise não vê o item, e a URL direta leva a `/unauthorized`.
- Com dados reais: depois de o teste ser revertido, o Marciano (ou o Hamilton pelo modo ADMIN em BRIEF futuro) vê as operações da equipe AGS. O agente confere por leitura no banco que o número de propostas da equipe bate com os contadores.
- Não testável pelo agente: o login como master.

## ESTIMATE
M. Cerca de 3h. Confiança alta (reaproveita a visão do partner e a regra de equipe).

## PARECER DE COMPLIANCE
26/11/2026, Claude, sem consulta ao Robson por não haver destinatário novo. Não cria destinatário novo de dado pessoal. O master Enterprise já vê as propostas da equipe dele, com CPF completo, na Mesa de Crédito (`idsDaEquipe`, regra do Enterprise desde 24/09/2026, `lib/enterprise.ts`) e no Relatório Mensal. Esta tela mostra um subconjunto mascarado, sem documentos para baixar e sem dado interno da V3, e o nome de instituição parceira não aparece. Pela regra do repositório, dúvida de LGPD vai ao Robson; aqui não surge dúvida nova, então não há `[VALIDAR COM ROBSON]`.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 26/11/2026: BLOQUEADO, com 3 falhas, todas corrigidas nesta versão.
1. Regra de coluna: a primeira versão usava status que não existem. Agora espelha a Mesa da V3 (REPROVADO, DECLINADO, FINALIZADO pelo status), e o total exclui Encerradas.
2. Formato de data: declarado DD/MM/AAAA (e HH:mm) no fuso de São Paulo, com "Não informado" para nulo.
3. Ordem do filtro: Todos, Você e os demais em pt-BR, sem nome no fim; cards por atualização decrescente.

Sugestões aplicadas:
- formatador BRL único e "Não informado" para valor nulo;
- nomes de documento no lugar dos ids;
- placeholder de coluna vazia;
- acesso em função pura testada;
- parecer com data e autor;
- caso do papel trocado registrado;
- contagem de Encerradas separada.

Rodada 2, 26/11/2026: LIBERADO, zero bloqueantes. Sugestões aplicadas (ajuste de texto, sem mudança de escopo):
- prefixo "R$ " antes de `formatCurrencyBRLFromNumber`;
- "Outro documento" para id sem correspondência;
- "Usuário sem nome" igual no card e no filtro;
- masterId excluído da lista de demais.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 2)
- Override: não
- Go dado por: Hamilton, 26/11/2026 ("go para o BRIEF da aba Mesa Operacional do master Enterprise, só acompanhar")
- Nota de implementação: as regras de coluna, resumo e formato (`colunaDoCard`, `resumoDaMesa`, `dataBR`, `valorBR`, `COLUNAS`) ficaram em `app/(platform)/enterprise/mesa-operacional/exibicao.ts`, dentro do escopo liberado. O motivo é que o Kanban (cliente) não pode importar `visao-partner`, que depende de `next/server`. `lib/enterprise/mesa-equipe.ts` reexporta tudo, então a interface do desenho técnico não muda.
- Migration aplicada em produção: não se aplica
