# BRIEF: Alterar e-mail do signatário e reenviar contrato (Central de Contratos)

> Data: 2026-11-05 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO POR OVERRIDE ("go mesmo assim" do Hamilton, 05/11/2026 14h02)
> Salvar em `docs/briefs/2026-11-05_alterar-email-reenviar-contrato.md` e commitar junto com o código.

## SCOPE
Na Central de Contratos (`/juridico/contratos`, aba Painel), quando o contrato está **Enviado p/ Assinatura**, um botão novo **"Alterar e-mail e reenviar"**, só para **ADMIN**, abre um modal. O ADMIN escolhe o signatário e digita o e-mail novo. O sistema: (1) confere antes os bloqueios do envio, (2) cancela o envelope atual na ClickSign, (3) troca o e-mail daquela parte na lista de signatários do contrato (`parties`), (4) envia de novo para assinatura. O **texto** do contrato não é alterado (decisão do Hamilton, 05/11/2026). Fica registrado na linha do tempo e na auditoria.

Motivo: hoje, para corrigir um e-mail errado, é preciso cancelar o envio, e não existe tela para editar o e-mail das partes. O contrato fica parado ou é refeito do zero.

## IMPACT
- Arquivos afetados:
  - `app/api/contracts/[id]/change-signer-email/route.ts` (novo): GET (dados do modal) e POST (executa)
  - `lib/contract-send.ts` (novo): a lógica de `app/api/contracts/[id]/send/route.ts` sai para `checkSendGates(db, contract)` (só os bloqueios, sem o gate de status e sem o escopo de vertical da MESA_OPERACIONAL, que ficam na rota `send`) e `sendContractToSignature(db, contractId)`. A rota `send` passa a usar as duas e não muda de comportamento
  - `lib/signer-email-change.ts` (novo): validação do e-mail, lista de partes editáveis, máscara do e-mail antigo
  - `components/cm/contracts-panel-client.tsx`: botão + modal
  - `tests/`: testes do plano de teste
- Tabelas afetadas (só dados, sem DDL):
  - `operation_contracts`: `parties[i].email` da parte escolhida, e os campos que o cancelamento e o envio já mudam hoje
  - `contract_notes`: nota `note_type = "alteracao_email_signatario"`
  - `audit_logs`: registros `contract_signer_email_changed` / `contract_signer_email_change_failed`
- Rotas afetadas: `POST /api/contracts/[id]/send` (refatorada, mesmo comportamento) e a nova `/api/contracts/[id]/change-signer-email`
- APIs e integrações afetadas: ClickSign, só as chamadas que já existem (ler assinaturas, ler status do documento, cancelar, criar envelope). Nenhum e-mail novo da plataforma.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Central de Contratos > aba Painel > clicar no contrato "Enviado p/ Assinatura" > barra de ações > botão **"Alterar e-mail e reenviar"** (ícone envelope com lápis), ao lado de "Cancelar envio para assinatura". **Só ADMIN** vê o botão. Em contrato "Rascunho" ou "Aprovado", o mesmo botão aparece como **"Alterar e-mail do signatário"** (troca sem reenviar; serve para corrigir antes do primeiro envio e para concluir uma troca que falhou depois do cancelamento). Contrato enviado pelo CertOne: botão desabilitado, tooltip "Ainda não disponível para o CertOne". Contrato "Enviado" sem `external_envelope_id` (estado legado): botão escondido.
- Modal de ação irreversível no padrão vermelho V3 (o mesmo do "Cancelar envio": borda `red-500/40`, fundo navy). **Fecha só por "Voltar" ou "X", nunca clicando fora.** Sem `window.confirm`/`alert`.
  1. Texto de impacto (modo envio): "O envelope atual será cancelado na ClickSign e o link de assinatura já enviado deixa de valer. Um envelope novo vai para todos os signatários, que recebem um e-mail novo da ClickSign. O texto do contrato não muda." (modo rascunho): "O e-mail da parte será trocado na lista de signatários. Nada é enviado agora. O texto do contrato não muda."
  2. Lista dos signatários editáveis, na ordem do contrato (ordem do array `parties`), rádio para escolher **um**: nome, papel, e-mail atual. **Não editáveis (não aparecem):** `role` `v3_partners`, `estruturador` e `head_mesa`. Editáveis: todas as outras, inclusive `testemunha`.
  2b. Ao escolher a parte, se o texto do contrato ainda cita o e-mail atual dela (contagem com fronteira, devolvida pelo GET), aviso âmbar: "O texto do contrato ainda cita <e-mail atual> N vez(es). Para corrigir o texto, use Editar Contrato antes de confirmar." Não trava.
  3. Campo "Novo e-mail": tira espaços, minúsculas, valida o formato na hora; erros embaixo do campo ("E-mail inválido", "É o mesmo e-mail atual", "Este e-mail já é de outra parte do contrato: <nome>").
  4. Campo "Motivo" (obrigatório, mínimo 5 caracteres, mesmo padrão do cancelamento).
  5. Se alguém já assinou (modo envio): aviso com quem assinou e quando (**DD/MM/AAAA HH:mm, America/Sao_Paulo**, via `formatBrDateTime`), dizendo que **todos vão precisar assinar de novo**, e caixa "Entendo que as assinaturas já feitas serão perdidas".
  6. Modo envio: caixa "Entendo que o link de assinatura já enviado deixa de valer". Os dois modos: campo "Digite o código do contrato para confirmar".
  7. "Confirmar" desabilitado até tudo preenchido. Durante: "Conferindo... / Cancelando envio na ClickSign... / Reenviando...".
  8. Tela final no modal: (envio) "Contrato reenviado para assinatura (N signatário(s)). E-mail de <nome> alterado para <novo>." (rascunho) "E-mail de <nome> alterado para <novo>. Use Enviar para Assinatura quando estiver pronto." Avisos de falha parcial (nota não gravada) em âmbar. "Fechar" recarrega a lista.
- Estado vazio: sem signatário editável, o botão não aparece. Se a leitura da ClickSign falhar ao abrir, o modal mostra o erro e o confirmar fica desabilitado.
- Sem UI? Não se aplica.
- Tooltip do botão: (envio) "Cancela o envelope atual na ClickSign, corrige o e-mail do signatário e envia de novo." (rascunho) "Corrige o e-mail do signatário, sem enviar."

## DEPENDENCIES
- Deve existir antes: cancelamento de envio (`lib/contract-envelope-cancel.ts`, função `cancel_signature_envelope`, 22/10/2026), em produção.
- Migrations pendentes: nenhuma. Sem DDL.

## RISKS (nunca "nenhum")
- **Texto do contrato com o e-mail antigo (aceito pelo Hamilton em 05/11/2026):** o e-mail da parte pode estar impresso na qualificação (`lib/legal-qualification.ts`) e na cláusula de notificações (`lib/contract-clause-routing.ts`). Por decisão do Hamilton, a troca vale só para o envio; o texto continua com o e-mail antigo. A nota da linha do tempo registra isso ("o texto do contrato não foi alterado"). Se for preciso corrigir o texto, o caminho continua sendo "Editar Contrato".
- Breaking changes: a refatoração da rota `send` pode mudar sem querer um gate. Mitigação: mover o código sem reescrever, e testes que conferem as mesmas respostas para cada bloqueio.
- Gate que bloquearia só depois do cancelamento: `checkSendGates` roda com as partes já trocadas antes de tocar na ClickSign. Bloqueou: nada é cancelado.
- Lote de qualificação aberto: a mescla de `app/api/cm/qualificacao/[token]/route.ts` (445-481) reinsere as partes do lote com o e-mail do registro, o que criaria a mesma pessoa duas vezes. Bloqueio pela mesma regra que dispara a mescla: existe lote com `cm_qualification_batches.operation_contract_id = id` com pelo menos um `cm_party_qualifications` com `deleted_at` nulo e status diferente de `"preenchido"`. Mensagem: "Há qualificação de partes em andamento neste contrato. Conclua a qualificação antes de alterar o e-mail." Lote concluído: o e-mail antigo continua no registro do lote; fora do escopo, citado na nota.
- Contrato regularizado com PDF estampado (`is_master_agreement` + `stamped_document_path`): o PDF é enviado como está. Como o texto não muda neste fluxo de qualquer forma, a troca é permitida.
- Estados de falha:
  1. ClickSign recusa o cancelamento: nada muda. "A ClickSign recusou o cancelamento. Nada foi alterado. Detalhe: ...".
  2. ClickSign cancela, banco não conclui (`cancelEnvelopeInDb` falha sem `alreadyDone`): contrato segue "enviado" com envelope cancelado lá, e-mail não trocado. "O envelope foi cancelado na ClickSign, mas o banco não concluiu. Clique em Tentar de novo." Repetir lê `canceled` e conclui só o banco (caminho do `cancel-envelope`).
  3. Cancelou no banco, mas a auditoria ou o update do e-mail falhou: contrato em rascunho com o e-mail antigo. "O envio antigo foi cancelado, mas o e-mail não foi trocado (<erro>). O contrato está em Rascunho. Abra Alterar e-mail do signatário de novo para concluir."
  4. Trocou o e-mail, mas o reenvio falhou: rascunho com o e-mail novo. "O envio antigo foi cancelado e o e-mail foi corrigido, mas o reenvio falhou: <motivo>. Use Enviar para Assinatura."
- Assinaturas perdidas: cancelar envelope com assinatura parcial obriga todos a assinar de novo; o ADMIN confirma explicitamente.
- Corrida com o cron `clicksign-sync`: `cancelEnvelopeInDb` trata como sucesso idempotente (`alreadyDone`).
- Redirecionamento da assinatura: o e-mail é o que identifica o signatário na ClickSign; trocar o e-mail muda quem recebe o contrato. Controles adotados (decisão do Hamilton): só ADMIN, motivo obrigatório, auditoria com e-mail antigo e novo. Sem anexo do pedido e sem aviso ao e-mail antigo.
- LGPD e compliance: ver Parecer de compliance. Contrato assinado nunca é alterado.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem objeto de banco novo. Rota de servidor com service role (padrão de `cancel-envelope` e `send`), depois de conferir sessão (`auth.getUser()`) e role. Reaproveita `cancel_signature_envelope` (search_path fixo, execute só `service_role`). Nada usa `anon`.
- Performance: duas chamadas à ClickSign a mais que o envio normal. Risco baixo de passar os 60 s da Vercel. Sem chamada ao Claude.
- Permissão: autenticado sem papel ADMIN recebe 403.

## APPROACH
- Abordagem escolhida e por quê: cancelar o envelope e criar um novo, reaproveitando o cancelamento (22/10) e o envio. A ClickSign não deixa trocar o e-mail de um signatário num envelope em andamento. Uma rota faz tudo, sem o usuário precisar cancelar, editar e reenviar à mão.
- Alternativa descartada e por quê:
  1. Trocar o signatário dentro do envelope atual pela API da ClickSign: a API v3 não permite mexer em signatários de envelope em execução.
  2. Tela de "editar partes" no rascunho e reenvio manual: três passos, risco de o contrato ficar parado.
  3. Trocar também o e-mail no texto do contrato: descartado por decisão do Hamilton (05/11/2026), a troca é só para o envio.

## DESENHO TÉCNICO
Sem migration. Sem SQL de reversão.

`GET /api/contracts/[id]/change-signer-email` (ADMIN, senão 403): contrato e status, signatários editáveis `{index, name, role, email}`, e, se enviado, assinaturas já feitas (`listClickSignSignEvents`, datas por `formatBrDateTime`).

`POST /api/contracts/[id]/change-signer-email` body `{ party_index, new_email, reason, contract_code_confirm, ack_link_invalidated?, confirm_partial_signatures? }`. Estados de partida: **Enviado** (com envelope) faz tudo; **Rascunho/Aprovado** pula 4-6 e não reenvia.
1. Sessão + role ADMIN, senão 403. Gera `request_id` (uuid).
2. Valida: estado aceito; se enviado, provedor ClickSign e `external_document_id` presente; sem lote de qualificação aberto; `party_index` existe e papel editável; `new_email` normalizado com formato válido, diferente do atual e de todas as outras partes; `reason` 5+ caracteres; `contract_code_confirm` igual ao código; se enviado, `ack_link_invalidated === true` e, se houver assinatura, `confirm_partial_signatures === true`. Falha: 4xx, nada muda.
3. Pré-voo: `checkSendGates` com as partes já trocadas (em memória). Falha: 422, nada muda.
4. (enviado) Lê assinaturas na ClickSign.
5. (enviado) Lê status do documento; `running` → cancela; `canceled` → segue; outro → 409. Recusa → 502, nada muda.
6. (enviado) `cancelEnvelopeInDb(origin "manual", reason "Alteração de e-mail do signatário: <motivo>")`. Falha sem `alreadyDone` → 500 com `retry: true`.
7. `audit_logs` (await; falha para aqui, estado 3): `user_id`, `user_name`, `action = "contract_signer_email_changed"`, `entity = "operation_contracts"`, `entity_id = <id>`, `old_data = {party_index, nome, email_antigo}`, `new_data = {request_id, email_novo, motivo, envelope_id (ou null), resultado: "solicitado"}`.
8. Update de `parties`, `.eq("id").eq("status_signature", "rascunho" ou o status lido).select("id")`. Erro ou linhas ≠ 1: nada gravado, `contract_signer_email_change_failed` com o mesmo `request_id` (best-effort), estado 3. Sucesso: registro `resultado = "concluido"` com o mesmo `request_id` (await; falha vira aviso âmbar).
9. (enviado) `sendContractToSignature(db, id)`. Falha: estado 4.
10. `contract_notes` (await; falha vira aviso âmbar): "E-mail de <nome> alterado por <usuário> em DD/MM/AAAA HH:mm, de jo***@gmail.com para <novo>, só para o envio (o texto do contrato não foi alterado). Motivo: <motivo>. Envelope antigo cancelado; reenviado para assinatura." (variações para reenvio falho e modo rascunho).
11. Resposta: `{ ok, reenviado, signatarios, party_name, new_email, erro_reenvio?, aviso_nota? }`.

## PLANO DE TESTE
- Unitário (`tests/`): formato de e-mail (maiúsculas, espaços, igual ao atual, duplicado com outra parte); papéis não editáveis; máscara do e-mail antigo; GESTAO e MESA_OPERACIONAL recebem 403; pré-voo bloqueando (Head diferente, contato desligado) sem chamar o cancelamento, e não bloqueando por causa do status; ClickSign recusa → nada muda; banco falha depois do cancelamento → `retry` e repetição conclui; auditoria falha → e-mail não trocado, rascunho, mensagem certa; update com 0 linhas e com erro do banco → nada trocado, `change_failed` gravado; troca em rascunho (sem ClickSign, sem reenvio); reenvio falha → rascunho com e-mail novo; lote com parte pendente → bloqueado; lote concluído → não bloqueia; legado enviado sem envelope → botão escondido, POST recusa; `rendered_html` não é alterado em nenhum caminho; duas trocas seguidas (cada uma com seu `request_id`).
- Refatoração do `send`: mesmos casos de bloqueio com as mesmas mensagens.
- Ponta a ponta em produção, depois do deploy: contrato de teste para os e-mails do Hamilton (nunca partner real), enviado, e-mail trocado para o segundo e-mail do Hamilton; conferir na ClickSign o envelope antigo cancelado e o novo no e-mail novo, a nota e a auditoria. Depois cancelar o envio de teste.
- Seção 6: rodar as consultas de verificação de `anon` para `operation_contracts`, `contract_notes`, `audit_logs` e anexar ao PR.

## ESTIMATE
Complexidade M. Esforço: 3 a 4 horas. Confiança: Alta.

## PARECER DE COMPLIANCE
Ponto levantado pelo QA (rodadas 1 a 5): o e-mail é o que autentica o signatário na ClickSign; trocar o e-mail redireciona a assinatura. Marcado [VALIDAR COM ROBSON].

Respostas registradas em 05/11/2026, dadas pelo **Hamilton** (sócio) no chat da sessão, texto literal: "1- nao, somente alterar e reenviar o contrato, 2- troca deve ser do adm.3- somente trocar para envio, no contrato não é obrigatorio 4 - nao precisa nada disso".

Interpretação aplicada no BRIEF:
1. Sem anexo do pedido; o fluxo só altera e reenvia (mantido o motivo curto obrigatório, padrão do cancelamento, para a auditoria).
2. Só ADMIN.
3. Troca só para o envio (`parties`); o texto do contrato não é alterado; sem nova aprovação de sócios.
4. Sem aviso ao e-mail antigo.

**Pendente:** as respostas não são do Robson. Pela rotina, dúvida de compliance só se resolve com o parecer dele, ou com o "go mesmo assim" do João ou do Hamilton, registrando as falhas aceitas.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (6 falhas). Rodada 2: BLOQUEADO (4). Rodada 3: BLOQUEADO (4). Rodada 4: BLOQUEADO (4). Rodada 5: BLOQUEADO (2, só Robson; nenhuma falha técnica).
Após a rodada 5, o escopo foi simplificado pelas decisões do Hamilton (só ADMIN, sem troca no texto, sem aviso ao e-mail antigo, sem anexo).

Rodada 6 de 6: BLOQUEADO (2 falhas, nenhuma técnica). A simplificação não reabriu falha técnica.
- B1 [VALIDAR COM ROBSON]: troca de e-mail redireciona a assinatura sem parecer do Robson, sem anexo do pedido, sem aviso ao e-mail antigo, motivo mínimo de 5 caracteres. Controles: só ADMIN e auditoria.
- B2 [VALIDAR COM ROBSON]: o texto do contrato (HTML e PDF estampado) mantém o e-mail antigo na qualificação e nas notificações, enquanto a assinatura vai para o e-mail novo.
Sugestões aplicadas: aviso âmbar no modal quando o texto ainda cita o e-mail antigo ("O texto do contrato ainda cita <e-mail antigo> N vez(es). Para corrigir o texto, use Editar Contrato antes de confirmar."), com a contagem devolvida pelo GET; `old_data` guarda a entrada inteira da parte (role, name, email).

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 6), sem falha técnica; 2 falhas de compliance (B1, B2)
- Override ("go mesmo assim"): sim, dado pelo Hamilton em 05/11/2026 no chat ("go mesmo assim"), aceitando literalmente as falhas B1 e B2 da rodada 6. Pendente: confirmação por escrito do João de que o Hamilton também pode dar override (recomendação do QA).
- Go dado por: Hamilton, 05/11/2026 14h02 (horário de Brasília), mensagem "go mesmo assim, BRIEF 2026-11-05_alterar-email-reenviar-contrato" (registrado pelo hook, válido até 05/11/2026 22h02)
- Migration aplicada em produção: não se aplica (sem migration)

## NOTAS DE IMPLEMENTAÇÃO (05/11/2026)
- `sendContractToSignature` recebe o contrato já lido (não o id): a rota `send` já tem a linha em mãos e a troca relê o contrato do banco antes de reenviar. `checkSendGates` roda de novo nessa releitura, antes do envio.
- A orquestração ficou em `lib/signer-email-change.ts` (`executeSignerEmailChange`) com as chamadas externas injetáveis, para os testes cobrirem cada estado de falha. A rota só confere sessão e papel e liga as dependências reais.
- Antes de gravar `parties`, a lista é relida: se o e-mail da parte escolhida mudou no meio da operação, nada é gravado e fica o registro `contract_signer_email_change_failed`.
- Testes: `tests/unit/signer-email-change.test.ts` (31 casos, inclui os bloqueios da rota `send` com as mesmas mensagens). Suíte unitária inteira: 296/296.

