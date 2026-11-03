# BRIEF: MY ASSISTANT IA, conversa com o próprio número

> Data: 2026-11-02 | Autor: Claude, a pedido do Hamilton | Status: CANCELADO pelo titular em 02/11/2026, antes de qualquer código. Ver `2026-11-02_remocao-my-assistant.md`. Última auditoria concluída: rodada 3, BLOQUEADO. Datas em horário de Brasília, salvo indicação
> Altera `docs/briefs/2026-11-01_my-assistant-ia.md`, que descartou conectar o WhatsApp pessoal.

## SCOPE
Uso experimental por 30 dias, contados da conexão de uso real, depois da janela de teste. A data final fica em `ASSISTENTE_EXPERIMENTO_FIM`. No vencimento, a rotina diária `assistente-retencao` desconecta a sessão, salvo nova aprovação do Robson, que muda a data.

O titular conecta o próprio número (final 6001) como sessão do assistente e fala com ele pela conversa consigo mesmo ("Você"), por texto ou áudio, sem chip exclusivo. O assistente lança, consulta e responde nessa conversa. Lançamentos, compromissos e DESFAZER seguem como hoje.

Modo isolado no gateway: toda mensagem que não seja `fromMe` na conversa consigo mesmo é descartada na entrada do adaptador, antes de baixar mídia, gravar, registrar em log, disparar webhook ou chegar à IA. Mensagem encaminhada também é descartada, e o conteúdo de mensagem citada não é repassado, porque ambos são mensagens de terceiros mesmo dentro da conversa consigo mesmo.

Fora do escopo: ler, responder ou agir em qualquer outra conversa; grupos, status, contatos, chamadas e presença; uso com dados confidenciais da V3.

## IMPACT
- Gateway (`services/whatsapp-gateway/src/`):
  - `engine/adapters/isolated-session.ts` (novo): regra pura que diz se a sessão é isolada (nome com prefixo `assistente-`, sem configuração que possa desligar) e se a mensagem é da conversa consigo mesmo (igualdade exata com `sock.user.id` ou `sock.user.lid`, sem o sufixo de dispositivo; identidade vazia nega tudo).
  - `engine/adapters/baileys-lifecycle.ts`: em sessão isolada, `shouldSyncHistoryMessage` falso, `syncFullHistory: false`, `markOnlineOnConnect: false`, logger silencioso que ignora `BAILEYS_LOG_LEVEL`. Os eventos `messaging-history.set`, `contacts.*`, `chats.*`, `lid-mapping.update`, `groups.update`, `group-participants.update`, `group.join-request`, `call` e `presence.update` não são repassados.
  - `engine/adapters/baileys-events.ts`: filtro como primeira checagem de `handleMessagesUpsert`, antes de `processInboundMessage`; `handleMessagesUpdate` filtra por `key.remoteJid` antes do callback de confirmação; encaminhada (`contextInfo.isForwarded`) é descartada e `quotedMessage` é omitido.
  - `engine/adapters/baileys.adapter.ts`: lista de permissão. Sessão isolada aceita envio de texto para si mesma e download da própria mídia, e recusa as demais operações (`getNumberId`, grupos, contatos, status, foto, bloqueio, apagar conversa, encaminhar, reagir, presença, link de chamada).
  - `engine/adapters/baileys-lifecycle.ts` e `baileys-history.ts`: sessão isolada não chama `hydrateNames`, com spec provando que `groupFetchAllParticipating` e `resyncAppState` não rodam.
  - Bloqueio do número em sessão comum (`baileys-lifecycle.ts`): em `connectInner`, antes dos listeners, compara `state.creds.me` com `ISOLATED_PHONE`; em `handleConnectionUpdate`, no `open`, compara `sock.user.id`, o que cobre o primeiro pareamento por QR. Até essa segunda checagem, `handleMessagesUpsert` não processa mensagens em sessão sem prefixo com a variável preenchida. Se bater, comparando variantes de 12 e 13 dígitos em função local do gateway, encerra em status terminal, sem religar e sem apagar credencial. Sessão `assistente-` não inicia com a variável vazia. Em outras sessões, variável vazia não bloqueia nada, para não derrubar o SDR. Specs para 12 e 13 dígitos e para primeiro pareamento.
  - `engine/engine.factory.ts` (`purgeSessionData`) e `modules/session/session-engine-controls.ts`: em sessão isolada, apaga e confere o diretório de autenticação antes de remover a linha da sessão. Se restar, devolve 409 e a linha fica, para repetir. `session-engine-lifecycle.service.ts` segue tentativa com log, porque não é o caminho de desconexão pelo usuário. Spec do caso "falhou e repetiu".
  - `engine/engine.factory.ts` e `modules/session/`: sessão `assistente-` em motor diferente de Baileys é recusada ao iniciar.
  - `engine/adapters/baileys-message-mapper.ts` e `engine/interfaces/whatsapp-engine.interface.ts`: incluem `isSelfChat` no payload, calculado pelo gateway.
  - Specs de cada um dos pontos acima, com uma categoria de operação recusada por spec.
- Aplicação:
  - `app/api/assistente/webhook/route.ts`, `lib/assistente/acesso.ts`: aceita só `message.sent` com `fromMe` e `isSelfChat` verdadeiros, sessão igual à de `assistente_config`, `ativo`, `usuarioAutorizado`, `phone_verificado_em` e `whatsapp_id` preenchidos, e texto que não comece com a marca. Sem número conferido, a própria rota confere antes de seguir; se não conseguir, descarta sem gravar. Spec para "conectado e não conferido". Não usa `from`, que em `fromMe` é sempre o titular.
  - `lib/assistente/conexao.ts`, `app/api/assistente/conexao/route.ts`: confere o número conectado contra `ASSISTENTE_NUMERO_AUTORIZADO` (variável de servidor nova, só dígitos com DDI, 13 dígitos). A conferência roda no GET da tela, na primeira mensagem do webhook e na rotina diária, então não depende de a tela estar aberta. A comparação usa `variantesTelefone` apenas sobre esse valor configurado, para aceitar conta antiga sem o 9º dígito. Se divergir, desconecta e mostra o erro. Se bater, grava `phone_e164` em E.164 a partir da variável, `whatsapp_id` no formato `<dígitos>@c.us`, com os dígitos exatos do `phone` do status, sem `getNumberId`; esse é o destino das respostas, e o adaptador o aceita quando bate com a própria identidade da sessão, então funciona em conta de 12 ou 13 dígitos e `phone_verificado_em`.
  - `app/api/cron/assistente-retencao/route.ts`: desconecta quando passar de `ASSISTENTE_EXPERIMENTO_FIM`, ou se a variável estiver vazia. O POST de conexão recusa e o webhook descarta nas mesmas condições, e o GET desconecta. Variável vazia é a trava: nada conecta até ela ser preenchida. Na janela de teste, recebe início mais 1 hora, em ISO com fuso, e a publicação na Vercel é feita imediatamente antes da janela.
  - `partner_sdr_connections`: a linha da conta do titular aponta para sessão apagada; na entrega, `openwa_session_id` vira nulo e o status vira desconectado.
  - `lib/whatsapp/openwa-client.ts`: `garantirWebhookSessaoPropria` hoje retorna cedo se a URL já existe; passa a conferir os eventos e recriar o webhook com `["message.sent"]`.
  - `app/api/assistente/verificacao/route.ts`: responde 410.
  - `lib/assistente/executar.ts`: toda resposta começa com "Assistente:". `components/meu-assistente/aba-conexao.tsx`, `lib/notas-do-porque.ts`, `tests/unit/assistente-*.test.ts`.
  - Tela de erro: a conferência no webhook e na rotina não tem tela aberta, então o motivo vai para `audit_logs`, com `action` `assistente.numero_recusado`, e a aba Conexão lê o registro mais recente para mostrar "Este número não está autorizado. A conexão foi desfeita.".
- Tabelas: sem estrutura nova e sem migration. Identidade `@lid` fica no gateway (`isSelfChat`); os ids de resposta não são guardados; o aceite vai para `audit_logs`, gravado e aguardado no POST de `/api/assistente/conexao`, nos dois ramos (sessão nova e reinício), com `action` `assistente.aceite_conexao`, `entity` `assistente_config`, e versão do texto em `new_data`; sem aceite gravado não sai QR; o prazo fica em variável de servidor. O campo de aceite previsto antes em `assistente_config` não existe e foi descartado. Antes de conectar, rodar as consultas da seção 6 que ficaram sem conferir em 01/11 (texto das políticas e grant para `PUBLIC`).
- Rotas: `/api/assistente/webhook` passa a tratar só `message.sent`; `/api/assistente/verificacao` devolve 410.
- APIs: gateway OpenWA, Anthropic e OpenAI, sem integração nova.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: aba Conexão de `/meu-assistente`, sem campo de celular nem código. Selo "Modo experimental" com a data de reavaliação.
- Uso: conversa "Você" no WhatsApp do titular.
- Estado vazio: "Nenhum número conectado. Leia o QR Code com o seu WhatsApp."
- Dica `assistente_qr`: "Leia com o WhatsApp do número autorizado. O assistente só usa a conversa com você mesmo." A dica `assistente_celular` e o título "Número exclusivo" saem; o título passa a "Seu número", e o alt do QR a "QR Code para conectar o seu número".
- Modal de exclusão de dados: "Isso apaga seus lançamentos, compromissos e mensagens do assistente, e desconecta o seu número. Não pode ser desfeito. Cópias de segurança do servidor podem durar até o fim do prazo delas."
- Modal antes do QR, com botão "Entendi e quero conectar", sem caixa pré-marcada; o aceite fica em `audit_logs`: "O assistente só usa a conversa com você mesmo. As demais mensagens do número passam pela memória do servidor da V3 e são descartadas, sem gravação. Não envie aqui dados confidenciais da V3, de clientes ou de partners, nem dados pessoais de outras pessoas além de nomes em anotações."
- Conectado: "+55 (XX) *****-6001 conectado. Abra a conversa com você mesmo no WhatsApp e envie uma mensagem. Mensagens enviadas enquanto o servidor estiver fora do ar não são processadas."
- Número divergente: "Este número não está autorizado. A conexão foi desfeita."
- Sessão recusada ou sem identidade: "Não foi possível ativar o isolamento. Nenhuma mensagem será processada. Desconecte e conecte de novo."
- Áudio fora, se o teste assim decidir: "Áudio ainda não é aceito. Envie por texto."
- Modal vermelho de desconectar: "Isso encerra o assistente neste número e apaga as mensagens dele no gateway. Seus lançamentos e compromissos continuam salvos, e o WhatsApp no seu celular não é afetado. Cópias de segurança do servidor podem durar até o fim do prazo delas. Depois, remova o aparelho em WhatsApp > Dispositivos conectados." Se o diretório de autenticação restar: "Não foi possível concluir a limpeza. Tente de novo."

## DEPENDENCIES
- Pareceres do Robson: 1º, 2º e 3º recebidos, com os pontos em aberto listados em Portão de conexão.
- **Pré-condição 1, feita em 02/11/2026, 21h40:** o titular desconectou e informou ter removido do WhatsApp. A sessão não existe mais no gateway; a contagem das mensagens dela não foi possível depois de apagada, e isso é informado ao Robson. Podem restar `status_updates` por até 24 horas, linhas de `lid_mappings` de outra sessão e backups do volume.
- **Pré-condição 2, feita em 02/11/2026, 21h51, antes do 2º parecer:** sessão `partner-27a8…` apagada por ordem do titular. Registros dela no banco da V3, ainda não apagados: 250 linhas em `sdr_conversas` (147 recebidas e 103 respostas automáticas, de 7 telefones, em 14/09/2026, das 17:50 às 20:06 UTC) e 7 em `sdr_leads`. Preservados, conforme item 4 do 3º parecer.
- **Pré-condição 3:** verificar as condições de retenção, uso e tratamento de dados da Anthropic para a conta da chave pessoal, e o mesmo na OpenAI, que transcreve os áudios; registrar neste BRIEF. A conta da OpenAI é do Hamilton, informado em 02/11/2026.
- **Backups do volume:** o titular decidiu em 02/11/2026 não conferir o painel do Railway. A existência de backups fica como não verificada, e isso entra na avaliação de incidente entregue ao Robson.
- **Teste só no 6001:** decisão do titular em 02/11/2026, sem número descartável. Autorizado no item 5 do 2º parecer e no item 7 do 3º, depois dos testes automatizados.
- Ciência do João.
- Migrations pendentes: nenhuma.

## RISKS
- **Passagem pela memória e administração do gateway:** a biblioteca recebe e descriptografa as mensagens da conta inteira antes do filtro, e quem administra o gateway pode ler e enviar pelo número. Não há como evitar em aparelho vinculado. Autorizado para o experimental de 30 dias no item 2 do 2º parecer, com autoria confirmada.
- **Identificadores em disco:** a leitura do código da biblioteca indica que o diretório de autenticação grava chaves por contato e grupo (`lid-mapping`, `device-list`, `sender-key-memory`), o que pode incluir identificadores de terceiros, sem conteúdo de mensagem. Autorizado no item 3 do 2º parecer. Confirmar no teste, com resultado ao Robson; se houver conteúdo, o teste falha. O diretório é apagado ao desconectar.
- **Dados de terceiros digitados pelo titular:** "reunião com João terça" leva o nome de um terceiro à Anthropic pela chave pessoal. Não há como barrar por código. Nomes autorizados no item 4 do 2º parecer; dados confidenciais da V3 continuam fora, pelo 1º parecer.
- **[VALIDAR COM ROBSON] Mensagens já capturadas:** duas sessões guardaram conversas com terceiros. Investigação e tratamento autorizados no item 1 do 2º parecer, incluindo backups. Ainda faltam o resultado sobre backups e a resposta sobre incidente.
- **Sincronização desligada:** a biblioteca avisa que desligar tudo pode impedir o acesso aos mapeamentos de `@lid` e causar erros de sessão. Teste de estabilidade e de reconexão no 6001, por pelo menos 24 horas, depois de aprovada a janela inicial. Se instável, não há saída aprovada: religar a sincronização ampliaria o que passa pelo gateway, então o BRIEF volta ao Robson e ao QA.
- **Falha no filtro:** falha fechada; sem identidade, nada passa. Specs para número, `@lid`, grupo, status, sufixo de dispositivo, identidade vazia, encaminhada, citada, confirmação de entrega e terceiro com mídia.
- **Ciclo infinito:** a resposta do assistente também gera `message.sent`. Proteção única: a marca "Assistente:"; a aplicação ignora texto que comece com ela. Um texto do próprio titular começando assim é ignorado, comportamento aceito. Limite de 300 por dia mantido.
- **Mensagens fora do ar:** envio feito com o gateway desconectado chega como histórico e é descartado. Aviso na tela.
- **Regressão no SDR:** o deploy reconecta todas as sessões, e o adaptador é o mesmo. Filtro condicionado ao prefixo, spec provando que sessão sem prefixo se comporta como hoje, deploy fora do horário de uso.
- **Mesmo número em sessão sem prefixo:** foi assim que nasceram as 34.779 mensagens. Passa a ser bloqueado no gateway por `ISOLATED_PHONE`. Se a variável estiver vazia, o bloqueio não atua; a publicação confere que ela está preenchida.
- **Diagnóstico:** com logger silencioso, falhas da biblioteca nessa sessão não aparecem em log; o gateway registra só eventos de conexão.
- **OpenAI:** áudios podem levar nomes de terceiros à conta da OpenAI do Hamilton. Autorizado no item 5 do 3º parecer; só entra em uso depois da verificação de retenção. Até lá, teste e uso só com texto.
- **Bloqueio do número:** o OpenWA não é API oficial, e o risco é sobre o número principal do titular. Se cair, ele perde o WhatsApp pessoal.
- Breaking changes: o fluxo com chip deixa de funcionar nas sessões do assistente; não há outro usuário autorizado.
- Performance: o descarte na entrada evita download e gravação; custo pequeno de CPU por mensagem.
- Vercel timeout (60s): sem mudança, mantém `after()` e tetos atuais.

## APPROACH
- Abordagem: filtro na entrada do adaptador Baileys, decidido pelo nome da sessão, com lista de permissão de operações e checagem repetida na aplicação sobre `isSelfChat`.
- Alternativa descartada: filtrar só na aplicação. O gateway continuaria gravando e enviando conversas de terceiros, o que o parecer proíbe.
- Alternativa descartada: filtrar depois do mapeamento, no `message-projector`. A mídia de terceiros já teria sido baixada.
- Alternativa descartada: coluna nova para `@lid` e para ids de resposta. A marca e o campo do gateway resolvem sem migration.
- Alternativa descartada: chip exclusivo. Segue sendo a opção de menor risco; descartada por decisão do titular.
- Alternativa descartada: API oficial da Meta. Não oferece conversa com o próprio número como canal de automação.

## PORTÃO DE CONEXÃO
O código pode ser escrito e publicado com a trava `ASSISTENTE_EXPERIMENTO_FIM` vazia, sem nenhuma conexão. A variável só é preenchida quando todos os itens abaixo estiverem registrados aqui:
1. **F7:** uma linha do Robson, pelo canal dele, confirmando o 3º parecer com data e hora corretas.
2. **F8:** Robson confirma ou corrige por escrito a leitura sobre incidente, com responsável e data da avaliação.
3. **F9:** backups verificados sem apagar, ou decisão expressa do Robson de seguir sem essa verificação, ciente de que as mensagens foram apagadas às 21h51, antes do 2º parecer, e de que o titular decidiu não conferir o painel.
4. **F10:** lista de quem tem acesso ao serviço, ao volume e à chave do gateway, confirmada pelo Robson.
5. **F11:** condições de retenção da Anthropic e da OpenAI registradas, com data e fonte.
6. Consultas pendentes da seção 6, ciência do João, variáveis de produção preenchidas e specs aprovadas.
## ESTIMATE
Complexidade: L. Esforço: 14 a 22 horas, sendo 8 a 12 no gateway, além da janela de estabilidade de 24 horas. Confiança: Média, até o teste de `@lid`, áudio e sincronização.

## TESTE E CRITÉRIO DE ENTREGA
1. **Antes de conectar:** specs do filtro aprovadas, com terceiros simulados em teste automatizado.
2. **Número 6001:** matriz abaixo, na janela autorizada de no máximo 1 hora, acompanhada por Claude e pelo titular. **Ao fim da hora, a sessão é desconectada de qualquer forma.** As mensagens reais de outras pessoas continuam chegando na janela e passam pelo filtro. Qualquer falha: desconexão imediata, limpeza, verificação de backups e novo relato ao Robson.
2a. **Depois da janela:** resultado ao Robson. A reconexão para estabilidade de 24 horas e para uso depende de autorização escrita dele, vista a matriz.
3. Resultado anexado a este BRIEF e enviado ao Robson antes do uso real.

Cenários de aceite, com resultado esperado de lançamento salvo e resposta na conversa: texto, consulta, DESFAZER, identidade `@lid`, reconexão, e áudio, só depois da verificação da OpenAI.

Matriz de bloqueio, com resultado esperado de zero em todos os cruzamentos. Cenários: texto recebido, texto enviado a terceiro, mídia, grupo, status, chamada, reação, edição, revogação, confirmação de entrega, histórico inicial, encaminhada e citada na conversa consigo mesmo.
Locais conferidos em cada cenário: `messages`, `baileys_stored_messages`, `status_updates`, `webhook_delivery_failures`, `ingress_events`, `conversation_mappings`, `audit_logs`, `lid_mappings` (filtrado pela sessão, com linha de base), arquivos de mídia, diretório de autenticação (identificadores, relatado à parte), WebSocket, webhook (zero entregas), logs do gateway, logs da Vercel, `assistente_mensagens`.

## PARECER DE COMPLIANCE
**Robson Lino, 02/11/2026, 19h24. Aprovado com condições.** Origem: captura de tela enviada pelo Hamilton nesta sessão (`Captura de tela 2026-11-02 192526.png`). Texto:

1. **Conexão do WhatsApp pessoal (final 6001):** "Aprovo a conexão para uso exclusivo na conversa consigo mesmo, desde que o filtro de isolamento esteja efetivamente implementado e testado, impedindo que mensagens de terceiros sejam gravadas, armazenadas, processadas pela IA ou encaminhadas para fora do gateway."
2. **Sigilo e dados da V3:** "A aprovação não representa autorização para exposição de dados de clientes, partners ou operações da V3 a sistemas ou infraestruturas não homologados. Mesmo que as mensagens sejam descartadas posteriormente, sua passagem pela memória do servidor já caracteriza processamento de informação e precisa ser considerada na avaliação de segurança, privacidade e obrigações contratuais. Portanto, mensagens de terceiros devem ser bloqueadas antes de ingressarem no fluxo de processamento do assistente."
3. **Chave pessoal da Anthropic:** "O uso da chave pessoal é aceitável para a conexão experimental, desde que não implique envio de informações confidenciais ou dados pessoais de terceiros sem autorização institucional. Também devem ser verificadas as condições de retenção, utilização dos dados e tratamento pela Anthropic."

**Decisão:** "Aprovo o uso do WhatsApp pessoal para interação privada com o MY ASSISTANT IA, condicionado às salvaguardas acima. Esta aprovação não autoriza o tratamento de informações confidenciais da V3 fora dos ambientes e procedimentos aprovados pela empresa."

**2º parecer, 02/11/2026, 22h01 (Brasília), assinado "Robson". Origem: captura de tela enviada nesta sessão (`Captura de tela 2026-11-02 220350.png`). Texto:**

1. "Autorizo a investigação e o tratamento das duas sessões apagadas, incluindo possíveis backups."
2. "Autorizo o funcionamento experimental do gateway por 30 dias, para utilizar minha assistente, ciente dos riscos informados."
3. "Autorizo o armazenamento de identificadores de contatos e grupos, sem conteúdo das mensagens, priorizando exclusivamente a assistente."
4. "Autorizo o envio de nomes de terceiros digitados por mim à Anthropic, utilizando minha chave pessoal."
5. "Autorizo o primeiro teste real do filtro no número 6001, por até 1 hora, após aprovação dos testes automatizados, com desconexão imediata em caso de falha."

"Declaro estar ciente e de acordo com as condições acima. Robson – Autorizado em 02/11/2026, às 22h01."

**Pontos a confirmar no 2º parecer:**
- Autoria: o texto está na primeira pessoa do titular ("minha assistente", "digitados por mim", "minha chave pessoal"). Resolvido pela confirmação em captura de tela enviada nesta sessão (`Captura de tela 2026-11-02 220755.png`): "Confirmo as 5 autorizações de 02/11/2026, às 22h01, para o WhatsApp pessoal do Hamilton. Declaro estar ciente e de acordo com todas as condições descritas anteriormente. Robson Lino".
- O item 1 autoriza investigar e tratar, mas não diz se o caso exige tratamento de incidente. Ver item 3 do 3º parecer e Portão de conexão.

**3º parecer, "Autorização geral", assinado Robson Lino. Origem: captura de tela enviada nesta sessão (`Captura de tela 2026-11-02 221442.png`). Texto:**

"Autorizo Hamilton, titular do número final 6001, a conduzir o experimental de 30 dias e executar as atividades descritas nos sete pontos, incluindo: 1. Uso do experimental nas condições estabelecidas. 2. Funcionamento do gateway, ciente dos riscos de acesso às mensagens. 3. Investigação e tratamento das sessões apagadas, com avaliação de eventual incidente. 4. Análise dos registros de 14/09/2026, preservando evidências antes de qualquer exclusão. 5. Transcrição de áudios pela OpenAI, ciente da possibilidade de processamento de nomes de terceiros. 6. Uso dos identificadores exclusivamente para o funcionamento da assistente. 7. Teste no 6001 por até uma hora, com desconexão obrigatória e nova autorização antes do período de estabilidade de 24 horas e do uso real. Autorizo Hamilton a tomar as providências técnicas necessárias, respeitando os limites de segurança, privacidade e proteção dos dados envolvidos. Assinado: Robson Lino. Data: 02/11/2026. Horário: 22h01, Brasília."

Pontos em aberto neste parecer:
- O horário é o mesmo do 2º parecer (22h01), embora o texto responda a perguntas feitas depois, e a captura seja das 22h14. Foi enviado pelo titular; a origem no canal do Robson não foi conferida por Claude.
- Item 3: incidente fica em avaliação, sem decisão, e o texto não diz se ela condiciona a reconexão. Item 7 só exige nova autorização antes das 24 horas e do uso real, então a leitura adotada é: a avaliação segue em trilha própria e é entregue ao Robson antes dessa nova autorização.
- Item 4: `sdr_conversas` e `sdr_leads` de 14/09/2026 ficam preservados; nenhuma exclusão sem decisão posterior.
- Não indica quem administra o gateway nos 30 dias. Registro: Hamilton, administrador do repositório, salvo correção.

**Respostas pedidas ao Robson em 02/11/2026, para fechar a rodada 2:** autoria em texto dele; decisão de incidente e se ela condiciona a reconexão; memória e administrador do gateway; sentido de "priorizando exclusivamente a assistente"; OpenAI; registros em `sdr_conversas` e `sdr_leads`; 24 horas só depois da janela.

**Perguntas enviadas antes:**
1. Duas sessões do 6001 guardaram conversas com terceiros sem filtro. Uma, conectada nesta entrega, tinha mensagens de ao menos 10 conversas. Outra, criada em 22/08/2026 pelo SDR de partner, tinha 34.779 mensagens. Ambas foram apagadas; podem restar status por até 24 horas e backups do volume. Isso exige tratamento de incidente?
2. A biblioteca descriptografa todas as mensagens na memória do gateway, e quem administra o gateway pode ler e enviar pelo número. Isso é aceito para o experimental de 30 dias, ou a avaliação precisa ser concluída antes?
3. A autenticação pode gravar em disco identificadores de contatos e grupos, sem conteúdo. É aceitável? O resultado do teste será apresentado.
4. Nomes de terceiros digitados pelo titular, como em "reunião com João", podem ir à Anthropic pela chave pessoal?
5. Sem número descartável, por decisão do titular: autoriza o primeiro teste real do filtro direto no 6001, em janela de até 1 hora, depois dos testes automatizados, com desconexão imediata em caso de falha?

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 02/11/2026: BLOQUEADO, 15 falhas. Corrigidas neste texto as de filtro, escopo, identidade, ids de resposta, teste, procedimento de desconexão e UX. As de uso experimental com dados de terceiros, memória e identificadores em disco foram tratadas com o 2º parecer. Rodada 2, 02/11/2026: BLOQUEADO, 12 falhas. Rodada 3, 02/11/2026: BLOQUEADO, 11 falhas, F1 a F6 no código, corrigidas neste texto, e F7 a F11 só na conexão, levadas ao Portão de conexão. Rodada 4 pendente.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO na rodada 3
- Go dado por: pendente
- Estado em 02/11/2026: sessão `assistente-b280…` apagada pelo botão Desconectar às 21h40 (registro no log do gateway; contagem de mensagens dela não disponível depois de apagada). Sessão `partner-27a8…`, da conta hamilton@v3partners.com.br, criada em 22/08/2026 com o final 6001, apagada por ordem do titular, às 21h51: 34.779 linhas em `messages` e 452 em `baileys_stored_messages`; segunda limpeza devolveu zero. Backups do volume, se houver, não foram tratados. A linha em `partner_sdr_connections` dessa conta continua apontando para a sessão apagada. Sessão do SDR da V3 voltou a `ready`. Nenhuma sessão do 6001 no gateway.
