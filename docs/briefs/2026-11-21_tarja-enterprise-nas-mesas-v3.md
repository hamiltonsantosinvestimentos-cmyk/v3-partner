# BRIEF: Tarja do Enterprise nas propostas, nas mesas da V3

> Data: 2026-11-21 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO pelo QA (rodada 2), aguardando go
> Salvar em `docs/briefs/2026-11-21_tarja-enterprise-nas-mesas-v3.md` e commitar junto com o código.

## PEDIDO DO HAMILTON (21/11/2026, no chat)
"quando o enterprise e usuarios cadastram a proposta, na mesa do admin da V3 deve aparecer tarja da cor do enterprise e com o nome para avisar que a proposta é deles"

## SITUAÇÃO HOJE (conferida pelo QA rodada 1)
- `credit_desk_proposals.partner_id` → `profiles`. `app/api/credit-proposals/route.ts` usa `PROPOSAL_SELECT` (linha 91) com `partner:profiles!partner_id(id, full_name, role)` para **todos** os papéis (linhas 101, 125, 134); `ADMIN_ROLES` (linha 29) e `isAdmin` (linha 117) definem a visão interna.
- Leitores de proposta nas mesas:
  - `app/(platform)/mesa-operacional/page.tsx:77-82`: carga inicial no servidor (`select("*, partner:profiles!partner_id(id, full_name)")`), atende equipe interna (`acesso.tipo === "equipe"`) e papel comum (filtro por `partner_id`);
  - `components/mesa-operacional/mesa-op-client.tsx:1565` (refetch) e mapeamento `1580-1595`; views `kanban | tickets | contratos | dashboard | instituicoes` (linha 1558): **propostas só aparecem no Kanban**;
  - Mesa de Crédito N2/N3: páginas fazem `select("*")` sem partner; o `partner_name` vem do refetch `/api/credit-proposals?level=` em `credit-desk-client.tsx:115`, mapeado em `127-165`; tem Kanban e tabela (coluna "Parceiro");
  - Mesa de Crédito N1: `components/mesa-credito/nivel1-client.tsx` (refetch na linha 90, mapeamento ~95-130), Kanban e tabela;
  - Modal da proposta (`proposta-detail-modal.tsx:3881-3886`), aberto com `isAdmin={currentUser?.role === "ADMIN"}` (`credit-desk-client.tsx:458`, `nivel1-client.tsx:379`, `mesa-op-client.tsx:3100`, `crm-client.tsx:4095`);
  - Pedidos de Partners: `app/api/credit-engine/orders/route.ts` (já 403 para não interno, `ALLOWED_ROLES` linha 10), joins `partner:profiles!partner_id(full_name)` e `ref_partner:profiles!ref_partner_id(full_name)`; tela mostra `quem = ref_partner_name ?? partner_name` (`pedidos-partners-client.tsx:50`).
- Troca de partner pelo modal de reclassificação (`mesa-op-client.tsx:1410-1428`) e nova proposta pela Mesa (`2082-2100`) atualizam o card só no estado local.
- Cor do Enterprise: `profiles.white_label_tema.cor_principal` (BRIEF do tema, em QA). Nome: `nomeDaMarca` (BRIEF da aba Enterprises, liberado; **este BRIEF só começa depois do merge dele**).

## SCOPE
Só para a equipe interna (ADMIN, GESTAO, MESA_OPERACIONAL), proposta cujo partner é do Enterprise (master: `role = 'ENTERPRISE'` e `enterprise_id` nulo; equipe: `enterprise_id` não nulo) ganha uma **tarja** com nome e cor do Enterprise em:
1. **Mesa Operacional › Painel, Kanban**: card da proposta.
2. **Mesa de Crédito N1, N2 e N3**: card do Kanban e tabela (selo na coluna "Parceiro", ao lado do nome).
3. **Modal da proposta** (de qualquer mesa): cabeçalho e seção do partner.
4. **Mesa Operacional › Pedidos de Partners**: selo ao lado do nome exibido.
5. **Filtro "Origem"** no Kanban da Mesa Operacional e nas Mesas de Crédito.
Fora desta entrega (registrado): Relatório mensal (vai por e-mail ao partner; exigiria o mesmo gate), Chat Partners (cartão de proposta), E-mails enviados às instituições, painel "Volume por parceiro" do dashboard da Mesa Operacional. Partner e login Enterprise não veem a tarja.

## IMPACT
- `lib/enterprise.ts`: `marcasDosPartners(db, partnerIds: string[])` → `Map<partnerId, { nome, cor, corTexto, papel: "master" | "equipe" } | null>`. Faz **uma** consulta `profiles(id, role, enterprise_id)` para os partners e **uma** para os masters (`id, full_name, white_label_nome, white_label_tema`, tema em select separado e tolerante: coluna ausente ou tema inválido = sem tema). O cálculo de cor e contraste fica num módulo puro `lib/enterprise-cor.ts` (usável no navegador, sem nada de servidor). Cor da tarja = `cor_principal`; sem tema = **Navy Médio `#243A66`** (paleta V3). `corTexto` = Cream `#F0ECE4` ou Navy Profundo `#09081A`, o que tiver maior contraste; **se nenhum chegar a 4,5:1, a tarja usa o Navy Médio com Cream** (a cor do cliente fica só na faixa fina de 4 px, sem texto sobre ela).
- `app/api/credit-proposals/route.ts`: **o join do partner não muda** (sem `enterprise_id` na resposta). Depois da consulta, **só se `isAdmin`**, chama `marcasDosPartners` e acrescenta `enterprise: {...} | null` a cada proposta. Vale para GET (lista e `?id=`), e para as respostas do PATCH (troca de partner/reclassificação) e do POST (nova proposta pela Mesa).
- `app/(platform)/mesa-operacional/page.tsx`: acrescenta `enterprise` na carga inicial **só quando `acesso.tipo === "equipe"`**; para papel comum, nada muda.
- Mapeamentos no cliente passam a carregar `enterprise`: `mesa-op-client.tsx:1580-1595`, `credit-desk-client.tsx:127-165`, `nivel1-client.tsx` (~95-130).
- Troca de partner e nova proposta (`mesa-op-client.tsx:1410-1428` e `2082-2100`): o estado local usa o `enterprise` devolvido pelo PATCH/POST; se a resposta não trouxer, chama `recarregarPropostas()`.
- `components/shared/tarja-enterprise.tsx` (novo): `TarjaEnterprise({ nome, cor, corTexto, tamanho: "card" | "linha" | "cabecalho" })`.
- `components/mesa-operacional/mesa-op-client.tsx`: faixa + selo no card do Kanban; filtro "Origem"; busca também pelo nome do Enterprise.
- `components/mesa-credito/credit-desk-client.tsx` e `components/mesa-credito/nivel1-client.tsx`: faixa + selo no card do Kanban; selo na coluna "Parceiro" da tabela; filtro "Origem".
- `components/mesa-credito/proposta-detail-modal.tsx`: tarja exibida **pela presença de `proposal.enterprise`**, não pelo prop `isAdmin` (assim GESTAO e MESA_OPERACIONAL também veem; o campo só existe para papel interno).
- `app/api/credit-engine/orders/route.ts`: joins passam a `partner:profiles!partner_id(id, full_name, role, enterprise_id)` e `ref_partner:profiles!ref_partner_id(id, full_name, role, enterprise_id)` (rota só interna); campo `enterprise` calculado **pelo mesmo partner que a tela exibe** (`ref_partner` se houver, senão `partner`).
- `components/mesa-credito/pedidos-partners-client.tsx`: selo ao lado do nome exibido (`quem`).
- `CLAUDE.md`: no parágrafo "Exceção: tema do Enterprise white label" (criado pelo BRIEF do tema; se ainda não existir quando este PR entrar, criar a exceção na seção Identidade Visual com este texto), acrescentar: "A equipe interna da V3 vê a cor de um cliente Enterprise só dentro da tarja de identificação de propostas desse cliente (faixa de 4 px e selo). Fora disso, telas de usuário V3 seguem a paleta V3."
- Tabelas: nenhuma alterada (sem DDL). Só leitura de `profiles`.

## UX: ONDE O USUÁRIO VÊ ISSO
- **Mesa Operacional › Painel › Kanban** e **Mesa de Crédito N1/N2/N3 › Kanban** (ADMIN, GESTAO, MESA_OPERACIONAL): faixa de 4 px no topo do card na cor do Enterprise (AGS = `#040968`) e selo "ENTERPRISE · AGS FINANCE" (fundo na cor, texto Cream ou Navy pelo contraste, borda de 1 px Cream a 20%), acima do nome do cliente. Abaixo, como hoje, o nome de quem cadastrou.
- **Mesa de Crédito › Tabela**: selo pequeno "AGS FINANCE" ao lado do nome na coluna "Parceiro".
- **Filtro "Origem"** (Todas, padrão / V3 / Enterprise; ordem fixa, não vem do banco), com a contagem de cada opção ("Enterprise (3)"). Combina com a busca e o filtro de etapa existentes por "E". A busca também acha pelo nome do Enterprise.
- **Modal da proposta**: selo no cabeçalho, ao lado do código; na seção do partner, "Fulano · equipe AGS Finance" ou "Marciano Nunes · master AGS Finance".
- **Pedidos de Partners**: selo ao lado do nome exibido.
- **CRM**: o mesmo modal da proposta aberto pelo CRM também mostra a tarja para a equipe interna (o modal decide pela presença do campo).
- **Enterprise sem tema**: selo Navy Médio com o nome em Cream.
- **Tooltip** do selo: "Proposta de cliente Enterprise (AGS Finance). A comissão vai para o master."
- Proposta trocada de partner (de Enterprise para V3 ou o contrário): a tarja muda na hora, ao salvar.
- Estado vazio: não se aplica (marcação em listas existentes); filtro "Enterprise" sem resultados mostra o texto vazio que cada lista já tem.
- Partner da V3 e login Enterprise: nada muda.

## DEPENDENCIES
- BRIEF da aba Enterprises (`nomeDaMarca`): liberado; **merge antes deste**.
- BRIEF do tema (`white_label_tema`): se não estiver no ar, a tarja usa o Navy Médio (leitura tolerante).
- Migrations: nenhuma.

## RISKS (nunca "nenhum")
- **Cor de cliente na tela da V3**: extensão consciente da exceção ao CLAUDE.md, limitada à faixa e ao selo (texto no IMPACT). Aceite com o go.
- **Contraste**: AGS (`#040968`) escuro sobre card navy; mitigado por selo com texto, borda e cor de texto calculada; cor sem contraste cai no Navy Médio.
- **Vazamento**: `enterprise` e `enterprise_id` não vão para quem não é interno (o join não muda; o cálculo é depois e só com `isAdmin`/`acesso.tipo === "equipe"`). Coberto por teste.
- **Tarja desatualizada**: resolvida pelo `enterprise` nas respostas do PATCH/POST ou recarga.
- **Performance**: duas consultas pequenas em `profiles` por carga, só para a equipe interna.
- **Breaking change**: nenhum; campo opcional.
- LGPD: nenhum dado pessoal novo.

## APPROACH
- Escolhida: calcular a marca no servidor depois da consulta, só para a equipe interna, e um componente de tarja reaproveitado.
- Descartada 1: gravar a marca na proposta (coluna nova): duplica dado, migration, fica velho se a marca mudar.
- Descartada 2: só ícone, sem cor: o pedido é a cor do Enterprise.
- Descartada 3: trazer `enterprise_id` no `PROPOSAL_SELECT`: vazaria o campo para partners.

## PLANO DE TESTE
- Proposta de usuário da equipe de um master de teste com tema: ADMIN, GESTAO e MESA veem a tarja no Kanban da Mesa Operacional, no Kanban e na tabela das Mesas N1/N2/N3, no modal e em Pedidos.
- GESTAO e MESA_OPERACIONAL veem a tarja no modal (não depende de `isAdmin`).
- Proposta do próprio master: tarja; modal diz "master".
- Master sem tema: selo Navy Médio com o nome; sem nome de marca: nome do master.
- Proposta de partner V3: sem tarja.
- PATCH de proposta feito por PARTNER: a resposta não traz `enterprise`.
- **JSON de `GET /api/credit-proposals` como PARTNER e como ENTERPRISE: sem `enterprise` e sem `partner.enterprise_id`. HTML/payload de `/mesa-operacional` aberto por um partner: sem os dois.**
- Trocar o partner de uma proposta de Enterprise para V3 pelo modal de reclassificação: tarja some ao salvar; ao contrário, aparece. Nova proposta criada pela Mesa para usuário Enterprise: tarja aparece.
- Pedido com `ref_partner` Enterprise e `partner` V3: tarja segue o nome exibido.
- Filtro Origem combinado com busca e etapa; contagens certas; busca por "AGS" acha as propostas da AGS.
- Contraste do selo ≥ 4,5:1 com `#040968`, com uma cor clara e com uma cor intermediária (cai no Navy Médio).

## ESTIMATE
M. Cerca de 4 horas. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal novo: a tarja mostra à equipe interna da V3 o nome comercial e a cor de um cliente Enterprise em propostas que a V3 já vê.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (21/11): BLOQUEADO, 5 falhas: (1) leitores e gate por papel → todos os leitores listados, join sem `enterprise_id`, cálculo só interno, modal pela presença do campo, testes de vazamento; (2) "lista da Mesa Operacional" não existe → escopo corrigido (Kanban da Mesa Op; Kanban + tabela das Mesas de Crédito); (3) tarja desatualizada → PATCH/POST devolvem `enterprise`; (4) Pedidos → partner exibido define a tarja, joins ampliados; (5) CLAUDE.md e cor neutra → texto no IMPACT, neutro = Navy Médio. Sugestões aplicadas: fallback de contraste, Cream no lugar de branco, filtro combinado com contagem, busca pelo Enterprise, telas fora do escopo registradas.
Rodada 2 de 6 (21/11): **LIBERADO**, zero falhas. Sugestões aplicadas: campo `papel` (master/equipe), módulo puro `lib/enterprise-cor.ts`, CLAUDE.md com fallback se o parágrafo do tema não existir, teste do PATCH por partner, nota do CRM. Ordem de merge: depois do PR da aba Enterprises (usa `nomeDaMarca`).

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO, rodada 2, 21/11/2026
- Go: Hamilton, 22/11/2026 (capturado pelo hook).
- Nota de implementação: a tabela das Mesas de Crédito na tela não tem coluna "Parceiro" (ela só existe no export); o selo foi posto abaixo do nome do cliente, na coluna "Cliente". Pedidos de Partners não precisou ampliar os joins: a rota já tem `partner_id` e `ref_partner_id` e calcula a tarja com `marcasDosPartners`.
- Migration aplicada em produção: não se aplica
