# BRIEF: Pré-aprovação, trocar "Renda média aprovada pela instituição" por "Renda média necessária para o crédito pretendido"

> Data: 2026-11-04 | Autor: Claude, a pedido do Hamilton | Status: GO COM OVERRIDE, parecer do Robson recebido em 04/11/2026 18h50
> Ajuste do BRIEF `2026-11-03_pre-aprovacao-mesa-operacional.md` (PR #364).

## SCOPE
No bloco "Pré-aprovação" do modal da proposta (Mesa Operacional), o campo "Renda média aprovada pela instituição" passa a se chamar **"Renda média necessária para o crédito pretendido"**. O mesmo nome vai para o e-mail ao cliente e para a mensagem de erro da validação, para que tela e e-mail digam a mesma coisa.

A chave gravada continua `renda_aprovada`, o valor, a máscara e os limites são os mesmos, e nenhum cálculo é adicionado.

**Registros enviados antes da troca (rodada 2):**
- Cada envio novo grava `rotulo_renda: "necessaria"` no próprio registro (`metadata.pre_aprovacao` e, no reenvio, `pre_aprovacao_historico`), sem migration.
- Registro sem `rotulo_renda` foi enviado com o nome antigo. A tela continua mostrando "Renda média aprovada pela instituição" para ele, no resumo do registro atual e no modal de confirmação, exatamente como o cliente recebeu.
- Reenvio de registro antigo: o campo "Renda média necessária para o crédito pretendido" vem **vazio** no formulário, e o envio fica bloqueado até a Mesa digitar o valor. Assim um número digitado como "aprovada" nunca sai com o nome "necessária" sem alguém conferir. Os outros campos vêm preenchidos como hoje.

## IMPACT
- Arquivos afetados:
  - `components/mesa-credito/pre-aprovacao-panel.tsx`, linha 19: rótulo do campo.
  - `lib/pre-aprovacao.ts`, linha 46: texto do erro de validação.
  - `lib/pre-aprovacao.ts`, linha 117: rótulo da linha no e-mail ao cliente.
  - `tests/unit/pre-aprovacao.test.ts`: confirma que o e-mail do cliente traz o rótulo novo e não traz mais o antigo.
- Tabelas afetadas: nenhuma. `credit_desk_proposals.metadata.pre_aprovacao.renda_aprovada` continua igual.
- Rotas afetadas: nenhuma. `POST /api/credit-proposals/[id]/pre-aprovacao` continua com o mesmo contrato.
- APIs e integrações afetadas: Resend, só o texto do e-mail ao cliente.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: modal da proposta, aberto pela Mesa Operacional, seção "Pré-aprovação". É o segundo campo de valor, logo abaixo de "Renda média apresentada", visível só para ADMIN, GESTAO e MESA_OPERACIONAL. O mesmo rótulo aparece no formulário, no resumo do registro atual, no modal de confirmação e no e-mail ao cliente. A lista "Envios anteriores" não mostra renda e não muda. Para registros antigos, valem as regras do SCOPE: rótulo antigo na tela e campo vazio no reenvio. O rótulo é longo e aparece em caixa alta 10px numa grade de 2 colunas, então a quebra de linha vai ser conferida no teste visual, inclusive em largura de celular.
- Estado vazio: não muda ("Nenhuma pré-aprovação registrada." e botão "Registrar pré-aprovação").
- Sem UI? Não se aplica: a mudança é justamente na tela.
- Nota do porquê (tooltip): nenhum campo novo. O nome novo já explica o que digitar: a renda que a instituição exige para liberar o valor pretendido.

## DEPENDENCIES
- Deve existir antes: PR #364 (pré-aprovação), já mergeado e em produção.
- Migrations pendentes: nenhuma.

## RISKS
- Breaking changes: não. O campo continua o mesmo, só o nome muda. As pré-aprovações já registradas continuam com o nome antigo na tela, como o cliente recebeu, e os e-mails já enviados não mudam. No reenvio de um registro antigo, a renda precisa ser digitada de novo. Isso dá um passo a mais para a Mesa, mas evita mudar o sentido do número sem ninguém conferir.
- LGPD e compliance: a renda continua indo só ao e-mail do próprio cliente, e o e-mail do partner continua sem nenhuma renda. O significado da comunicação ao cliente muda de "renda aprovada" para "renda necessária". Isso deixa a comunicação da Cláusula 4-A mais conservadora, porque não afirma mais que a instituição aprovou a renda. Não traz dado novo nem destinatário novo.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem alteração.
- Performance: nenhuma.
- Vercel timeout (60s): não se aplica, não há chamada de IA.
- Outro: durante um tempo, a tela vai ter registros com os dois nomes. Isso é intencional, porque cada registro mostra o nome que o cliente recebeu.

## APPROACH
- Abordagem escolhida: trocar só os rótulos visíveis e manter a chave `renda_aprovada`. Assim não precisa de migration nem de conversão dos registros existentes.
- Alternativa descartada: renomear a chave para `renda_necessaria` com migration do metadata. Seria mais claro no código, mas mexe em dados de produção e no histórico de envios, um risco sem ganho para o usuário.
- Alternativa descartada: trocar só na tela. A tela e o e-mail ficariam com nomes diferentes para o mesmo número, e o cliente receberia "renda aprovada" sobre um valor que a Mesa digitou como "necessária".

## DESENHO TÉCNICO
- `pre-aprovacao-panel.tsx`: `{ k: "renda_aprovada", label: "Renda média necessária para o crédito pretendido" }`.
- `lib/pre-aprovacao.ts`: `valor(body.renda_aprovada, TETO_RENDA, "Renda média necessária para o crédito pretendido")` e `linhas.push(["Renda média necessária para o crédito pretendido", brl(d.renda_aprovada)])`.
- `lib/pre-aprovacao.ts`: o registro montado na rota ganha `rotulo_renda: "necessaria"`. Uma função `rotuloRenda(registro)` devolve o rótulo novo quando `rotulo_renda === "necessaria"` e o antigo ("Renda média aprovada pela instituição") quando o campo não existe.
- `pre-aprovacao-panel.tsx`: o resumo e o modal de confirmação usam `rotuloRenda(atual)` para o registro atual. No formulário de reenvio, se `atual.rotulo_renda` não existir, o campo `renda_aprovada` começa vazio, e a validação já existente (valor maior que zero) bloqueia o envio.
- Sem migration, sem SQL e sem mudança de papel.
- Na implementação, `rotulo_renda: "necessaria"` sai de `validarPreAprovacao`, e a rota já espalha `v.dados` no registro. Assim a rota não precisou mudar e o escopo ficou nos dois arquivos liberados.
- No modal de confirmação de um registro antigo, a renda nova aparece com o nome novo, e o valor anterior aparece numa linha à parte com o nome antigo, em vez de riscado ao lado (seriam números de sentidos diferentes).

## PLANO DE TESTE
- Unitário: o e-mail ao cliente contém "Renda média necessária para o crédito pretendido" e não contém "Renda média aprovada". O e-mail ao partner não contém "Renda média necessária" nem "Renda média aprovada".
- Unitário: `rotuloRenda` devolve o nome antigo para um registro sem `rotulo_renda` e o novo para um com `rotulo_renda: "necessaria"`. O registro montado para envio traz `rotulo_renda: "necessaria"`.
- Visual: um registro antigo mostra o nome antigo, e "Revisar e enviar" nesse registro abre com a renda vazia e não deixa enviar sem preencher.
- Unitário: com `renda_aprovada` acima do teto, o erro cita o nome novo.
- Visual: abrir o modal de uma proposta de teste, nunca de partner real, e conferir o rótulo no formulário, no modal de confirmação e no resumo.
- Não testável aqui: o e-mail real pelo Resend. Só o HTML é coberto no unitário.

## ESTIMATE
Complexidade S, esforço de 15 minutos, confiança alta.

## PARECER DE COMPLIANCE
[VALIDAR COM ROBSON] **Bloqueia até a resposta.** O item 2 do parecer de 03/11/2026 aprovou o modelo de comunicação escrita da pré-aprovação para fins da Cláusula 4-A, com a multa de 1%. Esta mudança altera o sentido de uma linha desse modelo.

Pergunta ao Robson:
> No e-mail de pré-aprovação ao cliente, que você aprovou em 03/11 como a comunicação escrita da Cláusula 4-A, a linha "Renda média aprovada" passaria a ser "Renda média necessária para o crédito pretendido". O resto do e-mail não muda, incluindo a frase "Valores sujeitos à avaliação do imóvel e à análise final da instituição".
> As pré-aprovações já enviadas continuam registradas com o nome antigo, e no reenvio a Mesa precisa digitar a renda de novo.
> O modelo aprovado no item 2 continua valendo com essa troca?

Resposta:
- Data: 04/11/2026, 18h50 (horário de Brasília).
- Quem respondeu: Robson Lino.
- Texto: "Eu, Robson, autorizo o merge."
- Meio: captura de tela enviada pelo Hamilton no chat da sessão.
- Nota: a resposta autoriza o merge deste PR e não repete a pergunta sobre o item 2 do parecer de 03/11. Ela foi registrada como aprovação da troca do rótulo no e-mail da Cláusula 4-A.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: **BLOQUEADO (2 falhas).**
1. [Compliance] O sentido da comunicação da Cláusula 4-A, aprovada pelo Robson, muda, e o parecer não pode ser N/A por autoavaliação. Ainda em aberto: o BRIEF agora pede a resposta do Robson.
2. [3.4] Registros já enviados apareceriam com o nome novo, diferente do que o cliente recebeu, e o reenvio levaria o valor "aprovada" com o nome "necessária". Corrigido na rodada 2: `rotulo_renda` no registro, nome antigo nos registros antigos e renda vazia no reenvio.

Sugestões aplicadas: o UX não fala mais em "histórico" com renda, a quebra do rótulo vai ser conferida no celular e o teste do e-mail do partner checa os dois rótulos.

Rodada 2: pendente, depois da resposta do Robson.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 1)
- Override: **sim**, "go mesmo assim" do Hamilton em 2026-11-04. Falha aceita: [Compliance] parecer do Robson sobre a troca de "Renda média aprovada" por "Renda média necessária para o crédito pretendido" no e-mail da Cláusula 4-A, pendente no go e **respondido em 04/11/2026 18h50** ("Eu, Robson, autorizo o merge."). A falha 3.4 foi corrigida no próprio BRIEF.
- Go dado por: Hamilton, 2026-11-04 21:32 UTC ("go mesmo assim, BRIEF 2026-11-04_pre-aprovacao-renda-necessaria")
- Migration aplicada em produção: não se aplica
