# BRIEF: Pré-aprovação no modal da proposta (Mesa Operacional), com e-mail ao partner e ao cliente

> Data: 2026-11-03 | Autor: Claude, a pedido do Hamilton | Status: QA LIBERADO, aguardando go
> Relaciona-se com a Cláusula 4-A do Mandato de Crédito (minutas v2 em revisão): este e-mail é a "comunicação escrita da pré-aprovação" ao cliente.

## SCOPE
No modal da proposta de crédito, um bloco "Pré-aprovação" onde a equipe da Mesa preenche à mão:
- Renda média apresentada (R$);
- Renda média aprovada pela instituição (R$);
- Valor pré-aprovado com a renda do cliente (R$);
- Valor do imóvel (R$) e valor pretendido (R$);
- Próxima etapa: Avaliação de imóvel, Assinatura de contrato, Outros (caixas de marcar, ao menos uma); com Outros, campo obrigatório "Qual a próxima etapa".

Ao confirmar, grava os dados e envia e-mail ao partner da proposta e ao cliente, para os e-mails cadastrados. Fora do escopo: mudar a etapa (stage) da proposta, gerar contrato, WhatsApp, cálculo automático de valores.

## IMPACT
- Arquivos: `components/mesa-credito/proposta-detail-modal.tsx` (bloco e modal de confirmação), `components/mesa-credito/pre-aprovacao-panel.tsx` (novo), `app/api/credit-proposals/[id]/pre-aprovacao/route.ts` (novo, POST), `lib/pre-aprovacao-email.ts` (novo, texto e envio pelo Resend), `lib/credit-proposal-meta.ts` (chaves protegidas), `tests/unit/pre-aprovacao.test.ts` (validação, texto do e-mail e prova de que PATCH de partner com `pre_aprovacao` é ignorado).
- Tabelas: `credit_desk_proposals.metadata.pre_aprovacao` (JSONB existente, sem migration): campos acima em reais (número, como `requested_value` e as demais chaves do metadata), `enviado_em` (ISO UTC), `enviado_por` (id), `emails` (cliente e partner efetivamente usados). Reenvio grava o novo e acrescenta o anterior em `metadata.pre_aprovacao_historico`. `audit_logs`: 1 linha por envio, sem valores.
- Proteção: a rota grava com `atualizarMetadata` (lê o banco no momento de gravar, como `ocr-resultados`). `pre_aprovacao` e `pre_aprovacao_historico` entram em `protegerMetadata` (`lib/credit-proposal-meta.ts`) como chaves só do servidor, como `recursos_liberados`: no PATCH genérico, mantém a do banco e descarta a recebida. Assim nem o modal desatualizado apaga o registro, nem um partner forja uma pré-aprovação.
- Destinatários: cliente = `metadata.email`, ou `email` da proposta se o primeiro estiver vazio (mesma precedência do modal, linha 1040); partner = e-mail da conta via `auth.admin.getUserById(partner_id)`, nome em `profiles.full_name` (como `route.ts`, linhas 583 a 585). Formato de e-mail validado; inválido bloqueia o envio para aquele destinatário e avisa.
- Rotas: `POST /api/credit-proposals/[id]/pre-aprovacao`, só ADMIN, GESTAO e MESA_OPERACIONAL; lê e grava com a chave de serviço, depois de checar o papel na sessão.
- APIs: Resend (já usado). Remetente `V3 Partners <noreply@v3partners.com.br>`.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: modal da proposta, aberto pela Mesa Operacional, seção "Pré-aprovação" logo abaixo dos dados da operação; visível só para ADMIN, GESTAO e MESA_OPERACIONAL.
- Estado vazio: "Nenhuma pré-aprovação registrada." e botão "Registrar pré-aprovação".
- Campos de valor com a máscara existente `maskCurrencyBRLInput` / `parseCurrencyBRLInput` (`lib/utils.ts`), gravados em reais; não aceitam negativo nem zero; teto de R$ 10.000.000,00 para as rendas e de R$ 1.000.000.000,00 para valor pré-aprovado, do imóvel e pretendido. Aviso, sem bloquear, se o valor pré-aprovado passar do pretendido ou do valor do imóvel.
- Confirmação antes de enviar: modal vermelho V3, que fecha só pelos botões (nunca ao clicar fora nem com Esc), com o resumo dos valores que vão no e-mail e o texto "Enviar a pré-aprovação para o cliente ({e-mail mascarado}) e para o partner ({nome})? Depois de enviado, o e-mail não pode ser desfeito." Botões "Enviar" e "Voltar". "Reenviar com correção" passa pelo mesmo modal, mostrando valores anteriores e novos.
- Depois de enviado: resumo dos valores, "Enviado em DD/MM/AAAA HH:mm por {nome} para cliente e partner" (fuso America/Sao_Paulo, na tela e no e-mail), botão "Reenviar com correção" e histórico de envios, do mais recente ao mais antigo.
- Sem e-mail do cliente: aviso "Cadastre o e-mail do cliente na proposta para enviar a pré-aprovação." e o envio fica bloqueado. Proposta sem partner: envia só ao cliente e avisa.
- Falha de envio (ajustado na implementação, mais seguro): se o e-mail do cliente falhar, nada é gravado e a tela mostra "O e-mail ao cliente não saiu. Nada foi registrado; tente novamente."; se só o do partner falhar, o registro é gravado e a tela avisa. O registro só existe quando a comunicação ao cliente, que vale para a Cláusula 4-A, saiu de fato.
- E-mail ao cliente: assunto "Pré-aprovação da sua operação {código}"; rendas, valor pré-aprovado (também por extenso, gerado do mesmo número gravado e coberto no teste), valor do imóvel, valor pretendido, próxima etapa e a frase "Valores sujeitos à avaliação do imóvel e à análise final da instituição."
- E-mail ao partner: mesmo assunto e conteúdo, **sem as rendas do cliente** (minimização de dado pessoal; o partner vê a proposta completa na plataforma). Texto sem travessão e sem emoji nos dois.

## DEPENDENCIES
- Nenhuma migration.
- `RESEND_API_KEY` em produção (já usada por outras notificações).

## RISKS
- **Dado pessoal e financeiro por e-mail (aprovado pelo Robson em 03/11/2026, item 1):** a renda do cliente vai só ao e-mail do próprio cliente; o do partner não leva renda. Este e-mail vale como a "comunicação escrita da pré-aprovação" da Cláusula 4-A (item 2 do parecer).
- **Sem nome da instituição (decisão do Hamilton em 03/11/2026):** nem o bloco nem os e-mails trazem a instituição que pré-aprovou. A Cláusula 4-A diz que a pré-aprovação é informada pela Instituição; sem o nome no e-mail, a prova de que ela veio da Instituição fica só no registro interno da Mesa; aprovado pelo Robson nos itens 1 e 2 do parecer.
- **Efeito contratual:** pela Cláusula 4-A, a comunicação da pré-aprovação ao cliente passa a valer como marco da multa de 1%, quando as minutas v2 forem aprovadas. Erro de valor no e-mail tem consequência; por isso a confirmação e o reenvio com histórico.
- **E-mail errado:** vai para o e-mail cadastrado na proposta; cadastro errado manda dado a terceiro. Mitigação: e-mail mascarado na confirmação.
- **Ação irreversível:** envio de e-mail; confirmação obrigatória.
- Breaking changes: não. Performance: desprezível. Vercel timeout: envio de 2 e-mails, bem abaixo de 60 s.

## APPROACH
- Abordagem: dados no `metadata` JSONB que a proposta já usa, rota própria com checagem de papel e envio pelo Resend, como as notificações existentes.
- Alternativa descartada: tabela nova `credit_proposal_pre_aprovacoes`. Exige migration e segundo go, sem ganho para um registro por proposta.
- Alternativa descartada: mudar a etapa da proposta automaticamente. O pedido não inclui, e a etapa segue manual.

## ESTIMATE
Complexidade: M. Esforço: 4 a 6 horas. Confiança: Média.

## PARECER DE COMPLIANCE
**Robson Lino, 03/11/2026, 13h59 (Brasília).** Origem: captura de tela enviada pelo Hamilton nesta sessão (`Captura de tela 2026-11-03 135936.png`). Texto: "1. Aprovo o envio dos e-mails pela Mesa Operacional, conforme os critérios apresentados, respeitando a LGPD e sem divulgar o nome da instituição. 2. Aprovo o modelo de comunicação escrita da pré-aprovação para fins da Cláusula 4-A do mandato, ciente da previsão de multa de 1%. Aprovado e autorizado. Robson Lino".

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 03/11/2026: BLOQUEADO, 6 falhas. Corrigidas neste texto: proteção do registro, unidade e teto, destinatários, data e hora, modal de confirmação. Parecer do Robson recebido. Rodada 2, 03/11/2026: LIBERADO, sem falhas.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO na rodada 2
- Go dado por: pendente
