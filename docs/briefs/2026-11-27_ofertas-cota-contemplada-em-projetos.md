# BRIEF: Ofertas de cota contemplada em Consórcio › Projetos, com tarja e aviso à V3

> Data: 2026-11-27 | Autor: Claude | Status: QA BLOQUEADO só por falhas que dependem de aceite
> Pedido do Hamilton: "nas cotas contempladas as ofertas feitas pelos usuarios tanto da V3 quanto da enterprise vai para onde? tem como criar um acompanhamento e direcionar essas ofertas com tarja OFERTA COTA CONTEMPLADA, dentro da aba projetos e notificar por email a V3 e dentro da plataforma".
> Escolhas do Hamilton (27/11):
> - quem vê: "V3 vê todas + quem ofertou vê as suas e o enterprise master vê de seus usuários";
> - avisos: "ADMIN, GESTÃO e MESA OPERACIONAL".

## COMO É HOJE (resposta à pergunta)
- A oferta feita em Consórcio › Cartas Contempladas, por qualquer login (V3, partner ou Enterprise), é gravada em `consorcio_ofertas` pela rota `POST /api/consorcio/ofertas`, e a carta passa para "Em Negociação".
- Avisos: notificação na plataforma e e-mail para ADMIN e GESTÃO, com link para Cartas Contempladas.
- Só a equipe interna (ADMIN, GESTÃO, MESA_OPERACIONAL) vê as ofertas, dentro da janela de cada carta em Cartas Contempladas. É ali que ela aceita (`/aceitar`).
- Quem ofertou não acompanha a oferta em lugar nenhum depois de enviar. O aviso não diz se veio da V3 ou de um Enterprise.
- Em produção, em 27/11/2026, havia 0 ofertas.

## SCOPE
1. **Acompanhamento em Consórcio › Projetos**: seção nova "Ofertas de cota contemplada", acima da lista de projetos. Cada oferta é um card com a tarja **OFERTA COTA CONTEMPLADA**.
   - **Equipe V3** (ADMIN, GESTÃO, MESA_OPERACIONAL) vê todas, com origem e quem ofertou.
   - **Quem ofertou** vê só as próprias.
   - **Master Enterprise** vê as dele e as dos usuários da equipe (`idsDaEquipe`, a mesma regra dos projetos).
2. **Avisos de oferta nova** para ADMIN, GESTÃO e MESA_OPERACIONAL ativos (hoje só ADMIN e GESTÃO):
   - **Na plataforma:** título "Oferta de cota contemplada", com link para `/consorcio/projetos#ofertas`.
   - **Por e-mail:** passa a dizer a origem e quem ofertou, com link absoluto para Projetos.

A decisão (aceitar) continua em Cartas Contempladas, só para a equipe interna. O fluxo de aceite e a vitrine não mudam.

## IMPACT
- Arquivos afetados:
  - `app/api/consorcio/ofertas/acompanhamento/route.ts` (novo, GET): lista as ofertas para o acompanhamento, com o recorte por papel (ver DESENHO);
  - `lib/consorcio/ofertas-acompanhamento.ts` (novo, puro), com as funções:
    - `podeVerOferta(viewer, oferta)`: decide o acesso;
    - `ofertaParaAcompanhamento(oferta, papel, extras)`: monta a resposta a partir da lista fechada do papel;
    - `mascararDocumentoOferta(valor)`;
    - `origemDaOferta(...)`;
    - `ordenarOfertas`;
    - `rotuloStatusOferta`;
  - `app/api/consorcio/ofertas/route.ts` (POST): destinatários ADMIN, GESTÃO e MESA_OPERACIONAL; título, link e e-mail com origem e originador; sem travessão no e-mail; remetente @v3partners.com.br;
  - `app/(platform)/consorcio/projetos/page.tsx`: a seção nova;
  - `tests/unit/ofertas-acompanhamento.test.ts` (novo).
- Tabelas: nenhuma alteração. Só leitura de `consorcio_ofertas`, de `profiles` (nome de quem ofertou) e da tarja do Enterprise (`marcasDosPartners`).
- Rotas: uma rota de leitura nova. O POST de ofertas muda só nos avisos.
- Menu: não muda. Ver "Quem não chega à seção" em RISKS.

## DESENHO
```
GET /api/consorcio/ofertas/acompanhamento
  sem login → 401
  viewer = { id, interno: ehInterno(role), equipe: idsDaEquipe(svc, id) }
  consulta:
    interno → todas
    demais  → created_by in viewer.equipe (o próprio id; o master também recebe os da equipe)
    duas leituras: TODAS as pendentes + as 300 mais recentes das demais (pendente antiga nunca some)
  defesa em profundidade: depois da consulta, cada linha passa por podeVerOferta(viewer, oferta); linha recusada é descartada e registrada em log só com o id da oferta e o id de quem viu (nunca nome nem documento do interessado)
  extras: ofertado_por = profiles.full_name (sem nome → "Usuário sem nome"); origem só para interno
  resposta = ofertaParaAcompanhamento(oferta, viewer.interno ? "interno" : "partner", extras)

podeVerOferta(viewer, oferta) = viewer.interno || viewer.equipe.includes(oferta.created_by)

Campos por papel (lista fechada; teste de paridade):
  interno: id, carta_id, carta_code, carta_credit_value, valor_oferta, interessado_nome, status, created_at,
           ofertado_por, origem
  partner: id, carta_code, carta_credit_value, valor_oferta, interessado_nome,
           interessado_documento (mascarado), status, created_at, ofertado_por
  Nenhum dos dois recebe interessado_tel, observacoes nem responsavel_nome.
  O card interno NÃO mostra CPF/CNPJ nem telefone: esses dados continuam só na janela da carta
  ("Abrir a carta"), como hoje.

mascararDocumentoOferta(valor)
  n = normalizeDocument(valor)    // lib/v3-clients-pure: tira [^0-9A-Za-z] e põe em maiúsculas
  vazio → "Não informado"
  detectDocumentType(n) = CPF  → "***." + n[3..6] + "." + n[6..9] + "-**"
  detectDocumentType(n) = CNPJ → n[0..2] + "." + n[2..5] + "." + n[5..8] + "/****-**"   (vale para o alfanumérico)
  qualquer outro tamanho → "Documento informado"   (nunca o valor cru)

origemDaOferta(marcas: Map, createdBy, internoDoCriador)
  criador interno (ADMIN/GESTAO/MESA_OPERACIONAL) → "Equipe V3"
  marcas.has(createdBy) e valor não nulo           → nome do Enterprise
  marcas.has(createdBy) e valor nulo               → "Rede V3"
  !marcas.has(createdBy) (falha da leitura)        → "Não identificada"
```
- **Ordem:** pendentes primeiro e, dentro de cada grupo, da mais recente para a mais antiga. Ordem dos grupos: Pendente, Aceita, Recusada, Cancelada.
- **Rótulos de status:**

  | status | rótulo |
  |---|---|
  | pendente | "Em análise" |
  | aceita | "Aceita" |
  | recusada | "Recusada" |
  | cancelada | "Cancelada (outra oferta aceita)" |

## UX: ONDE O USUÁRIO VÊ ISSO
- **Ponto de acesso:** menu Consórcio › Projetos, seção "Ofertas de cota contemplada" (âncora `#ofertas`), acima dos projetos. Notificação e e-mail levam direto para lá.
- **Card (todos):**
  - tarja **OFERTA COTA CONTEMPLADA** (faixa dourada no topo, texto em caixa alta);
  - código da carta, crédito da carta e valor ofertado, em `R$` com máscara BRL;
  - nome do interessado;
  - status;
  - data DD/MM/AAAA, no fuso de São Paulo;
  - "Ofertado por <nome>".
- **Card do partner e do master:** também o documento do interessado mascarado (`mascararDocumentoOferta`).
- **Card da equipe V3:** também o selo de origem ("Equipe V3", "Rede V3", nome do Enterprise ou "Não identificada") e o botão "Abrir a carta", que leva para Cartas Contempladas, onde ela vê os dados completos e aceita. CPF/CNPJ e telefone ficam fora do card.
- **Contadores no topo da seção:** "Em análise", "Aceitas" e "Total".
- **Estados:**
  - carregando: o mesmo `Loader2` da página, com os contadores vazios;
  - sem ofertas: "Nenhuma oferta de cota contemplada ainda.";
  - erro: "Não foi possível carregar as ofertas agora." (a lista de projetos continua aparecendo).
- **E-mail:**
  - assunto "Oferta de cota contemplada: carta <código>";
  - corpo com carta, crédito, valor ofertado, interessado, telefone (só para a V3, como hoje), origem e "Ofertado por";
  - sem travessão (valor vazio aparece como "Não informado");
  - rodapé "V3 Partners · Consórcio · Notificação automática";
  - link absoluto `${NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/consorcio/projetos#ofertas`, mesmo padrão das outras rotas de e-mail;
  - remetente `EMAIL_FROM`, que já é @v3partners.com.br em produção. Se ele faltar, o e-mail não sai e o motivo vai para o log, em vez de cair no `onboarding@resend.dev`.
- **Sem UI?** Não: a seção, a notificação e o e-mail.

## DEPENDENCIES
- Deve existir antes (tudo no ar):
  - `consorcio_ofertas`;
  - `ehInterno` (`app/api/consorcio/vitrine.ts`);
  - `idsDaEquipe` e `marcasDosPartners` (`lib/enterprise.ts`);
  - `normalizeDocument` e `detectDocumentType` (`lib/v3-clients-pure.ts`).
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- **LGPD:** quem ofertou e o master Enterprise passam a ver, das ofertas da equipe, estes dados:
  - o nome do interessado e o documento mascarado;
  - o valor ofertado, o status e quem ofertou.

  Telefone e observações não saem para eles. A equipe V3 não ganha superfície nova com dado completo: o card dela não mostra CPF/CNPJ nem telefone. `[VALIDAR COM ROBSON]` (ver Parecer).
- **Acesso decidido na rota, não na RLS (exceção declarada):**
  - A leitura usa a service role, e o recorte por papel fica na rota, como nas rotas de projetos, ofertas e cartas aceitas no override de 23/11 (BRIEF `2026-11-21_consorcio-projetos-ofertas-vazamento.md`).
  - A RLS por dono de `consorcio_ofertas` é o BRIEF prometido para até 05/12/2026. Esta rota entra na mesma pendência e precisa ser revista quando ele sair.
  - Mitigação: `podeVerOferta` é aplicada de novo em cada linha depois da consulta e é testada como matriz de acesso.
  - Esta exceção precisa do aceite do João ou do Hamilton.
- **Sigilo de preço:** nenhuma das respostas traz nada da carta além do código e do crédito, que já aparecem na vitrine. `consorcio_ofertas` não tem colunas de custo.
- **Documento em texto livre:** o campo aceita até 20 caracteres, sem validação. A máscara decide pelo tamanho normalizado e nunca devolve o valor cru. O formulário continua sem máscara até o BRIEF de 05/12.
- **Quem não chega à seção:** STARTER (V3 Access) e PARTNER_HE conseguem ofertar em Cartas Contempladas, mas não têm Consórcio › Projetos no menu. Isso é uma decisão de plano de hoje, e incluir esses papéis daria a eles também a criação de projetos. Eles **não** acompanham pela seção. As ofertas deles aparecem para a equipe V3, com a origem "Rede V3". Se o Hamilton quiser incluí-los, isso vira outro BRIEF (menu + plano).
- **Mais avisos:** a MESA_OPERACIONAL passa a receber e-mail e notificação de cada oferta. O volume é baixo (0 ofertas em 27/11).
- **Regressão no POST:** falha ao montar a origem vira "Não identificada", e o aviso sai do mesmo jeito. A oferta nunca deixa de ser gravada por causa do aviso.
- **Performance:** 2 consultas (pendentes + 300 recentes) e 2 leituras auxiliares. Vercel timeout: não se aplica.

## APPROACH
- **Abordagem escolhida:** uma rota de leitura nova, com lista fechada por papel e checagem de acesso por linha, e uma seção na tela de Projetos. O aviso fica no POST que já existe.
- **Alternativas descartadas:**
  - **Abrir o GET de ofertas que já existe:** ele devolve `*`, e o "só interno" foi uma decisão do BRIEF de 21/11.
  - **Gravar a oferta como projeto:** duplicaria dados, e o status da oferta não acompanharia.
  - **Mostrar CPF/CNPJ com olho e log no card da V3:** a equipe já vê o dado completo na janela da carta. Não exibi-lo no card evita uma superfície nova sem precisar do fluxo de revelação.
  - **Criar a seção só para a V3:** o Hamilton escolheu que quem ofertou e o master também acompanhem.

## PLANO DE TESTE
- **Unitário** (`ofertas-acompanhamento.test.ts`):
  - **Matriz de acesso com `podeVerOferta`:**
    - interno vê tudo;
    - partner A vê a própria oferta, e partner B não vê a de A;
    - usuário da equipe vê só as dele, não as do colega nem as do master;
    - o master vê as dele e as da equipe;
    - usuário da equipe de outro master não vê nada.
  - **Paridade das chaves por papel:** o JSON do partner não tem `interessado_tel`, `observacoes`, `responsavel_nome`, `origem` nem `carta_id`; o do interno não tem `interessado_tel` nem `interessado_cpf_cnpj`.
  - **`mascararDocumentoOferta`:** CPF com e sem máscara, CNPJ numérico, CNPJ alfanumérico, lixo ("abc"), 13 caracteres, vazio e nulo; nunca devolve o valor de entrada.
  - **`origemDaOferta`:** os 4 casos.
  - **Ordem e rótulos.**
- **Build da Vercel e testes de tela.**
- **Em produção, depois do deploy:**
  - `curl` sem sessão na rota nova devolve 401;
  - com 0 ofertas, a seção mostra o estado vazio (o Hamilton olha logado).
- **Com dado real:** testar com oferta exige gravar uma oferta, o que muda a carta para "Em Negociação" e dispara avisos. Isso não entra neste BRIEF. A matriz de acesso fica coberta pelo teste unitário da mesma função que a rota usa. A primeira oferta real é conferida pelo agente por leitura (a rota devolve o que a matriz prevê para cada papel).

## ESTIMATE
M. Cerca de 3h. Confiança alta.

## PARECER DE COMPLIANCE
Pendente de resposta do Robson: `[VALIDAR COM ROBSON]`. Quando ele responder, registrar a data, quem respondeu e o texto.

Pergunta ao Robson:
1. O master Enterprise passa a ver, nas ofertas de cota contemplada feitas pelos usuários da equipe dele, estes dados:
   - o nome do interessado e o CPF/CNPJ mascarado;
   - o valor ofertado, o status e quem da equipe ofertou.

   O vínculo é o mesmo que já dá a ele os projetos e as propostas da equipe. Telefone e observações não saem.
2. No CNPJ mascarado, os 8 primeiros caracteres (a raiz, que identifica a empresa) ficam visíveis (`12.345.678/****-**`), no mesmo padrão já usado na Mesa Operacional do master. Mantém ou oculta?

Enquanto não houver resposta, a liberação depende do aceite do João ou do Hamilton ("go mesmo assim").

Registro de 27/11/2026 (Claude): a equipe V3 não ganha superfície nova com dado completo, e não surge destinatário fora do vínculo de quem ofertou.

## QA DE GOVERNANÇA
Rodada 1, 27/11/2026: BLOQUEADO, com 5 falhas.
1. Compliance: o Parecer agora está pendente do Robson, com a pergunta completa (nome, documento, valor, status e quem ofertou, além da raiz do CNPJ). Depende de aceite.
2. Acesso na rota (6.5): a exceção está declarada e ligada ao BRIEF de RLS de 05/12; `podeVerOferta` é aplicada por linha; o plano de teste tem a matriz de acesso completa. Depende de aceite.
3. CPF/CNPJ e telefone num painel novo (3.1/3.2): corrigido, porque o card interno não mostra esses dados (ficam em "Abrir a carta").
4. Máscara sobre texto livre (1.3): corrigida. A normalização vem de `lib/v3-clients-pure`, o tipo é decidido pelo tamanho, outro tamanho vira "Documento informado" e há testes dos casos-limite.
5. Ponto de acesso (UX): declarado. STARTER e PARTNER_HE não têm Projetos no menu e não acompanham pela seção; incluí-los vira outro BRIEF.

Sugestões aplicadas:
- origem com os 4 casos;
- pendentes sempre e mais as 300 recentes;
- estado de carregamento;
- e-mail sem travessão, com remetente @v3partners.com.br sem cair no fallback, assunto e link absoluto.

O telefone saiu do card, então a sugestão de máscara de telefone deixou de se aplicar.

Rodada 2, 27/11/2026: BLOQUEADO só pelas 2 falhas que dependem de aceite humano. Não há falha técnica no texto.
1. [Compliance] Sem parecer do Robson, com as perguntas 1 e 2 do Parecer.
2. [6.5] Filtro de acesso na rota nova `app/api/consorcio/ofertas/acompanhamento` (service role), não na RLS. A RLS por dono de `consorcio_ofertas` está prometida até 05/12/2026.

Sugestões aplicadas:
- o log de linha recusada leva só ids;
- o link do e-mail usa `NEXT_PUBLIC_APP_URL`;
- se o Robson pedir para ocultar a raiz do CNPJ, o ajuste de `mascararDocumentoOferta` e do teste entra no mesmo PR ou num seguinte.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 2), só pelas falhas 1 e 2 acima.
- Override: pendente. Precisa de "go mesmo assim" do João ou do Hamilton aceitando:
  - (1) a falta do parecer do Robson, que continua devendo a resposta;
  - (2) o filtro na rota `app/api/consorcio/ofertas/acompanhamento`, com RLS por dono até 05/12/2026.
