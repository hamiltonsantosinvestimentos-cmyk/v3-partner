# BRIEF: MY ASSISTANT IA (Fase 1)

> Data: 2026-11-01 | Autor: Claude, a pedido do Hamilton | Status: EM QA
> Salvar em `docs/briefs/2026-11-01_my-assistant-ia.md` e commitar junto com o código.

## SCOPE
Nova aba MY ASSISTANT IA, de uso exclusivo do Hamilton. Ele cadastra o próprio celular e fala com um número de WhatsApp exclusivo do assistente, por texto ou áudio. A IA interpreta a mensagem, lança entradas, saídas e compromissos em um painel pessoal, responde a confirmação e responde consultas ("quanto gastei este mês?").

Fora da Fase 1: foto de comprovante, lembretes, resumo diário, contas a pagar, tarefas, anotações, perguntas gerais, Google Agenda, consulta ao CRM, pagamentos e envio de mensagens a outras pessoas. Pedido fora do escopo recebe a resposta "Ainda não sei fazer isso." e nada é gravado.

## IMPACT
- Arquivos afetados (novos):
  - `app/(platform)/meu-assistente/page.tsx` e `components/meu-assistente/*`
  - `app/api/assistente/webhook/route.ts`
  - `app/api/assistente/conexao/route.ts`, `app/api/assistente/verificacao/route.ts`
  - `app/api/assistente/lancamentos/route.ts`, `app/api/assistente/compromissos/route.ts`, `app/api/assistente/dados/route.ts`
  - `app/api/cron/assistente-retencao/route.ts`
  - `lib/assistente/acesso.ts`, `lib/assistente/interpretar.ts`, `lib/assistente/transcrever.ts`, `lib/assistente/executar.ts`
  - `supabase/migrations/20261101a_my_assistant_ia.sql` e `20261101a_my_assistant_ia_rollback.sql.txt`
  - `tests/unit/assistente-*.test.ts`
- Arquivos afetados (alterados):
  - `components/layout/sidebar.tsx`, `components/layout/platform-shell.tsx` e `app/(platform)/layout.tsx`: item de menu visível só para usuário autorizado.
  - `app/api/sdr/webhook/route.ts`: como defesa extra, ignora eventos da sessão do assistente antes do bloco que trata sessão desconhecida como bot interno, para que mensagem pessoal nunca entre em `sdr_conversas` ou `sdr_leads`.
  - `proxy.ts`: libera somente o caminho exato `/api/assistente/webhook`, com comparação de igualdade própria e fora de `PUBLIC_ROUTES` (que usa `startsWith`), para o gateway chegar sem sessão. A proteção dessa rota é a assinatura. `/api/cron/` já é público no proxy, então a rota de retenção valida `CRON_SECRET` por dentro e recusa também quando a variável estiver vazia.
  - `vercel.json`: agenda `/api/cron/assistente-retencao` uma vez por dia.
  - `lib/whatsapp/openwa-client.ts`: novas funções para registrar webhook, apagar mensagens guardadas, apagar mapeamentos de identidade e apagar sessão. **Essas funções não usam `resolveSessionId`:** `sessionId: string` é obrigatório, vazio é recusado e `DEFAULT_SESSION_ID` nunca é aceito. O envio do assistente também não usa o fallback: sem sessão própria, cron e exclusão pulam o gateway, e a verificação é recusada, para nunca atingir a sessão da V3 usada pelo SDR.
  - Novo endpoint no gateway `DELETE /api/sessions/:id/lid-mappings`, papel OPERATOR, com corpo `{ "phones": ["<só dígitos>"] }`, sem `+`, cobrindo `phone_e164` e a parte numérica de `whatsapp_id` do titular e do chip, inclusive a forma sem o 9º dígito. Age por `phones` e `sessionId` mesmo sem a linha da sessão, sem `requireSession`, para um 404 nunca esconder linhas remanescentes. Apaga de `lid_mappings` as linhas desses telefones e as linhas com `sessionId` igual ao da sessão, e remove os mesmos itens dos mapas em memória (`LidMappingStoreService` e `SessionLidResolver`).
  - `getSessionStatus` e `getSessionQr` passam a ser chamadas pelo assistente só com `openwa_session_id` próprio. Sem ele, a rota `conexao` não chama o gateway para status nem QR, e mostra o estado vazio, para nunca exibir o número ou o QR da sessão do SDR.
  - `services/whatsapp-gateway` (módulo de sessão e de mensagens): novo endpoint `DELETE /api/sessions/:id/messages/stored?before=<ISO>`, papel OPERATOR, que apaga as linhas dessa sessão anteriores à data nas tabelas `messages` (inclusive a cópia inline de mídia) e `baileys_stored_messages`, e apaga diretamente o arquivo arquivado (`mediaPath`), sem depender da varredura de órfãos. Só atua na sessão indicada e não existe envio em massa a partir dele. `before` é obrigatório e válido, senão responde 400. Se apagar um arquivo falhar, mantém a linha para a rodada seguinte, como `purgeExpired`, e devolve a contagem de pendentes. Desconectar e exclusão total só seguem com zero pendentes; caso contrário, mostram o erro e permitem repetir.
- Tabelas afetadas (novas): `assistente_config`, `assistente_verificacao`, `assistente_mensagens`, `assistente_lancamentos`, `assistente_compromissos`. Nenhuma tabela existente é alterada. Nada é gravado em `financeiro_records`, `crm_leads` ou no dashboard da empresa.
- Rotas afetadas: `/meu-assistente` (nova), `/api/assistente/*` (novas), `/api/sdr/webhook` (guarda de sessão).
- APIs e integrações afetadas: gateway OpenWA (nova sessão, webhook próprio com assinatura e novo endpoint de limpeza), Anthropic (Haiku 5.5 e Sonnet 5.5), OpenAI (transcrição de áudio, integração nova).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: item "MY ASSISTANT IA" no menu lateral, logo abaixo de "Mercado", na rota `/meu-assistente`. Para qualquer outro usuário, o item não aparece e a rota redireciona para `/unauthorized`.
- A tela tem 3 abas:
  - **Conexão:** QR Code do número exclusivo, status do número, campo do celular autorizado, botão "Enviar código", campo do código, e o botão vermelho "Excluir todos os meus dados".
  - **Finanças:** seletor de mês, cartões de entradas, saídas e saldo, lista de lançamentos, e botões "Novo lançamento", "Editar" e "Excluir".
  - **Agenda:** lista de compromissos futuros e botão "Ver anteriores", com "Novo compromisso", "Editar" e "Excluir".
- Estado vazio:
  - Conexão: "Nenhum número conectado. Gere o QR Code com o chip exclusivo do assistente."
  - Finanças: "Nenhum lançamento neste mês. Envie algo como: paguei 85 no mercado."
  - Agenda: "Nenhum compromisso futuro. Envie algo como: reunião com João terça às 15h."
- Sem UI? Não se aplica. O webhook é backend, e todo o resultado dele aparece nas abas acima.
- Nota do porquê (tooltip):
  - Celular autorizado: "O assistente só aceita mensagens deste número."
  - QR Code: "Use apenas o chip exclusivo do assistente, nunca o seu WhatsApp pessoal."
  - IA, na aba Conexão: "O texto é enviado à Anthropic e o áudio à OpenAI para processar o pedido. O servidor de WhatsApp da V3 mantém uma cópia técnica por até 48 horas. A transcrição fica guardada por até 90 dias, e o arquivo de áudio não fica no painel."

- Aba Conexão também mostra "Última limpeza: DD/MM/AAAA HH:mm", com alerta "A limpeza diária está atrasada. A cópia técnica pode ficar além de 48 horas." quando passar de 30 horas ou quando a última execução tiver falhado.
- Seletor de DDI: `+55` no topo e os demais em ordem alfabética do país, com `localeCompare("pt-BR")`.

### Desconectar número e revogar acesso
- "Desconectar número" (modal vermelho): lê o número do chip com `getSessionStatus` antes de parar; para a sessão; apaga arquivos e mensagens pelo endpoint de limpeza; apaga `lid_mappings` do titular, do chip e da sessão; e apaga a sessão no gateway, o que remove webhook, `messages` e `baileys_stored_messages` dela. O `stop` preserva o número, então uma repetição o lê de novo. Só depois da confirmação do gateway limpa `openwa_session_id`, `whatsapp_id`, `phone_e164` e `phone_verificado_em`. Assim, nada no gateway depende de uma exclusão total posterior. Se falhar, nada é limpo no banco V3, a tela mostra o erro e permite repetir, e 404 conta como já apagado e 409 como repetir. **Não altera `ativo`**: o dono continua vendo painel, lançamentos e compromissos, e reconectar exige novo QR e nova verificação. O modal explica isso e avisa que `status_updates` pode durar até 24 horas, que uma linha de `lid_mappings` cujo último registro veio de outra sessão continua, e que o aparelho pode continuar em "Aparelhos conectados" no celular do chip até ser removido ali.
- `ativo = false` significa só revogação de acesso. A rota `conexao` e o cron diário gravam `ativo = false` e desconectam a sessão de qualquer `user_id` que não esteja mais em `ASSISTENTE_ALLOWED_USER_IDS`. Entre a retirada do id e a execução do cron, a tela e as rotas já negam, e o acesso direto ao banco pode continuar por até 24 horas. A desconexão segue a mesma ordem acima: o cron tenta de novo até o gateway confirmar, e mantém o ponteiro da sessão até lá, para a limpeza continuar valendo. Os dados não são apagados na revogação, e o titular revogado não acessa a tela; a exclusão, nesse caso, depende de pedido dele a um sócio, que volta o id à lista temporariamente para que o próprio titular execute. [VALIDAR COM ROBSON] esse caminho. Se o id voltar à lista, `ativo` volta a true no primeiro acesso.

### Comportamento no WhatsApp
- Lançamento com valor, tipo e data claros: grava e responde "Lancei: saída de R$ 85,00 em Mercado, 01/11/2026. Para desfazer, responda DESFAZER."
- Sem data na mensagem: usa a data de hoje no fuso de Brasília e diz a data na resposta.
- Valor ou tipo ambíguo: não grava e faz uma pergunta. A resposta seguinte completa o lançamento.
- Compromisso sem horário claro ou com dia ambíguo: não grava e pergunta.
- DESFAZER: remove só o último registro criado pelo WhatsApp, em até 10 minutos, e confirma o que removeu, para poder ser lançado de novo. **Exceção declarada à regra 3.3:** o canal não tem modal, a janela é curta e o alcance é de um único registro. Qualquer outra exclusão acontece apenas na tela, com modal.
- Áudio maior que o limite do gateway (o payload chega com `omitted: true`): responde "Áudio muito longo. Envie em partes menores ou por texto."
- Falha de IA ou de transcrição: responde "Não consegui processar agora. Nada foi lançado. Tente novamente."
- Mensagem de qualquer outro número, de grupo ou enviada pelo próprio assistente: ignorada, sem resposta e sem gravação.

### Padrões de tela
- Moeda: máscara BRL ao digitar (`1.500,00`), guardada em centavos inteiros. Mínimo R$ 0,01 e teto de sanidade R$ 10.000.000,00, na tela, na API e no banco. Valor da IA fora da faixa não é gravado e gera pergunta de confirmação.
- Telefone: DDI selecionável com `+55` como padrão, máscara `+55 (XX) XXXXX-XXXX`, guardado em E.164. Depois de verificado, a rota `conexao` devolve o número já parcialmente oculto, e a tela mostra `+55 (11) *****-1234`.
- Datas: entrada e exibição em `DD/MM/AAAA`. `data` do lançamento é coluna `date` e é formatada sem `new Date("AAAA-MM-DD")`, para evitar deslocamento de fuso. Compromissos usam `timestamptz` e são exibidos em `America/Sao_Paulo`, como `DD/MM/AAAA HH:mm`.
- Ordenação:
  - Seletor de mês: mais recente primeiro.
  - Lançamentos: `data` decrescente, depois `created_at` decrescente.
  - Compromissos futuros: `inicio` crescente. Anteriores: `inicio` decrescente.
  - Categorias: lista fixa no código, ordenada com `localeCompare("pt-BR")`, com "Outros" sempre por último, por ser o valor residual.
- Ação irreversível: excluir lançamento, excluir compromisso, desconectar número e excluir todos os dados usam modal vermelho customizado V3, explicam o impacto e só fecham por botão explícito. Nunca `window.confirm()`. "Excluir todos os meus dados" exige digitar EXCLUIR e apaga: `assistente_lancamentos`, `assistente_compromissos`, `assistente_mensagens`, `assistente_verificacao`, `assistente_config`, as linhas da sessão em `messages` e `baileys_stored_messages` do gateway, os arquivos de mídia arquivados, as linhas de `lid_mappings` do telefone do titular e do chip e as gravadas por esta sessão, e a própria sessão no gateway. `lid_mappings` é compartilhada, mas guarda só a relação entre identificador e telefone: outra sessão que precise do mapeamento volta a aprendê-lo na mensagem seguinte. A ordem é: parar a sessão, para não regravar mapeamentos; apagar arquivos e mensagens; apagar mapeamentos; apagar a sessão. Sessão já parada segue para o passo seguinte. No gateway, 404 conta como já apagado e 409 como repetir, de modo que uma nova tentativa nunca trava. O modal também avisa: o chip pode ter aprendido o telefone de terceiros, e uma linha cujo último registro veio de outra sessão continua na tabela, sem conteúdo de mensagens. As linhas do banco V3 só são apagadas depois de o gateway confirmar; se ele falhar, nada é dado como excluído, e a tela mostra o erro e permite repetir. O modal avisa o que fica fora do alcance da V3: backups pelo período de retenção deles, jobs na fila do gateway por até 24 horas, `status_updates` do gateway por até 24 horas, que pode conter status de terceiros recebidos pelo chip, o que Anthropic e OpenAI retêm conforme as próprias políticas, e as mensagens no próprio WhatsApp do celular e do chip.
- Textos sem travessão e sem emoji, inclusive nas respostas do WhatsApp. O prompt da IA exige isso, e a resposta de confirmação é montada por modelo fixo no código, não gerada pela IA.

## DEPENDENCIES
- Deve existir antes:
  - Parecer do Robson (ver Parecer de compliance).
  - Alinhamento do uso pessoal da plataforma com João e Robson.
  - Chip exclusivo com WhatsApp ativo, providenciado pelo Hamilton.
  - Chave `OPENAI_API_KEY` na Vercel, e confirmação do modelo e do preço de transcrição antes do código.
  - Conferir antes do código que `claude-haiku-5-5` e `claude-sonnet-5-5` funcionam com a chave de produção e com o SDK instalado (`^0.80.0`), atualizando o SDK se preciso. Esses ids não constam em `lib/ai/registry.ts` e não serão adicionados à lista do SDR.
  - Novas variáveis na Vercel: `ASSISTENTE_ALLOWED_USER_IDS` e `ASSISTENTE_WEBHOOK_SECRET`.
  - Conferir no gateway de produção: se `message.received` entrega `media.data` em áudio, o limite efetivo de `WEBHOOK_MEDIA_INLINE_MAX_BYTES` (padrão de 1 MiB), `ENGINE_TYPE`, `QUEUE_ENABLED`, `CHAT_MEDIA_ARCHIVE_ENABLED`, `RESOLVE_LID_TO_PHONE`, o nível de log (não pode ser debug, que registra o remetente) e como publicar a nova versão do gateway. **Se o engine de produção não for Baileys, o que ele guarda localmente precisa ser conferido e coberto pela limpeza, ou o prazo de 48 horas é revisto e o BRIEF volta ao QA e ao Robson.**
  - Confirmar que o Postgres do projeto é 15 ou superior, por causa de `on delete set null (mensagem_id)`.
- Migrations pendentes: `20261101a_my_assistant_ia.sql`, com SQL mostrado e segundo go antes de aplicar em produção.

## RISKS (nunca "nenhum")
- Breaking changes: não para tabelas ou rotas públicas. A guarda em `/api/sdr/webhook` é a única mudança em fluxo existente, com risco de regressão no SDR, coberta pelo plano de teste.
- LGPD e compliance: **[VALIDAR COM ROBSON]** finanças pessoais e agenda ficam em banco da empresa, incluem nomes de terceiros e passam por Anthropic e OpenAI, com provável transferência internacional. Bloqueia até o parecer.
- Conta correta: decisão do Hamilton em 01/11/2026: a Fase 1 fica visível somente para o usuário `suporte@v3partners.com.br`, e o id é conferido em `profiles` antes de configurar a variável. A autorização é por id de usuário, não pelo papel ADMIN, então outros ADMIN não veem. A conta `hamilton@` não terá acesso. **Risco:** quem tiver a senha ou o acesso à conta `suporte@` verá as finanças e a agenda pessoais. O Hamilton confirmou em 01/11/2026 que a conta é de uso exclusivo dele.
- Segurança de acesso ao banco (anon, RLS, views, funções):
  - As 5 tabelas nascem com RLS ligada e `revoke all ... from public, anon, authenticated`, com grants mínimos depois.
  - `assistente_lancamentos` e `assistente_compromissos`: somente o dono autorizado lê e escreve, com regra imposta no banco: `user_id = auth.uid()` e existência de linha ativa dele em `assistente_config`. Só o servidor cria essa linha, e só para quem está em `ASSISTENTE_ALLOWED_USER_IDS`, então o uso exclusivo vale também para acesso direto ao Supabase. `ADMIN` e `GESTAO` não têm política e não leem pela sessão deles.
  - `assistente_config`: o dono só lê a própria linha. Só o servidor escreve.
  - `assistente_verificacao` e `assistente_mensagens`: sem grant e sem política para `authenticated`. Só o servidor acessa.
  - Nenhuma view, função `SECURITY DEFINER` ou bucket é criado. Áudio não vai para o Storage.
  - O webhook não tem sessão de usuário e usa a chave de serviço no servidor, nunca no navegador, sempre com o `user_id` resolvido a partir da sessão e do telefone verificados.
  - **Limite declarado:** quem administra o banco ou tem a chave de serviço tecnicamente consegue ler estes dados. A RLS impede leitura pela plataforma, não pela administração do banco. Na Fase 1 não há criptografia de campo.
- Bloqueio do número: o OpenWA não é API oficial, e o termo do WhatsApp pode levar ao banimento. O risco fica no chip exclusivo. Se ele cair, o painel e os dados continuam disponíveis.
- Interpretação errada: a IA pode lançar valor ou categoria errados. A mitigação é a confirmação com DESFAZER, a pergunta em caso de dúvida e a edição pela tela.
- Injeção por conteúdo: áudio ou texto encaminhado pode conter instruções. A IA só devolve JSON validado com Zod para as ações da lista fechada, e o código executa somente sobre os dados do dono. Não há ação de pagamento, envio a terceiros ou leitura de outras tabelas.
- Reentrega: o gateway pode reenviar eventos. `wa_message_id` único impede lançamento duplicado.
- Assinatura do webhook: requisição sem `X-OpenWA-Signature` válida (HMAC SHA-256 sobre o corpo bruto, com o prefixo `sha256=` usado pelo gateway e comparação em tempo constante com `timingSafeEqual`) é recusada com 401, antes de qualquer gravação ou chamada de IA.
- Identidade do remetente: o WhatsApp pode entregar `@lid` e contas antigas usam JID sem o 9º dígito, e `chatIdToPhone` não trata esses casos. Na verificação, o assistente guarda o `whatsappId` canônico devolvido por `/contacts/check`, e o webhook compara o remetente com esse valor, ou com `senderPhone` quando o gateway resolver o `@lid`. Sem correspondência exata, a mensagem é ignorada: a regra não é afrouxada. Testar isso com o número real na conexão.
- Dados fora do banco V3: o gateway grava cada mensagem recebida e enviada em `messages`, inclusive `body`, `metadata` e cópia em base64 da mídia, e, no engine Baileys, a mensagem inteira serializada em `baileys_stored_messages`, tabela sem expurgo por tempo e só com limite de 5.000 linhas por sessão. Com a fila ligada, o payload do webhook fica no Redis por até 1 hora após concluir e até 24 horas em falha. A Fase 1 passa a apagar diariamente, nessas duas tabelas e nos arquivos arquivados, o que esta sessão tiver com mais de 24 horas, de modo que a cópia técnica fica por até 48 horas enquanto o cron estiver rodando. Se uma rodada falhar, chega a 72 horas, e o alerta de 30 horas avisa. A sessão recebe nome neutro (`assistente-<id aleatório>`), sem telefone nem nome da pessoa. `lid_mappings`, tabela global do gateway, guarda a relação entre identificador e telefone enquanto a sessão existir, e desconectar, revogar ou excluir apagam as linhas do titular, do chip e da sessão. Antes de o cron e o endpoint existirem e serem testados, esse prazo não vale.
- Logs: o novo webhook não registra telefone, texto, transcrição nem valor, ao contrário do webhook SDR. Registra só id da mensagem, tipo e status.
- Custo: a Anthropic e a OpenAI cobram por uso. O limite é de 300 mensagens por dia; acima disso, o assistente responde "Limite diário atingido. Use a tela." e não chama a IA.
- Falta de crédito: se a API da Anthropic ficar sem crédito, como em 07/10/2026, o assistente responde a mensagem de falha e nada é lançado.
- Performance: uso individual, impacto desprezível no banco, com índices por `user_id` e data. Sessão adicional no gateway consome memória, a medir.
- Vercel timeout (60s): a rota declara `maxDuration = 60`. O webhook valida a assinatura, grava a mensagem, responde 200 e processa em `after()`, como o SDR. Há teto total de 50s: transcrição até 20s, IA até 20s, somando Haiku e Sonnet, e os 5s restantes para enviar a resposta; ao estourar, usa a mensagem de falha. Se a função morrer, a mensagem fica em `recebida`; o cron diário marca como `falhou` o que estiver assim há mais de 10 minutos, e a aba Conexão mostra a contagem, para o dono reenviar.
- Retenção: `assistente_mensagens` guarda texto e transcrição por 90 dias, e `assistente_verificacao` é apagada após verificar com sucesso ou 24 horas depois de expirar. Um cron diário da Vercel (`/api/cron/assistente-retencao`) faz essas limpezas e a do gateway e grava `ultima_limpeza_em`, e uma falha fica registrada em `execution_errors`, sem o conteúdo das mensagens, além do alerta na aba Conexão. Lançamentos e compromissos ficam até o dono excluir. O arquivo de áudio não vai para o banco V3 nem para o Storage, mas fica como cópia técnica no gateway por até 48 horas. [VALIDAR COM ROBSON] os prazos.
- Outro: se este código virar produto fora da V3, a propriedade dele precisa ser acordada antes com os sócios. Este BRIEF não trata disso.

## APPROACH
- Abordagem escolhida e por quê:
  - Número exclusivo e sessão OpenWA própria com webhook assinado. Assim a IA nunca lê as conversas pessoais do Hamilton com outras pessoas, e o bloqueio não atinge o número dele.
  - Tabelas próprias, separadas das finanças da empresa, para não misturar dados pessoais e números da V3.
  - Haiku 5.5 interpreta. Sonnet 5.5 entra uma vez apenas quando o Haiku devolve baixa confiança. Saída estruturada, validada com Zod.
  - Respostas de confirmação vêm de modelos fixos no código.
- Alternativa descartada e por quê:
  - Conectar o WhatsApp pessoal por QR Code: daria acesso às conversas com terceiros e colocaria o número principal em risco.
  - Gravar em `financeiro_records` ou no CRM: misturaria finanças pessoais com dados da empresa e exporia tudo aos papéis com acesso a essas telas.
  - API oficial da Meta: a resposta de atendimento é cobrada desde 01/10/2026 e pode haver regra adicional para IA, então fica para reavaliação antes de abrir o recurso a outras pessoas.
  - Reaproveitar o agente SDR: é feito para leads e grava em tabelas comerciais.

## DESENHO TÉCNICO

### Acesso
`lib/assistente/acesso.ts` lê `ASSISTENTE_ALLOWED_USER_IDS` no servidor. A variável não é `NEXT_PUBLIC`. No primeiro acesso de um usuário autorizado, a rota `conexao` cria a linha dele em `assistente_config`, e é ela que libera as políticas do banco. O layout passa apenas um booleano para o menu. Página e rotas repetem a checagem no servidor. As rotas de tela usam a sessão do usuário e respeitam a RLS em lançamentos, compromissos e leitura da config. A chave de serviço fica restrita ao webhook, ao cron de retenção (depois de validar `CRON_SECRET`) e às rotas `conexao`, `verificacao` e `dados`, depois da checagem de acesso.

### Criação da sessão e do webhook
A rota `conexao` cria a sessão com `createSession`, grava `openwa_session_id` e registra, na mesma etapa, o webhook em `POST /api/sessions/:id/webhooks`, com a URL de `/api/assistente/webhook`, `events: ["message.received"]` e `secret: ASSISTENTE_WEBHOOK_SECRET`. O QR só aparece na tela depois de o webhook ser registrado. Se o registro falhar, a tela mostra o erro e permite repetir.

### Fluxo do webhook
1. Valida `X-OpenWA-Signature` sobre o corpo bruto com `ASSISTENTE_WEBHOOK_SECRET`.
2. Aceita só `message.received`, sem `fromMe` e sem grupo.
3. Localiza `assistente_config` por `openwa_session_id`, e exige `ativo` e remetente igual ao `whatsapp_id` verificado. Caso contrário, ignora em silêncio.
4. Insere em `assistente_mensagens`. Conflito em `(user_id, wa_message_id)` encerra sem resposta.
5. Responde 200 e segue em `after()`: transcreve, se for áudio; interpreta; executa; responde.

### Verificação do celular
Código de 6 dígitos gerado com `crypto.randomInt`, enviado pelo número exclusivo e guardado só como hash SHA-256 com HMAC. Vale 10 minutos, com até 5 tentativas e até 3 envios por hora. Trocar o número exige nova verificação.

### Migration (`20261101a_my_assistant_ia.sql`)
```sql
create table if not exists public.assistente_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openwa_session_id text unique,
  phone_e164 text unique,
  whatsapp_id text unique,
  phone_verificado_em timestamptz,
  ativo boolean not null default true,
  ultima_limpeza_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistente_verificacao (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text not null,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0,
  envios_na_hora smallint not null default 1,
  janela_envios_inicio timestamptz not null default now()
);

create table if not exists public.assistente_mensagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_message_id text not null,
  tipo text not null check (tipo in ('texto', 'audio', 'outro')),
  texto text,
  status text not null default 'recebida'
    check (status in ('recebida', 'processada', 'aguardando_resposta', 'falhou', 'ignorada')),
  pendencia jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, wa_message_id),
  unique (id, user_id)
);

create table if not exists public.assistente_lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor_centavos bigint not null check (valor_centavos between 1 and 1000000000),
  categoria text not null,
  descricao text,
  data date not null,
  origem text not null check (origem in ('whatsapp', 'tela')),
  mensagem_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (mensagem_id, user_id)
    references public.assistente_mensagens(id, user_id) on delete set null (mensagem_id)
);
create index if not exists assistente_lancamentos_user_data_idx
  on public.assistente_lancamentos (user_id, data desc, created_at desc);

create table if not exists public.assistente_compromissos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz,
  local text,
  notas text,
  origem text not null check (origem in ('whatsapp', 'tela')),
  mensagem_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim is null or fim >= inicio),
  foreign key (mensagem_id, user_id)
    references public.assistente_mensagens(id, user_id) on delete set null (mensagem_id)
);
create index if not exists assistente_compromissos_user_inicio_idx
  on public.assistente_compromissos (user_id, inicio);

alter table public.assistente_config enable row level security;
alter table public.assistente_verificacao enable row level security;
alter table public.assistente_mensagens enable row level security;
alter table public.assistente_lancamentos enable row level security;
alter table public.assistente_compromissos enable row level security;

revoke all on public.assistente_config, public.assistente_verificacao,
  public.assistente_mensagens, public.assistente_lancamentos,
  public.assistente_compromissos from public, anon, authenticated;

grant select on public.assistente_config to authenticated;
grant select, insert, update, delete on public.assistente_lancamentos to authenticated;
grant select, insert, update, delete on public.assistente_compromissos to authenticated;

drop policy if exists assistente_config_dono on public.assistente_config;
create policy assistente_config_dono on public.assistente_config
  for select to authenticated using (user_id = auth.uid());

drop policy if exists assistente_lancamentos_dono on public.assistente_lancamentos;
create policy assistente_lancamentos_dono on public.assistente_lancamentos
  for all to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  );

drop policy if exists assistente_compromissos_dono on public.assistente_compromissos;
create policy assistente_compromissos_dono on public.assistente_compromissos
  for all to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  );
```
A retenção roda no cron da Vercel, e não em `pg_cron`, porque precisa chamar também o gateway. `on delete set null (mensagem_id)` exige Postgres 15 ou superior, a confirmar no projeto antes de aplicar.

### Reversão (`20261101a_my_assistant_ia_rollback.sql.txt`)
```sql
drop table if exists public.assistente_compromissos;
drop table if exists public.assistente_lancamentos;
drop table if exists public.assistente_mensagens;
drop table if exists public.assistente_verificacao;
drop table if exists public.assistente_config;
```
A reversão apaga os dados dessas tabelas. Antes de executá-la com dados reais, exportar o conteúdo a pedido do dono.

## PLANO DE TESTE
- Unitários: interpretação com respostas simuladas, faixa de valor, data sem deslocamento de fuso, DESFAZER, assinatura válida e inválida, reentrega do mesmo `wa_message_id`, número não autorizado e grupo ignorados, limite diário, comparação do remetente com `@lid` e sem o 9º dígito.
- Webhook sem sessão: POST com assinatura válida é processado, e com assinatura inválida recebe 401. As outras rotas de `/api/assistente/` sem sessão continuam recusadas.
- Sequência desconectar e depois excluir: desconectar já apaga mapeamentos, mensagens, arquivos e sessão, e a exclusão seguinte conclui sem chamar o gateway, sem linha remanescente do titular ou do chip. Limpeza com pendentes interrompe a sequência.
- Identidade na exclusão: depois da exclusão total, as linhas do titular e do chip não voltam, inclusive número sem o 9º dígito, e `lidsForPhone` devolve vazio. Mensagem presa em `recebida` é marcada como `falhou` pelo cron.
- Sessão nula: em cada caminho (cron, exclusão total, desconectar, verificação, envio, leitura de status e de QR), a função não chama o gateway com `DEFAULT_SESSION_ID`, e a sessão do SDR continua intacta. Funções destrutivas recusam vazio e o id padrão.
- Falhas do gateway: desconectar e revogação não limpam colunas se o gateway falhar; 404 conta como já apagado e 409 como repetir; o cron retoma. A exclusão total, repetida depois de falha parcial, conclui sem travar, e `lid_mappings` perde as linhas do titular, do chip e as gravadas por esta sessão. Uma linha de terceiro gravada por esta sessão é apagada, e uma cujo último registro veio de outra sessão é preservada. `before` ausente ou inválido retorna 400.
- Revogação: retirar o id da variável faz a tela negar na hora e, depois do cron, grava `ativo = false` e encerra a sessão. Desconectar mantém o painel acessível, encerra a sessão e exige nova verificação.
- Retenção: em sessão de teste do gateway, o novo endpoint apaga as linhas antigas em `messages` e `baileys_stored_messages` e o arquivo arquivado só da sessão indicada, e preserva as de outra sessão. Apagar uma mensagem com 90 dias preserva o lançamento, com `mensagem_id` nulo. O cron exige `CRON_SECRET` e recusa com a variável vazia. A exclusão total apaga o que está listado, e, com o gateway fora do ar, não apaga nada e mostra o erro.
- Acesso, em transação desfeita antes de aplicar a migration:
  - Anônimo: leitura e escrita negadas nas 5 tabelas.
  - Partner comum de teste, sem linha em `assistente_config`: não lê nem escreve linhas do dono, não consegue gravar `user_id` de outra pessoa e não consegue gravar nem ler linha própria.
  - ADMIN de teste: mesmo resultado do partner comum, pela sessão dele.
  - Dono de teste, com linha ativa: lê e escreve só as próprias linhas em lançamentos e compromissos, lê só a própria config, não escreve em `assistente_config` e não acessa `assistente_verificacao` nem `assistente_mensagens`. Não grava `mensagem_id` de mensagem de outro usuário.
  - Dono de teste com `ativo = false`: perde leitura e escrita.
  - Consultas de verificação da seção 6 do QA, depois de aplicar em produção.
- Regressão do SDR: mensagem na sessão padrão continua sendo respondida, e mensagem na sessão do assistente não cria linha em `sdr_conversas` nem em `sdr_leads`.
- Em produção, depois do deploy, com o número do Hamilton: texto de saída, áudio de entrada, compromisso, mensagem ambígua, DESFAZER, consulta do mês, mensagem de outro número sem resposta. Depois: editar e excluir pela tela, conferir estado vazio, e confirmar que a aba não aparece em outra conta.
- Perfis de teste: nunca partner real.
- Não testável antes de usar: taxa real de bloqueio do número e consumo de memória da sessão no gateway. Observar durante os primeiros 30 dias.

## ESTIMATE
Complexidade: L. Esforço: 20 a 30 horas, incluindo o endpoint de limpeza no gateway. Confiança: Média, porque a entrega de áudio e a configuração do gateway de produção e a escolha do modelo de transcrição ainda precisam ser confirmadas.

## PARECER DE COMPLIANCE
**Parecer do Robson e confirmação do João registrados por print em 01/11/2026, com o limite descrito abaixo.**

Perguntas ao Robson:
1. Finanças pessoais e agenda de um sócio podem ficar no banco da V3 Partners, em tabelas separadas, com acesso pela plataforma restrito ao titular, sabendo que a administração do banco e do gateway de WhatsApp tecnicamente consegue ler?
2. Agenda e descrições podem conter nomes de terceiros. Alguma restrição?
3. Pode enviar texto à Anthropic e áudio à OpenAI, com provável transferência internacional?
4. Retenção proposta: texto e transcrição por 90 dias; cópia técnica no gateway (mensagens e áudio) por até 48 horas, prazo que depende de uma limpeza diária a ser construída, e que muda se o motor em produção não for Baileys; fila e status no gateway por até 24 horas; lançamentos e compromissos até o titular excluir. Sem essa limpeza, o gateway guardaria mensagens sem prazo definido. A exclusão total não alcança backups, o que os provedores de IA retêm e as mensagens nos celulares. Está adequado?
5. Usar número de WhatsApp não oficial neste uso pessoal, sem atender clientes da V3, traz alguma objeção?
6. O uso pessoal da plataforma da empresa por um sócio está de acordo com o que João e Robson aceitam?
7. `lid_mappings` guarda a relação entre identificador e telefone, sem conteúdo de mensagens. Texto aprovado: fica sem prazo até a exclusão total. Depois da rodada 5, o BRIEF encurtou esse prazo: desconectar ou revogar também apagam.
8. Com acesso revogado, os dados ficam guardados, e o titular só os exclui se um sócio devolver o acesso temporariamente. Está adequado?
9. O chip também pode aprender o telefone de terceiros, na mesma tabela. Desconectar, revogar ou excluir apagam as linhas gravadas por esta sessão, mas uma linha cujo último registro veio de outra sessão continua. Está adequado?

Reconfirmações feitas depois da troca de conta e do ajuste de prazo:
- Pergunta 1: a conta autorizada é `suporte@`, de uso exclusivo do titular segundo ele, e quem controla a caixa desse e-mail pode, em tese, recuperar a senha.
- Pergunta 4: a cópia técnica é de até 48 horas, mas pode chegar a 72 horas se uma rodada de limpeza falhar.

Resposta repassada pelo Hamilton no chat em 01/11/2026, literal: "1- sim 2- sim 3-sim 4-sim 5-nao 6-sim e o joao deu ok tambem".

Data: 01/11/2026, repassada | Quem respondeu: Robson e João, segundo declaração do Hamilton no chat em 01/11/2026, literal: "pode aprovar mesmo assim, segue que o robson aprovou para mim e joao tambem" | Situação: perguntas 1 a 9 respondidas como aprovadas, autoria declarada pelo Hamilton e não comprovada por mensagem original | Arquivo do texto literal: não anexado, por decisão do Hamilton, que assume a declaração

Outras respostas digitadas pelo Hamilton no chat em 01/11/2026, literais:
- "pergunta 2- aprovado, sem restrição - pergunta 7 aprovado, pergunta 8 aprovado".
- "1- aprovado 4- aprovado 9-aprovado", referente às reconfirmações das perguntas 1 e 4 e à pergunta 9.
- "conta suporte é usado somente por mim hamilton santos".

Digitado pelo Hamilton no chat em 01/11/2026, literal: "robson: autorizo a seguir". Não cita as perguntas nem a redação atual das perguntas 7 e 9, e não há mensagem original anexada.

Print enviado pelo Hamilton em 01/11/2026, literal: "Eu, Robson, autorizo e aprovo integralmente o parecer do BRIEF MY ASSISTANT IA, referente às perguntas 1 a 9, incluindo expressamente o texto atual das perguntas 7 e 9." Arquivo: `docs/briefs/anexos/2026-11-01_my-assistant-ia_parecer-robson.png`. **Limite do registro:** o print mostra só o texto, sem remetente, conversa ou data visíveis. Foi registrado como enviado.

Print enviado pelo Hamilton em 01/11/2026, literal: "Eu, João, autorizo o uso pessoal da plataforma BRIEF MY ASSISTANT IA e concordo em prosseguir para a etapa de desenvolvimento do código, mesmo sem a realização de uma nova auditoria, considerando a aprovação do Robson e a correção da falha técnica identificada. GO MESMO ASSIM." Arquivo: `docs/briefs/anexos/2026-11-01_my-assistant-ia_override-joao.png`. **Limite do registro:** o print também mostra só o texto, sem remetente, conversa ou data visíveis. Foi registrado como enviado.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 6 de 6, a última. Veredito: BLOQUEADO (3 falhas).

- T1, técnica: linhas de exclusão e de teste contradiziam a limpeza de `lid_mappings`, e faltava teste. Corrigida no texto depois da rodada 6, **sem nova auditoria**, porque o teto de rodadas foi atingido.
- C1, compliance: parecer sem mensagem original do Robson e do João, apoiado só na declaração do Hamilton, titular interessado.
- C2, compliance: perguntas 7 e 9 sem resposta do Robson à redação atual, de prazo menor.

Passaram nessa rodada: moeda, telefone, datas, mascaramento, modais, ordenação, higiene de texto e seção 6. Observação do QA: se o gateway tiver mais de um nó, a limpeza da memória alcança só o nó que atendeu o pedido; conferir a topologia.
Não verificados: configuração do gateway de produção, versão do Postgres e ids dos modelos, que seguem como dependências. Migration e plano de acesso avaliados só por leitura.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 6). Devolvido ao João conforme a regra.
- Override ("go mesmo assim"): sim, do João, por print enviado pelo Hamilton em 01/11/2026 (`docs/briefs/anexos/2026-11-01_my-assistant-ia_override-joao.png`), sem remetente ou data visíveis. Falhas aceitas: T1, corrigida no texto depois da rodada 6, sem nova auditoria; C1 e C2, tratadas pelo print do Robson, com o mesmo limite de registro. Exceção do DESFAZER: aceita ao dar o go.
- Go dado por: "go mesmo assim" digitado em 01/11/2026 em sessão dentro do repositório, na conta do Hamilton, e registrado pelo hook (`GO_DADO`, override, válido até 02/11/2026 08:12 UTC).
- Migration aplicada em produção: não. Exige SQL mostrado e segundo go.
- Arquivos além da lista do IMPACT, dentro do escopo: `lib/assistente/formato.ts` (regras puras usadas na tela e na API), `lib/assistente/conexao.ts` (desconexão e revogação, compartilhadas por rotas e cron), `services/whatsapp-gateway/src/modules/session/session-cleanup.controller.ts` e `services/whatsapp-gateway/src/modules/chat-media/session-data-purge.service.ts` (os dois endpoints de limpeza), mais `lib/notas-do-porque.ts` (notas da tela).
- Dependências na data do código: `gpt-transcribe` listado com a chave OpenAI informada pelo Hamilton, preço de US$ 0,0045 por minuto segundo a documentação da OpenAI. Sem conferência: ids `claude-haiku-5-5` e `claude-sonnet-5-5` (chave local sem crédito), gateway de produção (Railway sem login), versão do Postgres e variáveis na Vercel.

> Código escrito sob o override acima. Pendente: segundo go da migration, deploy do gateway e testes de produção.
