# BRIEF: Mandato de Crédito PF e PJ, nova versão com a Cláusula 4-A (Cash Home e Cash Agro)

> Data: 2026-11-03 | Autor: Claude, a pedido do Hamilton | Status: QA LIBERADO, aguardando go
> Texto: `docs/contratos/2026-11-03_mandato-credito-clausula-4A-cash-home-agro.md`; contratos completos em `docs/contratos/2026-11-03_mandato-credito-{pf,pj}-com-4A.html`.

## SCOPE
Colocar em revisão dos sócios, na Central de Contratos, a nova versão das minutas "Mandato de Crédito (Cliente PF)" e "(Cliente PJ)", com a Cláusula 4-A entre as Cláusulas 4 e 5. Decisão do Hamilton em 03/11/2026 (caminho B): desativar as minutas aprovadas atuais e criar as novas com o mesmo nome, aceitando que mandatos PF e PJ não possam ser gerados até a aprovação.

Fora do escopo: alterar o texto aprovado no lugar (a rota `PATCH /api/contracts/templates/[id]` proíbe, linha 65); mudar o fluxo de aprovação; votar pelos sócios; alterar contratos já gerados.

## IMPACT
- Tabela `contract_templates`, só dados, sem DDL:
  1. Nas 2 linhas atuais (v1, aprovadas em 09/10/2026): `is_active = false`. Texto, versão, status e votos ficam como estão.
  2. 2 linhas novas, copiando das atuais `vertical`, `variables_map` (recalculado das variáveis do texto), `editable_sections`, `contract_series`, `origem`, `requires_counterparty_signature`, `head_declared_in_body`; com `body_text_raw` = arquivo `-com-4A.html`, `version = 2`, `review_round = 1`, `approval_status = 'em_revisao'`, `is_active = true`, `created_by` = id do Hamilton.
- Arquivos: nenhum código. Script de execução no scratchpad da sessão, fora do repositório.
- Rotas: nenhuma alterada. `/api/contracts/generate` passa a recusar mandatos até a aprovação, comportamento já existente.
- APIs: nenhuma. Aviso aos sócios: manual. A notificação automática só dispara pela rota; como a gravação é direta, o Hamilton avisa os outros 2 sócios no mesmo dia da gravação, com a mensagem pronta que Claude entrega junto com os links, e o aviso fica registrado neste BRIEF.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Central de Contratos > Minutas. As 2 minutas novas aparecem "Em revisão", com o mesmo nome. As antigas somem da lista, porque a listagem só mostra minutas ativas (`GET /api/contracts/templates`, linha 32); não há caminho na tela para reativá-las.
- Mesa de Crédito: ao gerar mandato PF ou PJ, a tela mostra o erro já existente: "Minuta ... ainda não foi aprovada pelo jurídico (status atual: em_revisao). Envie para revisão em Central de Contratos > Minutas antes de gerar contrato."
- Estado vazio: não se aplica; as minutas existem.

## DEPENDENCIES
- Texto revisado e decidido pelo Hamilton em 03/11/2026 (cláusula no arquivo acima).
- Migrations pendentes: nenhuma.
- Conferido no QA: a lista filtra `is_active = true` e o `generate` confere de novo e exige `aprovado`. Se a criação falhar depois da desativação, Claude reativa as antigas na hora.

## RISKS
- **Bloqueio de mandatos:** até os sócios aprovarem, nenhum mandato PF ou PJ é gerado. Aceito pelo Hamilton.
- **Reversão:** só por gravação direta no banco, porque a tela não mostra minutas inativas: voltar `is_active = true` nas antigas e `false` nas novas restaura o estado anterior, sem perda de dado. Os ids das 4 linhas e o comando de reversão ficam neste BRIEF depois da execução.
- **Duas minutas com o mesmo nome:** se algum ponto do código escolher pelo nome sem filtrar `is_active`, pode pegar a antiga. Conferido antes de gravar.
- **Quórum:** conferido no código: não há voto de jurídico, e com `valor_operacao_estimado` nulo 2 de 3 sócios aprovam (`[id]/review/route.ts`). Decisão do Hamilton em 03/11/2026: "os sócios irão aprovar lá", pela regra vigente da Central. O código não obriga o voto do Robson; como o texto tem ponto [VALIDAR COM ROBSON], a mensagem aos sócios pede expressamente o voto dele.
- **[VALIDAR COM ROBSON] Texto:** a cláusula ainda não teve parecer jurídico nem do Robson; os pontos sensíveis (multa com PF e CDC, aprovação pela comunicação da V3, multa mesmo com valor menor) estão listados no arquivo do texto. A revisão é justamente o que esta mudança abre; não há uso do texto antes da aprovação.
- **Numeração:** minuta de texto livre, sem renumeração automática. A cláusula entra como 4-A justamente para não renumerar as Cláusulas 5 a 14, e nenhuma remissão cruzada existente muda. A conferência final fica com a revisão dos sócios e do `@contract-legal-guardian`.
- **Variáveis:** `variables_map` é recalculado pelo padrão `{{...}}`, como na rota. A 4-A não traz variável nova; ficam `contratante_qualificacao`, `percentual_mandato` e `data_geracao_extenso`.
- Breaking changes: só o bloqueio acima. Performance e Vercel: sem impacto.

## APPROACH
- Abordagem: desativar e criar novas, como a própria rota orienta, preservando as aprovadas intactas para reversão. Ordem: desativar as antigas primeiro e só então criar as novas, para não haver instante com duas minutas ativas de mesmo nome.
- Alternativa descartada: editar o texto da minuta aprovada no banco, contornando a trava da rota.
- Alternativa descartada: minuta com nome diferente (caminho A); preferida por não bloquear mandatos, descartada pelo Hamilton.

## ESTIMATE
Complexidade: S. Esforço: 30 minutos. Confiança: Alta, depois da conferência de `is_active`.

## PARECER DE COMPLIANCE
Pendente por desenho: esta mudança só coloca o texto em revisão. Nenhum contrato usa a 4-A antes da aprovação na Central de Contratos.

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 03/11/2026: BLOQUEADO, 4 falhas (UX das inativas e reversão, aviso aos sócios, quórum, numeração), corrigidas neste texto. Rodada 2, 03/11/2026: LIBERADO, sem falhas.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO na rodada 2
- Go dado por: Hamilton, em 03/11/2026
- Executado em 03/11/2026:
  - Desativadas (v1, aprovadas): PF `34d25c87-64d7-46c2-a0c1-308f872d5c38`, PJ `27d1ecdc-708a-4969-915f-2d1c2fc6a765`.
  - Criadas (v2, em_revisao, ativas): PF `26be62e2-0955-48f8-8bad-a444f0f4d9bb`, PJ `3366f5e4-6925-482f-8c1a-8149f785c8c3`. Variáveis: contratante_qualificacao, percentual_mandato, data_geracao_extenso. `created_by` copiado das v1.
  - Reversão: `update contract_templates set is_active = (id in ('34d25c87-64d7-46c2-a0c1-308f872d5c38','27d1ecdc-708a-4969-915f-2d1c2fc6a765')) where id in ('34d25c87-64d7-46c2-a0c1-308f872d5c38','27d1ecdc-708a-4969-915f-2d1c2fc6a765','26be62e2-0955-48f8-8bad-a444f0f4d9bb','3366f5e4-6925-482f-8c1a-8149f785c8c3');`
  - Aviso aos sócios: pendente, a cargo do Hamilton.
