# BRIEF: Anuidade do item 3.1 lida do Anexo III da minuta (Contrato de Parceria)

> Data: 2026-11-10 | Autor: Claude Code (pedido do Hamilton) | Status: GO DADO (Hamilton, 10/11/2026)
> Pedido literal (10/11/2026): "revisa todo o contrato que seja 100% valido como um juridico premium, nao pode ter nenhum erro, e nenhum valor divergente". Decisões do Hamilton na revisão: Partner com anuidade de R$ 10.896,96 (o que o sistema já cobra, 12 x R$ 908,08); Enterprise com o acesso do master + até 10 usuários.

## SCOPE
O gerador do Contrato de Parceria deixa de ter a anuidade fixa no código e passa a ler o valor do item 3.1 da **linha do plano no Anexo III da própria minuta** (coluna "Total Anual"). Antes de gerar, confere que (a) + (b) + (c) = Total Anual na mesma linha. Assim, o item 3.1 nunca diverge do Anexo III, seja qual for a versão aprovada (v2.3 com R$ 10.897,00 no Partner, v2.4 revisada com R$ 10.896,96).

Motivo imediato: a v2.4 revisada (em revisão na Central) passou o Partner para R$ 10.896,96. Com o valor fixo de hoje (R$ 10.897,00), a trava do PR #391 bloquearia todo contrato Partner assim que a v2.4 fosse aprovada.

## IMPACT
- Arquivos afetados:
  - `lib/contrato-parceria-partner.ts`:
    - nova função pura `anuidadeDoAnexoIII(html, plano): number`, que acha a `<tr>` cuja primeira célula é o rótulo do plano ("Partner", "Partner PRO", "Enterprise"), lê os quatro valores em R$ (a, b, c, total), confere a + b + c = total em centavos e devolve o total;
    - `textoItem31` passa a receber o valor; `preencherContratoParceria` usa `anuidadeDoAnexoIII`;
    - saem `PLANO_ANUIDADE_NUM`, `ANUIDADE_ENTERPRISE_V24`, `anuidadeDoPlano`, `conferirAnexoIII` e `PLANO_ANUIDADE` (este último sem uso fora do arquivo, conferido por busca);
  - `tests/unit/contrato-parceria-item31.test.ts`: casos atualizados;
  - `tests/fixtures/minuta-parceria-v2.4.html`: regravada com a v2.4 revisada (cópia literal do banco em 11/11/2026 00:08 UTC). Além do Anexo III, essa versão traz as mudanças de texto da revisão jurídica: 3.2.1, 3.4, 3.11, 3.14.1, 3.15, 10.2.1, 16.5, 17, Anexo I, Anexo III e o novo item 6.8 (6.8 a 6.8.13, responsabilidade do LICENCIADO pelos usuários vinculados do Enterprise). O PR registra que o código foi testado contra esse texto.
- Tabelas afetadas: nenhuma. A minuta v2.4 já foi atualizada na Central (`contract_templates` `874abe53-…`, `em_revisao`), como dado, pela revisão pedida pelo Hamilton.
- Rotas afetadas: nenhuma rota muda. A geração continua em `POST /api/contracts/generate`.
- APIs e integrações: nenhuma.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso (ADMIN): botão **"Enviar contrato"** do cadastro aprovado em `/admin-cadastros`. O contrato sai com o 3.1 igual ao Anexo III da minuta escolhida.
- Erro (o contrato não é gerado e nada vai ao ClickSign), mostrado na mesma caixa vermelha que a tela já usa para erro de geração:
  - linha do plano ausente no Anexo III: "O Anexo III da minuta não tem a linha do plano {plano}; revise a minuta na Central.";
  - soma divergente: "No Anexo III da minuta, as parcelas (a), (b) e (c) do {plano} somam {soma}, diferente do Total Anual {total}; revise a minuta na Central.";
  - linha incompleta: "A linha do plano {plano} no Anexo III da minuta não tem os quatro valores (a), (b), (c) e Total; revise a minuta na Central.";
  - parcela zerada: "No Anexo III da minuta, a parcela {parcela} do {plano} está zerada; revise a minuta na Central.";
  - total fora da faixa: "No Anexo III da minuta, o Total Anual do {plano} ({total}) está fora da faixa aceita (de R$ 1.000,00 a R$ 1.000.000,00); revise a minuta na Central.";
  - {soma} e {total} sempre em BRL (`formatarBRL`), nunca em centavos.
- Estado vazio: N/A, a minuta sempre tem o Anexo III. Sem ele, aparece o erro acima.
- Nota do porquê (tooltip): N/A, sem campo novo.

## DEPENDENCIES
- Deve existir antes: nada. Funciona com a v2.3 aprovada e com a v2.4 revisada.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: o valor passa a vir da minuta. Com a v2.3 aprovada, o 3.1 sai igual ao de hoje (Partner R$ 10.897,00, PRO R$ 15.897,00, Enterprise R$ 49.897,00), coberto por teste contra a cópia literal da v2.3. Com a v2.4, sai Partner R$ 10.896,96, PRO R$ 15.897,00, Enterprise R$ 49.896,96.
- Leitura por HTML: se uma versão futura trocar a estrutura da tabela (por exemplo, `<th>` na primeira coluna ou outra ordem de colunas), a leitura falha **com erro claro** e o contrato não sai. É uma falha segura: o ADMIN vê o motivo e nada errado é assinado. Teste com tabela adulterada.
- Ordem das colunas fixada em (a), (b), (c), Total, igual nas duas versões reais. Se a ordem mudar, a conferência da soma acusa.
- Faixa válida do valor (QA rodada 1, item 1.1): cada parcela (a), (b) e (c) maior que zero e Total Anual entre R$ 1.000,00 e R$ 1.000.000,00, além da soma. O teto e o piso são de sanidade (os totais reais vão de R$ 10.896,96 a R$ 49.896,96) e evitam que uma linha zerada ou um erro de digitação grosseiro, mesmo com a soma coerente, chegue à assinatura.
- Intervalo até a aprovação da v2.4 (decisão consciente, a confirmar pelo Hamilton no go): enquanto a v2.3 for a aprovada, o contrato Partner sai com R$ 10.897,00 no 3.1 (o que diz o Anexo III da v2.3), e a cobrança é 12 x R$ 908,08 = R$ 10.896,96, R$ 0,04 a menos. Vale o contrato, e a diferença favorece o cliente. A divergência some quando a v2.4 é aprovada. Antecipar a correção exigiria alterar a v2.3 já aprovada, o que este BRIEF não faz.
- Imutabilidade: contrato já gerado ou assinado guarda o valor impresso no `rendered_html`. Reajustar a minuta depois não muda contratos emitidos, e o lembrete lê o valor do próprio contrato.
- Texto da minuta fora do código: os itens novos da v2.4 (inclusive o 6.8.2, que cita LGPD, Lei Anticorrupção e Lei nº 9.613/1998) são texto de minuta. Ficam com o quórum dos 3 sócios, o Robson incluído, e com o `@contract-legal-guardian`. O parecer deste código continua N/A.
- Vercel timeout (60s): N/A, sem chamada à IA.
- Lembrete de pagamento: lê o valor impresso no 3.1, então passa a citar o valor do Anexo III da minuta usada. Coberto pelo teste do cron.
- Texto contratual: a v2.4 revisada continua em revisão e depende do quórum dos 3 sócios. Este BRIEF não aprova nada.
- LGPD e compliance: N/A, sem dado pessoal novo.
- Segurança de acesso ao banco: nenhum objeto novo, leitura nova ou escrita nova; nada de `anon`.
- Performance: uma varredura de regex na minuta (cerca de 33 KB) por contrato, irrelevante.

## APPROACH
- Abordagem escolhida: a minuta aprovada pelos sócios é a única fonte do valor. O código só lê, confere a soma e imprime. Assim, qualquer reajuste de preço passa a ser feito só na minuta, sem deploy.
- Alternativas descartadas:
  - trocar a constante do Partner para 10896.96 condicionada à v2.4, como já foi feito no Enterprise: multiplica regras por versão e repete o risco de divergência a cada reajuste;
  - um marcador `[anuidade]` na minuta: exigiria reescrever a v2.3 aprovada.

## DESENHO TÉCNICO
- `anuidadeDoAnexoIII(html, plano)`:
  1. separa as `<tr>` do HTML;
  2. acha a linha cuja primeira `<td>`, com o conteúdo aparado (trim), é igual a `PLANO_LABEL[plano]`. A igualdade é exata, para "Partner" não casar com "Partner PRO";
  3. extrai os valores com `/R\$(?:\s|&nbsp;)*(\d{1,3}(?:\.\d{3})*,\d{2})/g`, que aceita valor sem ponto de milhar (R$ 908,08), com milhar (R$ 10.896,96), de milhão (R$ 1.234.567,89) e `&nbsp;` entre "R$" e o número. Converte para centavos (inteiros). A extração fica num helper puro sem faixa, `valoresBRLDaLinha(tr): number[]`. Usa os 4 primeiros valores da linha (a, b, c, total). Com menos de 4, dá o erro de linha incompleta;
  4. confere cada parcela > 0, total entre 100000 e 100000000 centavos, e a + b + c = total;
  5. devolve total / 100.
- `textoItem31(plano, dataIso, itemAcordo, anuidade)`: o mesmo texto do PR #391, com o valor recebido.
- Sem migration. Reversão: revert do commit, seguro **só enquanto a v2.4 não for aprovada**. Depois disso, o código antigo (Partner fixo em R$ 10.897,00 com a trava do PR #391) bloqueia todo contrato Partner.

## PLANO DE TESTE
- Unitário:
  - v2.3 real: Partner 10897, PRO 15897, Enterprise 49897;
  - v2.4 real revisada: Partner 10896.96, PRO 15897, Enterprise 49896.96;
  - "Partner" não pega a linha "Partner PRO";
  - linha ausente: erro "não tem a linha";
  - soma adulterada: erro "somam", com os valores em BRL;
  - linha zerada (R$ 0,00 nas quatro colunas): erro "zerada";
  - total acima do teto (R$ 2.000.000,00, com soma coerente): erro "fora da faixa";
  - formatos, no helper `valoresBRLDaLinha`: R$ 908,08, R$ 1.234.567,89 e `R$&nbsp;10.896,96` são lidos; "35%" não é lido;
  - linha com só 3 valores: erro "não tem os quatro valores";
  - `preencherContratoParceria` com a v2.4 nos três planos: o 3.1 tem o valor do Anexo III e o extenso certo ("dez mil e oitocentos e noventa e seis reais e noventa e seis centavos"), e o cron lê valor e data;
  - testes do PR #391 mantidos (item de acordo, data por extenso, dia 1, versão do card).
- Produção: depois do deploy, gerar o contrato de um cadastro interno de teste com a v2.3 aprovada, conferir o 3.1 e cancelar.

## ESTIMATE
S, cerca de 40 min, confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal: muda só a origem do valor impresso, que passa a ser a minuta aprovada.

---

## RELATÓRIO DO QA DE GOVERNANÇA
### Rodada 2 de 6: LIBERADO (0 falhas)
- Sugestões acolhidas: mensagem própria para linha incompleta; helper puro `valoresBRLDaLinha` para testar os formatos sem mexer na faixa; "conteúdo aparado (trim)" no passo 2.
- A leitura "vale o contrato, e a diferença favorece o cliente" (R$ 0,04 no Partner enquanto a v2.3 estiver aprovada) fica para o Hamilton confirmar no go.

### Rodada 1 de 6: BLOQUEADO (1 falha)
1. 1.1 Faltavam o mínimo e o teto do valor lido da minuta. **Corrigido**: parcelas > 0, total entre R$ 1.000,00 e R$ 1.000.000,00, mensagens próprias e testes.
- Sugestões acolhidas: intervalo da v2.3 declarado em RISKS; imutabilidade; mensagens em BRL; formatos aceitos pela regex e regra dos 4 primeiros valores; reversão segura só antes da aprovação; conteúdo da fixture; 6.8.2 com o quórum e o `@contract-legal-guardian`; Vercel timeout N/A.
- Extenso na norma culta ("dez mil, oitocentos"): segue o padrão do helper aceito no PR #391; vai ao `@contract-legal-guardian` e, se pedido, vira BRIEF próprio (o helper atende LOI e contratos).

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 2)
- Override: não
- Go dado por: Hamilton, em 2026-11-10 (mensagem "go", registrada pelo hook), confirmando o intervalo de R$ 0,04 do Partner enquanto a v2.3 estiver aprovada.
- Implementação: 422 de 422 testes unitários, lint limpo.
- Migration aplicada em produção: não se aplica
