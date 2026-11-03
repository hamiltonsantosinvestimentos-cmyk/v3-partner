# BRIEF: remoção do MY ASSISTANT IA

> Data: 2026-11-02 | Autor: Claude, a pedido do Hamilton | Status: QA LIBERADO, aguardando go
> Encerra `docs/briefs/2026-11-01_my-assistant-ia.md` e cancela `docs/briefs/2026-11-02_assistente-autoconversa.md`.

## SCOPE
**Decisão do titular em 02/11/2026: excluir agora, sem esperar o Robson.** Etapa 1, deste BRIEF: tirar a aba, as rotas, a rotina diária, o código próprio e as variáveis de ambiente. Nenhum dado é apagado. Etapa 2, com BRIEF e go próprios, depois da resposta do Robson: excluir as 5 tabelas, que têm só 1 linha de configuração, e retirar a trava do SDR.

Fora do escopo: SDR da V3 e de partners; registros de 14/09/2026 em `sdr_conversas` e `sdr_leads`, preservados pelo item 4 do parecer do Robson; as tabelas `assistente_*` e os resíduos no gateway, preservados até a Etapa 2; endpoints genéricos de limpeza do gateway; apagar BRIEFs e pareceres, que ficam como histórico.

## IMPACT
- Arquivos removidos: `app/(platform)/meu-assistente/`, `app/api/assistente/`, `app/api/cron/assistente-retencao/`, `components/meu-assistente/`, `lib/assistente/`, `tests/unit/assistente-*.test.ts`, `tests/sql/assistente-acesso.sql`.
- Arquivos alterados: `app/(platform)/layout.tsx`, `components/layout/platform-shell.tsx`, `components/layout/sidebar.tsx`, `proxy.ts`, `vercel.json`, `lib/notas-do-porque.ts`, `scripts/audit-page-role-gates.js`, `lib/whatsapp/openwa-client.ts` (só funções usadas apenas pelo assistente).
- Tabelas: nenhuma alteração. As 5 tabelas `assistente_*` ficam sem gravação pela aplicação, com RLS ativa, até a Etapa 2; `assistente_config` segue lida pela trava do SDR.
- Rotas: saem `/meu-assistente`, `/api/assistente/*`, `/api/cron/assistente-retencao`.
- APIs: Anthropic e OpenAI deixam de ser chamadas por este módulo.
- Variáveis removidas da produção: `ASSISTENTE_WEBHOOK_SECRET`, `ASSISTENTE_ALLOWED_USER_IDS`, `ASSISTENTE_ANTHROPIC_API_KEY`, e `OPENAI_API_KEY` se a busca confirmar que nada mais a usa. Também as de preview no projeto `v3partners`.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: o item "MY ASSISTANT IA" some do menu lateral, onde só aparecia para os usuários de `ASSISTENTE_ALLOWED_USER_IDS`.
- Quem abrir `/meu-assistente` diretamente recebe a página 404 padrão.
- Sem estado vazio: não resta tela.

## DEPENDENCIES
- Pré-condição, conferida antes do deploy e repetida depois dele: `assistente_config.openwa_session_id` nulo (consulta ao banco); nenhuma sessão `assistente-*` nem com o final 6001 (listagem do gateway); nenhum webhook para `/api/assistente/webhook` (webhooks de cada sessão). Resultado registrado neste BRIEF. Se aparecer qualquer sessão ou webhook, Claude para sem limpar, não publica ou, se já publicado, não remove as variáveis, e devolve ao Robson em BRIEF próprio. [VALIDAR COM ROBSON] só nesse ramo, porque poderia ser evidência.
- Ordem e portões: (1) publicar o código sem o módulo e conferir mensagem real no SDR, sessão `ready` e cron fora do `vercel.json`; (2) remover as variáveis e conferir de novo. Reverter é refazer o PR e recolocar as variáveis, pois nenhum dado muda.
- Seção 6: sem DDL nesta etapa. Tabelas e políticas ficam como estão; as consultas pendentes desde 01/11 passam para a Etapa 2.
- Migrations pendentes: nenhuma nesta etapa.

## RISKS
- **Tabelas sem uso:** conferido em 02/11/2026: `assistente_config` tem 1 linha com `ativo` verdadeiro, sem sessão e sem número, e as outras 4 têm zero linhas. A aplicação deixa de gravar nelas. O acesso direto pela API do Supabase, do dono dessa linha, permanece até a Etapa 2, porque os grants e as políticas ficam. O go deste BRIEF registra a aceitação desse risco.
- **Resíduos no gateway:** podem restar `status_updates` por até 24 horas, linhas de `lid_mappings` de sessões apagadas e backups não verificados. Nenhum é apagado aqui. Os endpoints de limpeza continuam no gateway, para uso direto se o Robson decidir.
- **Avaliação de incidente:** segue pendente com o Robson. Esta etapa não exclui dado, então não prejudica a avaliação nem o item 4 do parecer. A rotina de retenção sai, mas as tabelas do módulo estão sem mensagens para reter.
- **SDR de partner com o 6001:** a causa das 34.779 mensagens segue existindo: `partner/sdr/connect` aceita qualquer número, sem filtro. A remoção não resolve isso. A linha em `partner_sdr_connections` da conta do Hamilton continua apontando para a sessão apagada; não é alterada, por ser possível evidência.
- **Regressão:** `lib/whatsapp/openwa-client.ts` é usado pelo SDR. Só saem as funções exclusivas do assistente; `createSession` e `startSession` ficam. A trava em `app/api/sdr/webhook/route.ts` fica até a Etapa 2: tolera tabela ausente e evita que uma sessão do assistente caia no SDR, além de manter o 500 em erro de banco. Typecheck, testes e conferência do SDR depois do deploy.
- **Chaves coladas no chat:** a chave pessoal da Anthropic (`ASSISTENTE_ANTHROPIC_API_KEY`, nunca a `ANTHROPIC_API_KEY` da V3) e a da OpenAI ficam expostas no histórico. Remover da Vercel e do `.env.local` não as invalida; o titular revoga nos painéis, depois do portão 2, e informa a data. Reverter depois disso exige chaves novas.
- Breaking changes: sim, o módulo deixa de existir; não há outro usuário nem dados de uso.
- LGPD: reduz o tratamento; sem dado novo.
- Performance: sem impacto, salvo uma rotina diária a menos.
- Vercel timeout (60s): sem mudança.

## APPROACH
- Abordagem: remover módulo e variáveis em PR único, e deixar as tabelas e a trava do SDR para a Etapa 2.
- Alternativa descartada: tirar a trava do SDR agora. Exigiria conferir webhooks de todas as sessões e mudaria o comportamento em erro de banco, sem ganho imediato.
- Alternativa descartada: só esconder a aba. Mantém código, tabelas e chaves sem uso, e foi pedido excluir.
- Alternativa descartada: reverter os merges com `git revert`. Os PRs misturam ajustes no gateway que podem ficar, e o conflito é maior do que remover diretamente.
- Mantido no gateway: endpoints de limpeza por sessão, genéricos e sem efeito se não forem chamados.

## ESTIMATE
Complexidade: S. Esforço: 1 a 2 horas. Confiança: Alta.

## PARECER DE COMPLIANCE
Não exigido nesta etapa: nada é apagado, e cessam a coleta e o uso pelo módulo; o armazenamento residual segue até a Etapa 2. A pergunta sobre excluir tabelas e resíduos segue para o Robson e condiciona a Etapa 2.

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 02/11/2026: BLOQUEADO, 6 falhas. Escopo reduzido para não apagar dados. Rodada 2, 02/11/2026: BLOQUEADO, 3 falhas, corrigidas neste texto. Rodada 3, 02/11/2026: LIBERADO, sem falhas.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO na rodada 3
- Go dado por: Hamilton, em 02/11/2026
- Pré-condição antes do deploy, 02/11/2026: `assistente_config.openwa_session_id` nulo; só a sessão do SDR da V3 no gateway, sem final 6001; 1 webhook nela, nenhum para `/api/assistente/`.
