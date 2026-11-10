# BRIEF: Aprovação do V3 Enterprise envia o comunicado do white label automaticamente

> Data: 2026-11-10 | Autor: Claude Code (pedido do Hamilton) | Status: QA BLOQUEADO (rodada 3, só compliance), aguardando go mesmo assim
> Pedido literal (10/11/2026): "quando eu aprovar no sistema, quero que mande automatico essas informações", sendo elas: login, senha provisória e "que o time tecnico e comercial entrara em contato para estruturação do white label com os 10 acessos conforme previsto em contrato".

## SCOPE
Ao aprovar um cadastro do plano **ENTERPRISE** em Cadastros de Parceiros, depois de um modal de confirmação, o sistema envia automaticamente:
1. o e-mail de boas-vindas (já existe: login + senha provisória) **com um bloco a mais** só no Enterprise: "o time técnico e comercial vai entrar em contato para a estruturação do seu white label, com os 10 acessos previstos em contrato";
2. uma mensagem de WhatsApp (sessão OpenWA global da V3) com o mesmo aviso, sem a senha, no telefone do cadastro, só se o telefone passar na regra da seção "Telefone".

Os outros planos não mudam, exceto a correção do travessão no assunto do e-mail de boas-vindas (vale para todos).

## IMPACT
- Arquivos afetados:
  - `app/api/cadastro-partner/aprovar/route.ts`: bloco do Enterprise no e-mail, envio do WhatsApp, retorno `comunicado`, assunto sem travessão, `jaExiste` também consultando `profiles` por e-mail;
  - `lib/enterprise/comunicado-aprovacao.ts` (novo): textos e regra do telefone, funções puras;
  - `components/admin-cadastros/admin-cadastros-client.tsx`: modal de confirmação no Aprovar do Enterprise e aviso do resultado;
  - `lib/aviso.ts` e `components/shared/toaster.tsx`: `confirmar()` ganha a opção `{ perigo: true, titulo?, botao? }`, que deixa o modal vermelho (borda, título e botão em `#E24B4A`, mesmo padrão do `pedirMotivo` com `perigo`). Sem a opção, o modal continua idêntico;
  - `lib/whatsapp/openwa-client.ts`: nova função exportada `verificarWhatsapp(phone, sessionId?)`, que devolve `{ existe, chatId } | null` (null = o check falhou). `sendText` e `resolveChatId` não mudam;
  - `tests/unit/comunicado-enterprise.test.ts` (novo).
- Tabelas afetadas: nenhum schema muda.
  - `partner_registrations`: só leitura, como já acontece.
  - `sdr_conversas`: insert de 1 linha.
  - `sdr_leads`: upsert de 1 linha com `humano_ativo = true` (ver Riscos, item a).
  - `profiles`: leitura por e-mail.
- Rotas afetadas: `POST /api/cadastro-partner/aprovar`, só no ramo `APROVAR` com `plano = ENTERPRISE` e usuário novo. A única mudança para os outros planos é o assunto do e-mail.
- APIs e integrações: Resend (já usada nesta rota) e OpenWA via `lib/whatsapp/openwa-client.ts#sendText` (já usada em crons e webhooks), na sessão padrão `OPENWA_SESSION_ID`.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso (ADMIN): botão **"Aprovar e Criar Acesso"** do cadastro Enterprise em `/admin-cadastros`.
  - **Modal V3 vermelho de confirmação (novo, só no Enterprise).** Usa o `confirmar()` de `lib/aviso` com `{ perigo: true, titulo: "Aprovar e enviar comunicado", botao: "Aprovar e enviar" }`: borda, título e botão em `#E24B4A`. O modal só fecha pelos botões (Escape cancela) e nunca ao clicar fora. Não usa `window.confirm()`. O telefone formatado aparece em linha própria, em destaque, para o ADMIN conferir o DDD. Texto do modal: "Aprovar o V3 Enterprise de {empresa}? Isso cria o login e envia na hora, sem volta: e-mail com login e senha provisória + aviso do white label (10 acessos previstos em contrato) para {email}, e WhatsApp com o aviso, sem a senha, para {telefone formatado}." Se o telefone não passar na regra, o modal diz "WhatsApp não será enviado: {motivo}".
  - **Depois da aprovação.** A tela mostra um `aviso()` com o resultado por canal, por exemplo "Comunicado do white label: e-mail enviado; WhatsApp enviado para +55 11 91217-7771". Em falha, mostra o motivo e o telefone usado, para o ADMIN mandar à mão.
- Ponto de acesso (cliente Enterprise):
  - e-mail "Bem-vindo à V3 Partners: Cadastro Aprovado!", com o bloco dourado do white label;
  - mensagem no WhatsApp.
- Estado vazio: sem telefone, ou com telefone fora da regra, só o e-mail sai. O modal e o aviso dizem o motivo.
- Sem UI? Não se aplica. A UI é o modal, o aviso da aprovação e os canais do cliente.
- Nota do porquê (tooltip): N/A. Não há campo, consulta nem aceite novo.

## TELEFONE (regra de validade, item 1.4)
`partner_registrations.telefone` é texto livre. Antes de enviar, o valor passa por `telefoneBrasilParaEnvio(t)` (função pura, testada):
- Primeiro, tira tudo que não é dígito, guardando se o texto começava com "+".
- Começa com "+":
  - só vale se for `+55` seguido de 10 ou 11 dígitos (DDD + número);
  - qualquer outro DDI **não é enviado automaticamente**, com o motivo "número estrangeiro: envie à mão".
- Sem "+":
  - 10 ou 11 dígitos: Brasil, recebe o prefixo 55;
  - 12 ou 13 dígitos começando com 55: Brasil, usado como está;
  - qualquer outro tamanho: **não envia**, com o motivo "telefone fora do padrão brasileiro: envie à mão".
- DDD:
  - precisa ser um DDD brasileiro existente (lista fechada dos 67 DDDs da Anatel);
  - celular de 11 dígitos precisa começar com 9 depois do DDD; se não começar, não envia.
- Número ambíguo nunca é enviado. O caso de 26/09 (número estrangeiro sem "+" tratado como brasileiro) só aconteceria com um número estrangeiro de 10 ou 11 dígitos sem "+" cujo começo coincida com um DDD brasileiro. Para cobrir esse caso, o modal mostra o número formatado como "+55 (DDD) ...", e o ADMIN confere antes de confirmar.
- **Formato gravado em `sdr_conversas.phone` e `sdr_leads.phone`: o mesmo que o webhook usa.** O webhook monta o phone com `chatIdToPhone(chatId)` (`app/api/sdr/webhook/route.ts`, linha 78) e busca `humano_ativo` por esse valor exato. Conta antiga sem o 9º dígito tem JID canônico de 12 dígitos. Por isso a rota:
  1. chama `verificarWhatsapp(digitos)` (o `/contacts/check`);
  2. se `existe` e houver `chatId`: envia com `sendText(chatId)`, que já aceita o JID (os dígitos do JID passam direto), e grava `phone = chatIdToPhone(chatId)` nas duas tabelas. Assim a trava do bot bate com o que o webhook procura, nos 12 ou nos 13 dígitos;
  3. se `existe = false`: **não envia**, e o aviso diz "número sem WhatsApp";
  4. se o check falhar (`null`, por queda do gateway): envia pelo dialável com `sendText(digitos)`, grava o dialável e o aviso diz "WhatsApp enviado, mas a trava do bot pode não valer para este número: marque Atendimento humano no inbox do SDR".

## DEPENDENCIES
- Deve existir antes: `RESEND_API_KEY`, `EMAIL_FROM`, `OPENWA_API_URL`, `OPENWA_API_KEY` e `OPENWA_SESSION_ID` em produção. Todas já são usadas.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: não.
  - Só o ramo ENTERPRISE muda. O e-mail dos outros planos fica idêntico, fora o assunto sem travessão (coberto por teste).
  - O `jaExiste` mais rigoroso só evita recriar usuário que já existe.
- LGPD e compliance: ver o Parecer de compliance (pendente, `[VALIDAR COM ROBSON]`).
- Texto contratual:
  - A frase "10 acessos previstos em contrato" repete o que a página pública de cadastro do Enterprise **já diz** desde o PR #385 (`components/cadastro-partner/cadastro-form.tsx`, linha 216: "o Enterprise tem 10 acessos ... conforme definido em contrato").
  - Mesmo assim, **hoje não existe contrato Enterprise gerado para a AGS**, e a cláusula dos 10 acessos e da garantia está pendente desde o BRIEF 2026-11-09_cadastro-partner-enterprise.
  - Por isso a frase vai ao parecer do Robson.
- Segurança de acesso ao banco: nenhum objeto novo e nada de `anon`.
  - As escritas em `sdr_conversas` e `sdr_leads` são feitas com a service role, só no servidor (`serviceClient()` da rota), como os crons e o webhook já fazem.
  - Quem lê a linha nova de `sdr_conversas`:
    - colunas gravadas: `partner_id = NULL` (bot interno da V3), `instance = 'openwa'`, `canal = 'whatsapp'`, `role = 'assistant'`, `content` com o prefixo `[Comunicado Enterprise]`;
    - a política de SELECT atual (`partner_id = auth.uid() OR staff`, migrations `20260823_sdr_whitelabel_partner.sql` e `20261030e`) deixa a linha visível **só para os papéis de staff** da política, no inbox interno do SDR, igual às linhas das campanhas;
    - o próprio cliente Enterprise **não** vê a linha, porque `partner_id` não é o id dele.
  - A linha de `sdr_leads` usa `partner_id = SDR_INTERNO_PARTNER_ID` (`00000000-…`), a mesma convenção do webhook, e segue a mesma visibilidade de staff.
  - O conteúdo gravado tem nome, empresa e e-mail do titular, e não tem senha.
- Performance: a aprovação faz 1 chamada a mais ao OpenWA (check + send), cerca de 1 a 2 s, com timeout de 10 s e `catch`. Essa chamada nunca bloqueia nem desfaz a aprovação. Não há chamada ao Claude, então não há risco do timeout de 60 s.
- (a) **Resposta do cliente cai no bot SDR.**
  - A sessão padrão `OPENWA_SESSION_ID` é a do bot interno: o webhook `app/api/sdr/webhook/route.ts` responde com IA a quem escreve nesse número, a menos que o lead tenha `humano_ativo = true`.
  - Mitigação: junto do envio, a rota faz upsert em `sdr_leads` (`phone`, `partner_id = SDR_INTERNO_PARTNER_ID`, `canal = 'whatsapp'`, `humano_ativo = true`). A resposta do cliente aparece no inbox interno para a equipe e a IA não responde.
  - A equipe desliga o atendimento humano quando quiser.
  - Achado lateral: os 8 lembretes de contrato Gold/Diamante de 10/11 saíram pela mesma sessão sem essa marcação. Fica registrado para o Hamilton decidir, fora deste BRIEF.
- (b) **Senha provisória fixa "12345678".**
  - Já é o comportamento de todos os planos (`route.ts`, linhas 58 e 181), com troca obrigatória no primeiro acesso (`must_change_password`).
  - Este BRIEF **não** passa a senha para o WhatsApp: ela continua só no e-mail, como hoje.
  - Risco aceito e mantido. Trocar por senha aleatória por usuário fica como pendência separada, porque muda o e-mail de todos os planos.
- (c) **`jaExiste` sem paginação.**
  - Hoje `listUsers()` só olha a primeira página.
  - Correção neste BRIEF: antes do `listUsers`, consultar `profiles` por e-mail (`ilike`, exato). Se achar, `jaExiste = true`, e nada é criado nem reenviado.
  - Isso sustenta a garantia "aprovação repetida não reenvia".
- (d) **`comunicado.email` confiável.**
  - No Enterprise, o envio do e-mail passa a ser `await`, e o bool vem de `res.ok` da Resend.
  - Sem `RESEND_API_KEY`, ou com exceção, o bool é `false`, com motivo.
  - O `whatsapp` é `true` só se `sendText` devolver ok. Nos outros casos é `false`, com o motivo (telefone fora da regra, sessão fora do ar, erro).
- Outro:
  - O remetente de fallback `onboarding@resend.dev` só é usado se `EMAIL_FROM` estiver vazio. Em produção, `EMAIL_FROM` está definido. Mantido.
  - OpenWA desconectado: só o e-mail sai, e o aviso mostra a falha.

## APPROACH
- Abordagem escolhida: estender o envio que já acontece na aprovação (um e-mail só, com o bloco do Enterprise) e somar o WhatsApp pela lib que já existe, com confirmação explícita antes. Os textos e a regra do telefone ficam num módulo puro, para teste unitário.
- Alternativas descartadas:
  - e-mail separado só do white label: dois e-mails seguidos confundem, e o segundo cai mais no spam;
  - disparo por script local, como foi feito para a AGS hoje: depende de alguém lembrar de rodar.

## DESENHO TÉCNICO
- `lib/enterprise/comunicado-aprovacao.ts`:
  - `telefoneBrasilParaEnvio(t): { ok: true, digitos, exibicao } | { ok: false, motivo }`;
  - `blocoWhiteLabelEmailHtml()`;
  - `mensagemWhatsappEnterprise({ nome, empresa, email })`.
  - Paleta V3, sem travessão, sem senha no WhatsApp.
- Rota, dentro de `if (!jaExiste)`, quando `planoRole === "ENTERPRISE"`:
  1. o e-mail vai com o bloco, com `await` e `res.ok`;
  2. se o telefone passar na regra: `verificarWhatsapp` e depois `sendText` conforme a seção "Telefone", com timeout; então insert em `sdr_conversas` e upsert em `sdr_leads` com `humano_ativo`, ambos com `phone = phoneParaHistorico(check, digitos)`;
  3. o retorno ganha `comunicado: { email: { ok, motivo? }, whatsapp: { ok, motivo?, telefone? } }`.
- Componente: no Enterprise, `confirmar(texto, { perigo: true, ... })` antes do POST. No sucesso, `aviso()` com o resultado por canal.
- Sem migration e sem rollback de banco. Reversão: revert do commit.

## PLANO DE TESTE
- Unitário:
  - `chatIdToPhone("554899868743@c.us")` → `554899868743` (JID de 12 dígitos) é o valor gravado em `sdr_leads.phone` quando o check devolve esse JID, e não o dialável de 13 dígitos (teste da função pura que escolhe o phone a gravar: `phoneParaHistorico(check, digitos)`);
  - regra do telefone com os casos `(11) 91217-7771`, `11912177771`, `5511912177771`, `+5511912177771`, `+1 305 555 0100`, `3055550100` (DDD 30 não existe: recusado), `12345`, vazio, DDD `00`, e celular de 11 dígitos sem 9;
  - o texto do WhatsApp tem nome, empresa, e-mail, "white label" e "10 acessos", e não tem senha nem travessão;
  - o bloco HTML só usa cores da paleta;
  - o assunto do e-mail não tem travessão.
- Produção, primeiro com um cadastro Enterprise interno, com e-mail e telefone da equipe (sugestão do QA):
  - aprovar e conferir o e-mail, o WhatsApp, a linha em `sdr_conversas`, `humano_ativo` em `sdr_leads` e o aviso na tela;
  - depois, excluir o usuário de teste.
  - Só depois disso aprovar a AGS.
- O que não é testável antes: o envio real só acontece na aprovação.

## ESTIMATE
S/M, cerca de 2 h, confiança alta.

## PARECER DE COMPLIANCE
**[VALIDAR COM ROBSON]**: bloqueia até a resposta, ou até um "go mesmo assim" do João ou do Hamilton com este item aceito. Perguntas ao Robson:
1. Enviar por WhatsApp, ao titular, no telefone que ele informou no cadastro, o aviso operacional do serviço contratado, sem senha, e guardar o texto no histórico interno do SDR (visível só para a equipe): a base legal é a execução de contrato (LGPD art. 7º, V)? Pode seguir?
2. A frase "com os 10 acessos previstos em contrato" pode sair na aprovação, antes de existir a minuta Enterprise com a cláusula? Ou ela deve virar "com os 10 acessos do plano V3 Enterprise" até a minuta ficar pronta?
- Data, quem respondeu e texto da resposta: (pendente)

---

## RELATÓRIO DO QA DE GOVERNANÇA
### Rodada 1 de 6: BLOQUEADO (5 falhas)
1. 1.4 Telefone e DDI: não havia regra de validade nem de formato. **Corrigido**: seção "Telefone".
2. 6.5 Leitura de `sdr_conversas`: faltavam `partner_id`, `instance` e quem lê. **Corrigido**: em Riscos, segurança de acesso.
3. 3.3 Ação irreversível sem confirmação. **Corrigido**: modal `confirmar()` na seção UX.
4. Compliance: o parecer tinha sido escrito pelo próprio autor. **Mantido como `[VALIDAR COM ROBSON]`**, com as perguntas listadas.
5. Riscos não declarados (a) a (d). **Corrigido**: em Riscos, com a mitigação ou o aceite de cada um.
- Sugestões acolhidas:
  - teste com um cadastro interno antes da AGS;
  - travessão do assunto do e-mail;
  - telefone e motivo mostrados no aviso;
  - prévia no modal.

### Rodada 2 de 6: BLOQUEADO (3 falhas)
1. 1.4 / Risco (a): o phone gravado (dialável, 13 dígitos) não batia com o phone do webhook (JID canônico, que pode ter 12 dígitos), e a trava do bot falharia. **Corrigido**: `verificarWhatsapp` + `phoneParaHistorico`, com o caso de falha do check declarado e um teste com JID de 12 dígitos.
2. 3.3: o modal do `confirmar()` era dourado, e ação irreversível exige modal vermelho. **Corrigido**: opção `perigo` no `confirmar()`, com `lib/aviso.ts` e `components/shared/toaster.tsx` no IMPACT.
3. Compliance `[VALIDAR COM ROBSON]`: sem resposta. **Aceito pelo Hamilton no "go mesmo assim" de 10/11/2026**, ver Registro de liberação.
- Sugestões acolhidas: telefone em linha própria no modal.
- Sugestão não acolhida, fora do escopo: as cores `#F5F1E8` e `#9BAFC5` do toaster existente. A variante vermelha nova usa só as cores da paleta, mais `#E24B4A`.

## REGISTRO DE LIBERAÇÃO
- QA: rodada 3 de 6, BLOQUEADO (1 falha: compliance [VALIDAR COM ROBSON]), seguindo por override
- Override: sim, "go mesmo assim" do Hamilton em 10/11/2026, aceitando **só** o item de compliance `[VALIDAR COM ROBSON]` (base legal do WhatsApp e do histórico, e a frase "previstos em contrato" antes da minuta Enterprise). As perguntas continuam abertas para o Robson; se ele negar, o envio por WhatsApp é desligado e a frase vira "com os 10 acessos do plano V3 Enterprise".
- Go dado por: (pendente)
- Migration aplicada em produção: não se aplica

### Rodada 3 de 6: BLOQUEADO (1 falha)
- Única falha: compliance `[VALIDAR COM ROBSON]`, sem resposta. As duas falhas técnicas da rodada 2 foram dadas como resolvidas.
- Sugestão acolhida no código: os motivos "número sem WhatsApp" e "check fora do ar" também entram em `comunicado.whatsapp.motivo` (Riscos, item d).
