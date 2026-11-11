# BRIEF: Item 3.1 do Contrato de Parceria do Enterprise cita o acordo comercial

> Data: 2026-11-10 | Autor: Claude Code (pedido do Hamilton) | Status: GO DADO (Hamilton, 10/11/2026)
> Pedido literal (10/11/2026): "faz o ajuste do item 3.1 do enterprise", depois de a minuta v2.4 do Contrato de Parceria (cadastrada em revisão na Central, template `874abe53-11c0-41d6-a0a4-f44b286a3cad`) passar a dizer, no item 3.2.1, que o valor e as condições de pagamento do Enterprise seguem o acordo comercial firmado por WhatsApp ou e-mail.

## SCOPE
No contrato gerado pelo botão "Enviar contrato" de `/admin-cadastros`:
1. o item 3.1 do plano **Enterprise** passa a citar o acordo comercial, **só quando a minuta usada tiver o item "Condições do Plano Enterprise"** (v2.4 em diante). O número do item é **lido da própria minuta** (grupo de captura), nunca escrito no código;
2. o item 3.1 de **toda a família parceria** (Partner, Partner PRO, Enterprise) passa a trazer o **valor por extenso** e a **data por extenso** (QA rodada 1, itens 1.2 e 1.5). Gold e Diamante (família oferta) não mudam;
3. a tela "Enviar contrato" mostra um aviso quando o plano é Enterprise e a minuta escolhida não tem o item de acordo comercial;
4. o título do card deixa de dizer "v2.3" fixo e passa a mostrar a versão lida do nome da minuta escolhida;
5. **anuidade do Enterprise passa a R$ 49.896,96** (12 x R$ 4.158,08), pedido do Hamilton em 10/11/2026: "so o enterprise sai 49.896,96, pro continua o mesmo valor". Partner (R$ 10.897,00) e PRO (R$ 15.897,00) não mudam. O valor novo só é impresso quando a minuta é a v2.4 (a que tem o item de acordo comercial), porque o Anexo III da v2.3 diz R$ 49.897,00 e o contrato não pode sair com dois valores. A v2.4 em revisão na Central já foi ajustada (Anexo III do Enterprise: total R$ 49.896,96, parcela (c) de R$ 14.220,64 para R$ 14.220,60; nota do white label "incluída nos R$ 49.896,96"), e a fixture é a cópia literal dessa versão.

Texto do 3.1 no Enterprise com a v2.4:
"Plano contratado: Enterprise, anuidade de R$ 49.896,96 (quarenta e nove mil e oitocentos e noventa e seis reais e noventa e seis centavos) (Anexo III), ou o valor e as condições de pagamento do acordo comercial firmado entre as partes por WhatsApp ou por e-mail (item 3.2.1). Data prevista de pagamento: 25/11/2026 (25 de novembro de 2026)."

Texto do 3.1 no Enterprise com a v2.3 (sem o item de acordo): "Plano contratado: Enterprise, anuidade de R$ 49.897,00 (quarenta e nove mil e oitocentos e noventa e sete reais) (Anexo III). Data prevista de pagamento: ..."

Texto do 3.1 nos outros planos da família parceria (exemplo PRO):
"Plano contratado: Partner PRO, anuidade de R$ 15.897,00 (quinze mil e oitocentos e noventa e sete reais) (Anexo III). Data prevista de pagamento: 25/11/2026 (25 de novembro de 2026)."

Forma do extenso (QA rodada 2, sugestão 1, caminho (a)): o texto é o que `valorEmReaisPorExtenso` já produz hoje para LOI e contratos ("mil e oitocentos"). Trocar para "mil, oitocentos" mexe em todos os documentos que usam o helper e fica para BRIEF próprio, se o `@contract-legal-guardian` pedir.

## IMPACT
- Arquivos afetados:
  - `lib/contrato-parceria-partner.ts`:
    - `PLANO_ANUIDADE` passa a ser derivado de um mapa numérico `PLANO_ANUIDADE_NUM` (10897, 15897, 49897), mais `ANUIDADE_ENTERPRISE_V24 = 49896.96` usado só quando a minuta tem o item de acordo; formatado em BRL por `Intl.NumberFormat("pt-BR")` e por extenso por `valorEmReaisPorExtenso` (`lib/utils/valor-extenso.ts`). O extenso nunca é digitado à mão;
    - funções puras novas: `itemAcordoEnterprise(html): string | null` (número do item, lido da minuta) e `textoItem31(plano, dataIso, itemAcordo)`;
    - `TITULO_CONTRATO.parceria` passa a "Contrato de Parceria" (sem versão fixa);
  - `components/admin-cadastros/enviar-contrato-parceria.tsx`: versão da minuta no título do card (lida do `template_name`) e aviso âmbar para Enterprise sem o item de acordo;
  - `tests/unit/contrato-parceria-item31.test.ts` (novo) e `tests/fixtures/minuta-parceria-v2.4.html` (cópia literal do `body_text_raw` gravado em `contract_templates`, id `874abe53-11c0-41d6-a0a4-f44b286a3cad`, obtida por select de leitura).
- Tabelas afetadas: nenhuma. Nada muda no banco. Os contratos já gerados não mudam.
- Rotas afetadas: nenhuma rota muda. A geração continua em `POST /api/contracts/generate`, chamada pelo botão.
- APIs e integrações: nenhuma.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso (ADMIN): o botão **"Enviar contrato"** no modal do cadastro Enterprise aprovado em `/admin-cadastros`. O contrato gerado, na Central de Contratos e no ClickSign, mostra o item 3.1 com o trecho do acordo comercial.
- Cliente (Partner, PRO, Enterprise): vê o item 3.1 com valor e data também por extenso no contrato que assina.
- Card "Enviar contrato": o título mostra "Contrato de Parceria v2.3" ou "v2.4", conforme a minuta escolhida (aprovada primeiro).
- Aviso (texto âmbar abaixo do botão, só no Enterprise, quando a minuta escolhida não tiver o item de acordo): "Esta minuta não tem o item de acordo comercial do Enterprise; o 3.1 sai sem a citação ao acordo." O envio não é bloqueado: com a v2.3 aprovada é o comportamento esperado até a v2.4 ser aprovada.
- Estado vazio: com a minuta v2.3, o 3.1 do Enterprise sai sem a citação ao acordo (mas já com os extensos).
- Nota do porquê (tooltip): N/A. Não há campo, consulta nem aceite novo na tela.

## DEPENDENCIES
- Deve existir antes: a minuta v2.4 aprovada na Central, para aparecerem a citação ao acordo e a anuidade de R$ 49.896,96 no Enterprise. Com a v2.3, o 3.1 muda só nos extensos (valor e data).
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: o cron `app/api/cron/lembrete-pagamento-parceria` lê o 3.1 com as regex `Plano contratado:\s*([^,<]+),\s*anuidade de\s*(R\$\s*[\d.,]+)` e `Data prevista de pagamento:\s*(dd)/(mm)/(aaaa)`. O texto novo mantém "Plano contratado: {plano}, anuidade de R$ {valor}" no começo (R$ 49.896,96 no Enterprise com a v2.4, R$ 49.897,00 com a v2.3) e "Data prevista de pagamento: dd/mm/aaaa" no fim. Há teste unitário passando o 3.1 novo pelas duas funções (`planoDoContrato` e `dataPagamentoDoContrato`).
- O lembrete de pagamento cita a anuidade impressa no 3.1 do contrato (o valor do Anexo III), e não o valor do acordo comercial, quando o acordo definiu outro valor. Risco aceito: o lembrete só avisa a V3, não o cliente. Ajustar o lembrete fica fora deste BRIEF (sugestão do QA registrada).
- Achado do QA fora do escopo: o botão "Enviar contrato" envia ao ClickSign sem modal vermelho de confirmação (regra 3.3). Fica para BRIEF próprio.
- Detecção do item de acordo (QA rodada 1, item 2.4, caminho (a)): `itemAcordoEnterprise` usa `/(\d+(?:\.\d+)+)\s*<(?:b|strong)>\s*Condições do Plano Enterprise/i` e devolve o número capturado da minuta. Se a minuta for renumerada, o 3.1 cita o número novo. Se o título do item mudar, a citação some **e a tela avisa** (não é silencioso). Testado contra a cópia literal da v2.4 gravada no banco (`tests/fixtures/minuta-parceria-v2.4.html`).
- Data por extenso: `dateExtensoBR` (`lib/contract-adhesion.ts`) formata no fuso de Brasília; com "yyyy-mm-dd" puro, `new Date` lê meia-noite UTC e o dia recuaria 1. O código passa `${data}T12:00:00Z`. Teste com 25/11/2026 e com dia 1 ("1º").
- Trava contra divergência (QA rodada 3, sugestão 1, acolhida): em `preencherContratoParceria`, para qualquer plano da família parceria, o valor formatado do 3.1 precisa aparecer na linha do plano no Anexo III da minuta (`<td>{label}</td>` ... `<td>{valor}</td>`, na mesma `<tr>`). Se não aparecer, a geração para com o erro "O valor da anuidade do {plano} no 3.1 ({valor}) não bate com o Anexo III da minuta; revise a minuta na Central ou o código." e nada é enviado ao ClickSign. Testes: v2.4 com Enterprise e PRO passam; v2.4 com o Anexo III do Enterprise adulterado lança o erro. A v2.3 real também precisa passar para Partner, PRO e Enterprise (cópia literal em `tests/fixtures/minuta-parceria-v2.3.html`, obtida por select de leitura do template `3bc8182c-e112-45c7-959e-2562681c6dcf`).
- Anuidade do Enterprise amarrada à versão da minuta: a regra "R$ 49.896,96 só com o item de acordo" usa a mesma detecção do item 2.4. Se uma minuta futura tiver o item de acordo mas outro valor no Anexo III, o código precisa ser revisto (decisão consciente, registrada aqui). Teste: Enterprise com v2.4 imprime R$ 49.896,96; Enterprise sem o item imprime R$ 49.897,00; o valor do 3.1 com a v2.4 é igual ao total da linha Enterprise do Anexo III da fixture.
- O cron do lembrete lê "R$ 49.896,96" com a mesma regex (`R\$\s*[\d.,]+`). Teste.
- O 3.1 do Partner e do PRO muda (ganha os extensos). Mudança só de forma, exigida pelo padrão de contratos; o cron continua lendo valor e data (teste).
- Texto contratual: o trecho do acordo **não está na minuta**, é injetado pelo código no lugar de "Plano contratado: [plano]". Os sócios que aprovarem a v2.4 na Central não o veem no texto da minuta. Por isso o texto exato do 3.1 do Enterprise vai para as observações do revisor da v2.4 na Central (update só do campo `observacoes_para_revisor`, depois do go) e deve passar pelo `@contract-legal-guardian` junto com a aprovação da v2.4 pelo quórum. Ponto sensível declarado: o 3.1 traz o preço do Anexo III e a ressalva do acordo no mesmo item.
- LGPD e compliance: N/A, sem dado pessoal novo; o 3.1 só ganha texto fixo.
- Segurança de acesso ao banco: nenhum objeto novo, nenhuma leitura ou escrita nova, nada de `anon`.
- Performance: uma busca de texto a mais na minuta, irrelevante.

## APPROACH
- Abordagem escolhida: condicionar o trecho ao plano e à presença do item 3.2.1 na minuta, numa função pura testável. Assim, o mesmo código funciona com a v2.3 (aprovada hoje) e com a v2.4.
- Alternativa descartada: um marcador novo `[condições do Enterprise]` na v2.4. Exigiria regravar a minuta já cadastrada e manter dois caminhos no `trocar()`. Também descartado: texto incondicional, que citaria um item 3.2.1 inexistente na v2.3.

## DESENHO TÉCNICO
- `textoItem31(plano, dataIso, itemAcordo)` monta: `Plano contratado: {label}, anuidade de {BRL} ({extenso}) (Anexo III)` + (Enterprise e `itemAcordo`: `, ou o valor e as condições de pagamento do acordo comercial firmado entre as partes por WhatsApp ou por e-mail (item {itemAcordo})`) + `. Data prevista de pagamento: {dd/mm/aaaa} ({data por extenso}).`
- `itemAcordoEnterprise(html)` com a regex da seção de riscos; exportada também para o componente decidir o aviso.
- Sem migration. Reversão: revert do commit.

## PLANO DE TESTE
- Unitário:
  - `itemAcordoEnterprise` na cópia literal da v2.4 do banco devolve "3.2.1"; num HTML sem o item devolve null; num HTML renumerado ("3.2.2 <strong>Condições do Plano Enterprise") devolve "3.2.2";
  - Enterprise + v2.4: o 3.1 tem "acordo comercial", "(item 3.2.1)", "R$ 49.896,96 (quarenta e nove mil e oitocentos e noventa e seis reais e noventa e seis centavos)" e "(25 de novembro de 2026)"; `planoDoContrato` devolve `{ plano: "Enterprise", anuidade: "R$ 49.896,96" }` e `dataPagamentoDoContrato` devolve "2026-11-25"; o valor bate com o total da linha Enterprise do Anexo III da fixture;
  - Enterprise sem o item: sem "acordo comercial", "R$ 49.897,00 (quarenta e nove mil e oitocentos e noventa e sete reais)";
  - Partner PRO com a v2.4: sem "acordo comercial", "R$ 15.897,00 (quinze mil e oitocentos e noventa e sete reais)";
  - dia 1: "(1º de dezembro de 2026)", sem recuo de fuso;
  - `preencherContratoParceria` com a cópia literal da v2.4 para Enterprise e PRO, sem sobrar marcador.
- Produção: depois de aprovada a v2.4, gerar o contrato de um cadastro Enterprise interno de teste, conferir o 3.1 e cancelar o contrato.

## ESTIMATE
S, cerca de 30 min, confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal: só texto fixo do 3.1, que repete o item 3.2.1 da minuta. A minuta em si passa pela aprovação dos sócios na Central.

---

## RELATÓRIO DO QA DE GOVERNANÇA
### Rodada 1 de 6: BLOQUEADO (3 falhas)
1. 1.2 Valor sem extenso no 3.1. **Corrigido**: `PLANO_ANUIDADE_NUM` + `valorEmReaisPorExtenso`, para toda a família parceria, com teste.
2. 1.5 Data sem extenso. **Corrigido**: `dateExtensoBR` com meio-dia UTC, teste do dia 1 e do fuso.
3. 2.4 Remissão com número fixo. **Corrigido pelo caminho (a)**: número capturado da minuta + aviso na tela; teste contra a cópia literal da v2.4 do banco.
- Sugestões acolhidas: texto do 3.1 nas observações do revisor da v2.4 e passagem pelo `@contract-legal-guardian`; título do card com a versão da minuta. Registradas para outro BRIEF: lembrete do Enterprise citando o acordo; modal de confirmação no "Enviar contrato".

### Rodada 3 de 6: LIBERADO (0 falhas)
- Sugestão 1 (trava contra divergência entre o 3.1 e o Anexo III): **acolhida**, ver RISKS.
- Sugestão 2 (trechos desatualizados em RISKS e DEPENDENCIES): **corrigidos**.
- Sugestão 3 (parcela (c) e preço novo no Anexo III vão ao `@contract-legal-guardian` e ao quórum): **acolhida**, já registrada nas observações do revisor da v2.4 na Central.

### Rodada 2 de 6: LIBERADO (0 falhas)
- Sugestão 1 (texto esperado do extenso diferente do helper): **acolhida pelo caminho (a)**, textos e testes ajustados à saída real do helper.
- Sugestão 2 (guardar no estado só o resultado de `itemAcordoEnterprise`, não o HTML): **acolhida**.
- Depois da rodada 2, o Hamilton ampliou o escopo (anuidade do Enterprise R$ 49.896,96). Volta ao QA na rodada 3.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 3)
- Override: não
- Go dado por: Hamilton, em 2026-11-10 (mensagem "go", registrada pelo hook)
- Implementação: 419 de 419 testes unitários (9 novos em `tests/unit/contrato-parceria-item31.test.ts`), lint limpo.
- Migration aplicada em produção: não se aplica
