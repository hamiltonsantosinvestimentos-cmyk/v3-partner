# tests/legacy

Suites aposentadas do CI e mantidas no repositório como **estudo de caso**. Ficam fora de
`tests/e2e` (o `testDir` do Playwright), então `npm run test:e2e` e o workflow
`.github/workflows/e2e-tests.yml` não as executam.

## ma-embarcacoes-pipeline.spec.ts (aposentada em 20/09/2026)

**O que cobria.** A esteira M&A de 4 etapas (FPA Compra, Carta de Intenção, FPA Venda e
Contrato de Venda): carregamento das páginas públicas, rejeição por validação, gate de acesso,
cálculo de dedução do FPA Venda e a timeline da esteira no painel `/propostas`, sempre contra
um deal room de fixture dedicado (nunca uma operação real).

**Por que existiu.** Serviu para ajustar o fluxo da Mesa. Foi decisão de João Lemos manter o
caso como legado e estudo de caso.

**Por que saiu do CI.** O CI roda contra o banco de produção e o app notifica de verdade. Cada
execução gerava cerca de 42 notificações do tipo `negociacao_falha` ("... rejeitada no cadastro
público") para a equipe da Mesa (avisos dentro do sistema; esta suíte não gerava push nem e-mail). Desde 25/07/2026 isso acumulou milhares de
notificações de teste nas caixas dos usuários. Decisão de João em 20/09/2026: sem notificações.

**Para reexecutar manualmente.** Copie o arquivo de volta para `tests/e2e/` e rode
`npx playwright test ma-embarcacoes`. Atenção: usa o banco de produção e notifica a equipe.
O ideal é apontar para um banco de teste antes de reativar.

**Lições do caso.**
- Teste que roda em produção não pode usar deal room de operação real (o teste original injetava
  ruído na timeline de uma operação de verdade a cada push).
- Toda rota que notifica precisa de um caminho de teste que não notifique pessoas reais.
