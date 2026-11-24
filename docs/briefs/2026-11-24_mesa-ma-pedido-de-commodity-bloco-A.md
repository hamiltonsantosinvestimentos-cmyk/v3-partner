# BRIEF: Mesa M&A, pedido de commodity (bloco A)

Data: 24/11/2026 · Pedido: diretoria · Prazo do João: 25/11/2026, 8h · Status: QA rodada 2 pendente, depois "go"

## Contexto

A V3 fechou parceria com uma corretora e operadora logística de grãos (identificada só nos registros internos da V3, fora deste repositório público). Papéis definidos pela diretoria em 24/11/2026:

- **Corretora parceira:** vendedora.
- **V3:** compliance e intermediação (mesa de compliance recebe os documentos comerciais).
- **V3 Cargas:** acompanhamento logístico e métricas da operação. Registro em blockchain fica para depois. Agora só métricas e contratos com os intermediadores.

Três blocos, cada um com BRIEF, QA e "go" próprios:

- **A (este):** a Mesa M&A recebe o pedido de commodity (milho, soja, café) e os documentos comerciais (LOI, ICPO, SCO, FCO).
- **B:** cockpit de compliance da operação (empresa, mandatário, intermediários, logística), aberto pela tela de qualificação. Gera a ficha de compliance e o pedido para a corretora parceira. ⚠️ ROBSON: a ficha sai da V3 e exige base legal e resposta escrita dele.
- **C:** depois do contrato assinado (Fase 2), o portal envia a operação ao V3 Cargas. O V3 Cargas amplia o limite do código para aceitar o número inteiro do deal (decisão da diretoria, 24/11/2026).

Pré-requisito: PR #426 (o botão Rápido voltou a mostrar o botão "Criar Operação").

Estado verificado no banco em 24/11/2026: os deals de commodity já abertos não têm nenhum dado de commodity gravado (só `analise_gate_override` ou `transfer_history`) e nenhum documento. Hoje esses dados vivem só em .docx e .xlsx na pasta local.

## SCOPE

1. **Pedido de commodity no deal**, gravado em `ma_deals.asset_data.commodity` (JSONB, sem migration, mesmo padrão de `intermediarios` e `checklist`).
2. **Rápido:** caixa "Pedido de commodity". Marcada, mostra Lado, Produto, Quantidade e Preço por saca. O resto se completa na aba do deal.
3. **Aba "Commodity" no deal da Mesa M&A** com todos os campos, o valor total calculado e a lista de documentos comerciais com situação Recebido ou Pendente.
4. **Rota nova** `PATCH /api/ma/deals/[deal_id]/commodity`: única rota que altera o pedido depois de criado. Valida com Zod e mescla no servidor só a chave `commodity`.
5. **Rotas novas de documentos comerciais** `GET`, `POST` e `DELETE /api/ma/deals/[deal_id]/commodity/documentos`. **Não** usam `/api/ma/documents`, que hoje só exige login (achado do QA, ver Riscos).
6. **Fechar os caminhos antigos para a chave `commodity`:**
   - `PATCH /api/ma-deals`: para qualquer papel, o servidor retira a chave `commodity` do corpo e, na mesma requisição, logo antes do `update`, relê o `asset_data` do banco e mantém a `commodity` que está lá. Uma edição antiga de `asset_data` não apaga nem altera o pedido, e o dono não equipe não muda o pedido nem o `deal_value` por ali.
   - `POST /api/ma-deals`: aceita `commodity` só de ADMIN, GESTAO e MESA, validada pelo mesmo Zod, com o total calculado no servidor. De qualquer outro papel, a chave é descartada.
   - `GET /api/ma-deals`: ao partner originador, `asset_data.commodity` sai com os campos do pedido (é o deal que ele originou, política de 31/10/2026) e só a situação de cada documento (Recebido ou Pendente). Nome de arquivo, caminho e link nunca. Aos demais perfis não equipe, a chave sai do `asset_data`.

### Campos (`asset_data.commodity`)

| Campo | Tipo, regra e gravação |
|---|---|
| Lado | Compra ou Venda (alfabética) |
| Produto | Café, Milho, Soja (alfabética) e "Outro" sempre no fim, com texto livre de até 60 caracteres. O texto livre recusa sequência de 11 ou 14 dígitos (CPF ou CNPJ) e a tela orienta a não pôr nome de empresa |
| Quantidade | Sacas, inteiro de 1 a 10.000.000, separador de milhar. Gravada em `quantidade_sacas` |
| Peso da saca | 50 kg ou 60 kg (padrão 60). Gravado em `peso_saca_g` (50000 ou 60000), formato do V3 Cargas |
| Preço por saca | Máscara única em reais inteiros (`MoneyCurrencyField`, PR #417), valor por extenso, aviso acima de R$ 1 bilhão. Gravado em `preco_saca_centavos` (inteiro) e `moeda` (BRL ou USD). Zod do servidor: maior que zero e até 1.000.000,00 por saca |
| Valor total | Calculado **no servidor** (quantidade × preço) a partir dos campos gravados; o cliente não envia o total. Recusado se passar de 1 trilhão na moeda do campo. Gravado em `ma_deals.deal_value` e `currency`. Mostrado só leitura, com o extenso (`MoneyHint`) |
| Incoterm | CIF, FOB (alfabética) |
| Local de embarque | Texto, até 120 caracteres (cidade · UF) |
| Local de entrega | Texto, até 120 caracteres |
| Início e fim da entrega | Tela em DD/MM/AAAA. Gravadas como texto `AAAA-MM-DD` (só data, sem hora). Exibição por função de texto, nunca por `new Date("AAAA-MM-DD")`. O Zod do servidor recusa fim antes do início |
| Cargas por dia | Inteiro de 1 a 1.000, opcional |
| Modo de pagamento | Direto ou Escrow (alfabética). Gravado como `DIRETO` ou `ESCROW`, formato do V3 Cargas |
| Especificação | Umidade, impureza e avariados em %, de 0 a 100 com 1 casa, opcionais |

Nenhum CPF, CNPJ, nome de pessoa ou dado bancário entra no bloco A: as partes continuam no lote de qualificação (bloco B).

### Documentos comerciais

- **Lista fixa, em ordem de processo (não alfabética):** LOI, ICPO, SCO, FCO, prova de fundos, lastro, laudo de classificação, especificação técnica. O tipo é validado no servidor por lista fechada e gravado em `tipo`, separado de qualquer `category`.
- **Arquivo:** bucket privado `ma-documents`, caminho `{deal_id}/comercial/{uuid}-{nome}`. O `uuid` é único por envio, então um envio novo **nunca** sobrescreve o anterior.
- **Registro:** `asset_data.commodity.documentos[]` com `id`, `tipo`, `nome`, `caminho`, `enviado_por`, `enviado_em`. Fica fora de `ma_documents` de propósito, para não aparecer na rota antiga `/api/ma/documents`.
- **Arquivos aceitos:** PDF, JPG, PNG e DOCX, até 20 MB. Fora disso: "Envie PDF, JPG, PNG ou DOCX de até 20 MB."
- **Envio por link assinado de upload** (a função da Vercel aceita corpo de cerca de 4,5 MB): a rota confere papel, tipo e tamanho e devolve um link de upload de uso único para o caminho `{deal_id}/comercial/{uuid}-{nome}`; o navegador envia o arquivo direto ao bucket; uma segunda chamada confirma que o objeto existe e só então grava o registro. Mesmo padrão da proposta de crédito de 4,8 MB (01/11/2026).
- **Histórico:** cada envio mostra quem enviou e quando, para a Mesa saber qual LOI vale.
- **Situação:** Recebido se existir ao menos um envio ativo do tipo. Vale o envio mais recente; os anteriores ficam no histórico da aba.
- **Excluir documento:** só ADMIN e GESTAO, pelo modal vermelho `confirmar()` da V3 (só fecha por botão), com motivo de 5 a 500 caracteres. O arquivo sai do bucket, o registro fica marcado como excluído (quem, quando, motivo) e tudo vai para `logAudit`.
- **Pasta MPS:** o bloco A **não** publica na pasta MPS. A publicação entra no bloco B, junto com a ficha de compliance.
- **Link do arquivo:** assinado, válido por 10 minutos, só para ADMIN, GESTAO, MESA e MESA_OPERACIONAL. O partner originador vê só a situação antes da Fase 2 (contratos e mandato assinados).

### Trava depois do contrato

`PATCH .../commodity` devolve 409 em mudança de Lado, Produto, Quantidade, Peso, Preço, moeda, Incoterm ou Modo de pagamento quando existir em `operation_contracts`, com `deal_id` igual ao deal e sem exclusão em `deletion_status`, contrato `V3C-ICM` ou `V3C-CVC` com `status_signature` igual a `enviado_assinatura` ou `assinado`. Nesse estado a aba mostra esses campos só para leitura, com a nota "Pedido travado: há contrato enviado ou assinado. Alteração exige novo contrato". Locais, datas, cargas por dia e especificação continuam editáveis, com `logAudit`. A integração com o V3 Cargas (bloco C) depende desta trava.

## IMPACT

- Arquivos: `components/mesa-ma/mesa-ma-client.tsx` (Rápido e aba nova), `components/mesa-ma/commodity-panel.tsx` (novo), `lib/ma/commodity.ts` (novo: Zod, cálculo, listas, recorte do partner, trava), `app/api/ma/deals/[deal_id]/commodity/route.ts` (novo), `app/api/ma/deals/[deal_id]/commodity/documentos/route.ts` (novo), `app/api/ma-deals/route.ts` (POST, PATCH e GET, só a chave `commodity`), testes em `tests/`.
- Tabelas: `ma_deals` (só `asset_data.commodity`, `deal_value`, `currency`), `operation_contracts` (leitura para a trava). Sem migration.
- Storage: bucket privado `ma-documents`, prefixo `{deal_id}/comercial/`.
- APIs externas: nenhuma.

## UX: onde o usuário vê isso

- **Ponto de acesso:** (1) no botão "Rápido" do topo da Mesa M&A, caixa "Pedido de commodity"; (2) no deal aberto, aba "Commodity", ao lado das abas atuais. A aba aparece em todo deal do setor Agronegócio e em qualquer deal que já tenha `asset_data.commodity`.
- **Estado vazio:** "Nenhum pedido de commodity registrado neste deal." com o botão "Registrar pedido". Lista de documentos vazia: "Nenhum documento comercial recebido. Envie a LOI, a ICPO ou a SCO."
- **Sobrescrita do valor:** se o `deal_value` atual for diferente do total do pedido gravado (editado à mão), a gravação abre o modal `confirmar()` com o valor atual e o novo, antes de salvar.
- **Nota do porquê** (tooltip no foco, no toque e no hover): em Preço ("Base do valor total, do contrato e da liberação de pagamento no V3 Cargas"), em Modo de pagamento ("Define como o V3 Cargas libera cada carga") e em Documentos ("A Mesa de Compliance só libera a ficha com LOI ou ICPO e a prova de fundos recebidas").
- **Mobile:** campos em uma coluna abaixo de 640 px; janela do Rápido com rolagem (PR #426).

## Acesso e sigilo (decisão deste BRIEF)

| Perfil | Rota nova do pedido | Documentos comerciais | `GET /api/ma-deals` |
|---|---|---|---|
| ADMIN, GESTAO | Lê e grava, qualquer deal | Lê, envia e exclui | Pedido completo |
| MESA | Lê e grava nos deals que a listagem já mostra à MESA (a aba só abre a partir do deal listado; a listagem não muda) | Lê e envia, não exclui | Pedido completo nos deals que a listagem já mostra à MESA |
| MESA_OPERACIONAL | Só lê (decisão nova: diferente do `PATCH /api/ma-deals`, que hoje deixa gravar `asset_data`) | Só lê | Pedido completo |
| Partner originador | 403 na escrita; leitura só pelo `GET /api/ma-deals` | Só a situação, sem arquivo antes da Fase 2 | Campos do pedido e situação dos documentos |
| Partner não originador, instituição, comprador, vendedor e demais externos | 403 | 403 | Sem a chave `commodity` |
| Anônimo | 401 | 401 | 401 |

- **Partner originador** = `ma_deals.originator_profile_id` igual ao usuário da sessão (se for nulo, `created_by`, desde que o criador seja partner). Partner que só consta em `assigned_to`, inclusive por transferência (`transfer-deal`), é tratado como não originador: o `GET` sai sem a chave `commodity`. O filtro atual do `GET` por `assigned_to` ou `created_by` não é reaproveitado para esta decisão.
- **Camada de Storage, conferida em 24/11/2026:** `storage.buckets.public = false` para `ma-documents`, e nenhuma política em `storage.objects` cita `ma-documents` nem deixa de filtrar por `bucket_id` (consulta em `pg_policies` com `schemaname='storage'`: 0 linhas). Só a chave de serviço, no servidor, lê e grava o bucket. A conferência é repetida no teste (item 4) com download direto pela API do Storage. Consultas usadas: `select id, public from storage.buckets where id='ma-documents'` (resultado: `public = false`) e `select policyname from pg_policies where schemaname='storage' and tablename='objects' and (qual ilike '%ma-documents%' or with_check ilike '%ma-documents%' or (qual not ilike '%bucket_id%' and with_check not ilike '%bucket_id%'))` (resultado: 0 linhas).
- O pedido da ponta compradora nunca aparece no deal da ponta vendedora antes da Fase 2 (duplo cego): são deals separados e nenhuma rota cruza os dois.
- Nenhuma leitura direta do banco por perfil externo (política de 31/10/2026). As rotas usam a chave de serviço só no servidor, depois de conferir o papel.
- Toda gravação e exclusão vai para `logAudit` (quem, quando, campos alterados), sempre com `await`.

## DEPENDENCIES

- Deve existir antes: PR #426 em produção.
- Migrations pendentes: nenhuma.

## RISKS

- **Breaking changes:** baixo. Chave nova dentro de `asset_data`. O PATCH antigo passa a preservar `commodity` do banco, sem mudar o resto. Risco de regressão no Rápido (mesmo arquivo do PR #426) e no `GET /api/ma-deals` (filtro novo só na chave `commodity`).
- **LGPD/Compliance:** LOI, ICPO, SCO e FCO trazem a identidade da contraparte; por isso o partner só vê a situação antes da Fase 2. [VALIDAR COM ROBSON] se algum documento comercial puder ser mostrado ao partner antes da Fase 2. O envio da ficha à corretora parceira é o bloco B, ⚠️ ROBSON.
- **Performance:** nenhuma (uma linha por deal, lista curta de documentos).
- **Vercel timeout:** não há chamada a modelo de IA. Envio de arquivo segue o limite atual de upload.
- **CI:** cada push roda a bateria de testes contra o banco de produção. Um push por vez, esperando o CI da `main` terminar.
- **Achado fora do escopo (ALTA, Roadmap):** `/api/ma/documents` (GET, POST, DELETE) só exige login: qualquer usuário logado lista links assinados, envia e apaga documentos de qualquer deal da Mesa M&A. Não é corrigido aqui para não quebrar fluxos atuais no prazo de 25/11; vai para BRIEF próprio, prazo proposto 01/12/2026.

## APPROACH

- **Escolhida:** `asset_data.commodity` com rotas dedicadas (pedido e documentos) que conferem papel e mesclam no servidor, e os caminhos antigos fechados para a chave `commodity`. Reaproveita a máscara de valor e o bucket privado. Os campos já têm o formato que o V3 Cargas pede (`peso_saca_g`, `preco_saca_centavos`, `modo_pagamento`), o que encurta o bloco C.
- **Descartada:** tabela nova `ma_commodity_orders`. Mais limpa para consulta, mas exige migration, RLS e ensaio, e não cabe no prazo. Pode virar tabela depois.
- **Descartada:** reaproveitar `/api/ma/documents`. A rota está aberta a qualquer logado, e endurecê-la agora mexe em todos os deals da Mesa no prazo apertado.

## ESTIMATE

- Complexidade: M/L
- Esforço: 7 a 8 horas, incluindo teste em produção com deal ZZTEST e limpeza
- Confiança: Média

## Teste antes de declarar pronto

1. Deal ZZTEST criado pelo Rápido com "Pedido de commodity": confere `asset_data.commodity` e `deal_value` calculado no banco.
2. Aba Commodity: edita, recarrega e confere que `transfer_history` e as outras chaves continuam lá. Edição pelo `PATCH /api/ma-deals` antigo não altera o pedido.
3. Envia duas LOI de teste: as duas ficam no histórico, a situação é Recebido, nada é sobrescrito. Exclusão com motivo, pelo modal, gera `logAudit`.
4. Bateria de acesso nas rotas `PATCH .../commodity`, `GET/POST/DELETE .../commodity/documentos`, e `POST`, `PATCH` e `GET /api/ma-deals` com `commodity`:
   - anônimo: 401;
   - partner não originador: 403 (e `GET` sem a chave `commodity`);
   - partner originador: lê os campos e a situação, sem nome nem link; 403 na escrita;
   - partner que recebeu o deal por transferência (só em `assigned_to`): `GET` sem `commodity`, 403 nas rotas novas;
   - download direto pela API do Storage, com sessão de partner e de anônimo, no caminho `{deal_id}/comercial/...` do ZZTEST: negado;
   - perfil externo equivalente (instituição ou comprador): 403;
   - MESA_OPERACIONAL: lê, 403 na escrita;
   - MESA: lê e grava, 403 na exclusão de documento;
   - ADMIN e GESTAO: tudo.
5. Trava: com contrato `V3C-ICM` de teste em `enviado_assinatura` ligado ao ZZTEST (ensaio em transação desfeita), mudança de preço recebe 409.
6. Limpeza do ZZTEST (deal, arquivos do prefixo `comercial/`, nota de CRM, `crm_leads` da ponte) com resíduo 0.

## QA de governança

Rodada 1: BLOQUEADO (8 falhas: 1.1, 1.5, 3.3, 3.4, 7.1/7.5 em dois pontos, 7.2, 7.5). Corrigidas. Rodada 2: BLOQUEADO (2 falhas: 7.1 critério de originador, 7.5 prova do Storage). Corrigidas, com a consulta do Storage feita no banco. Rodada 3: **LIBERADO PARA "GO"**, 0 falhas. As 3 sugestões de UX da rodada 3 foram acolhidas (upload por link assinado, regra da MESA, consulta do Storage anexada).

---
Aguardando aprovação: "go", "ajusta: [instrução]" ou "cancela".
