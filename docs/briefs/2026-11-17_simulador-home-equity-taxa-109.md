# BRIEF: Simulador Home Equity com taxa a partir de 1,09% a.m. + IPCA

> Data: 2026-11-17 | Autor: Claude (pedido do Hamilton) | Status: GO DADO
> Salvar em `docs/briefs/2026-11-17_simulador-home-equity-taxa-109.md` e commitar junto com o código.

## SCOPE
Trocar a taxa base do Home Equity de 0,89% a.m. + IPCA para **a partir de 1,09% a.m. + IPCA**, tanto no cálculo (parcela SAC, total, CET) quanto nos textos dos dois simuladores (interno da plataforma e público) e nas descrições da linha Home Equity que a plataforma mostra.

## IMPACT
- Arquivos afetados:
  - `components/simulador/home-equity-client.tsx`: constante `TAXA_BASE_MENSAL` 0.0089 → 0.0109 (única fonte do cálculo, importada também pelo simulador público) e 4 textos "0,89% a.m." → "a partir de 1,09% a.m." (cabeçalho, aviso da taxa contratada, tabela de parâmetros, PDF).
  - `components/simulador/home-equity-publico-client.tsx`: 1 texto "Taxa: 0,89% a.m. + IPCA" → "Taxa a partir de 1,09% a.m. + IPCA".
  - `app/api/regras-linhas/route.ts` (linha `home_equity`) e `components/mesa-credito/recomendacao-linha.tsx` (linha Home Equity): descrição "CET 0,7–0,9% a.m. + IPCA" → "Taxa a partir de 1,09% a.m. + IPCA".
  - `app/api/ia-assistant/route.ts`: texto de referência da IA "taxa 0,89%am + IPCA/TR" → "taxa a partir de 1,09% a.m. + IPCA/TR".
  - `components/simulador/home-equity-client.tsx`, rodapé do PDF: nova frase "O crédito ainda será analisado. Esta simulação não constitui aprovação de crédito." (pedido do Robson, ver Parecer).
- Tabelas afetadas: nenhuma.
- Rotas afetadas: `/simulador-home-equity` (plataforma), `/simulador-home-equity-v3` (público), `/api/regras-linhas`, `/api/ia-assistant`.
- APIs e integrações afetadas: nenhuma externa.
- Fora do escopo: linha "Crédito Ponto / CRI Início de Obra" (também 0,89% + IPCA, outra linha, não muda); Simulador Cash (1,29% + INCC, não muda); propostas já gravadas no CRM (o simulador não grava taxa nem parcela no lead).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: (1) plataforma, menu Simulador Home Equity: subtítulo do topo, caixa "Taxa contratada" no bloco Projeção IPCA, tabela de parâmetros e PDF exportado; (2) simulador público, tela de resultado: linha "CET estimado ... · Taxa a partir de 1,09% a.m. + IPCA"; (3) Mesa de Crédito, card da linha Home Equity na recomendação de linha; (4) respostas do Assistente IA sobre Home Equity.
- Estado vazio: inalterado (sem valor digitado o simulador não mostra resultado).
- Sem UI? Não se aplica, tem UI.
- Nota do porquê (tooltip): nenhum campo novo. O "a partir de" deixa claro que é taxa mínima; o aviso existente de simulação estimada, sujeita à análise, continua.

## DEPENDENCIES
- Deve existir antes: nada.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: parcelas e CET simulados sobem (ex.: R$ 300 mil em 180 meses, 1ª parcela sobe cerca de R$ 600). Partner que já mandou print de simulação antiga ao cliente vai ver valor diferente se refizer.
- LGPD e compliance: nenhum dado pessoal novo. Taxa exibida é publicidade de condição de crédito; "a partir de" + aviso de simulação estimada já existente reduzem risco de oferta enganosa.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem alteração de banco; rota pública `/api/public/home-equity-lead` não muda.
- Performance: nenhuma.
- Outro: textos espalhados podem ficar desalinhados se alguém citar 0,89% em material fora do repo (site do João, apresentações, Academy). Grep feito no repo: só os arquivos acima citam a taxa do Home Equity.

## APPROACH
- Abordagem escolhida e por quê: trocar a constante única `TAXA_BASE_MENSAL` (o comentário do arquivo já manda nunca duplicar a taxa) e os textos fixos. Mudança mínima e auditável.
- Alternativa descartada e por quê: guardar a taxa em tabela de configuração editável pelo admin. Exige migration, tela e RLS para algo que muda raramente; fica para quando houver pedido de taxa editável.

## DESENHO TÉCNICO
Sem migration, sem SQL. Só constante e strings em TSX/TS. Sem regra de role nova.

## PLANO DE TESTE
- Typecheck (`tsc --noEmit`) com exit 0.
- Conferência manual da conta: R$ 300.000, 180 meses, IPCA 4,83% a.a. → taxa mensal total = 1,09% + 0,394% ≈ 1,484%; 1ª parcela SAC = 1.666,67 + 4.452 ≈ R$ 6.119 (antes ≈ R$ 5.519).
- Após deploy: exportar o PDF e conferir a taxa e a nova frase no rodapé; conferir o card Home Equity na Mesa de Crédito; abrir `/simulador-home-equity-v3` e `/simulador-home-equity` em produção e conferir textos e parcela.
- Perfil de teste: conta suporte@ (ADMIN), nunca partner real.

## ESTIMATE
S, cerca de 20 minutos, confiança alta.

## PARECER DE COMPLIANCE
- Data e hora: 17/11/2026, 09:52. Quem respondeu: Robson Lino (compliance). Recebido por mensagem do Hamilton (print da conversa, `Captura de tela 2026-11-17 095307.png`), registrado neste BRIEF.
- Texto literal:
  1. "A partir de 1,09% a.m. + IPCA", junto com o aviso de simulação estimada que já existe, basta na página pública? **"alterar tambem"**
  2. O rótulo "CET estimado" pode continuar? **"continuar somente isso, sem tarifas"**
  3. O PDF exportado precisa de alguma ressalva? **"colocar que o credito sera analisado ainda, nao considera aprovação essa simulação."**
- Como o BRIEF atende:
  1. A página pública passa a mostrar "Taxa a partir de 1,09% a.m. + IPCA", como na plataforma.
  2. O rótulo "CET estimado" continua como está, calculado só com taxa + IPCA, sem tarifas. Nenhuma tarifa é somada.
  3. O rodapé do PDF ganha a frase: "O crédito ainda será analisado. Esta simulação não constitui aprovação de crédito." Arquivo: `components/simulador/home-equity-client.tsx` (bloco `.footer` do HTML do PDF).
- Texto da IA: mantém "IPCA/TR" e troca só a taxa, para não remover informação sem confirmação.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: **BLOQUEADO (1 falha)**.
- FALHOU: [Compliance] taxa anunciada em página pública é publicidade de condição de crédito; parecer "N/A" não basta. [VALIDAR COM ROBSON] cobrindo: (a) se "a partir de 1,09% a.m. + IPCA" com o aviso atual basta na página pública; (b) se o rótulo "CET estimado" (já existente, calculado só com taxa + IPCA) pode continuar; (c) se o PDF exportado precisa de ressalva. Alternativa: override registrado por João ou Hamilton.
- Sugestões tratadas: grep repetido em 17/11 (`0,89`, `0.0089`, `0,7–0,9` em app/components/lib) confirmou só os arquivos do IMPACT, mais a linha CRI Início de Obra, que fica fora. "IPCA/TR" no texto da IA fica como está; só a taxa muda (decisão da rodada 2). Plano de teste inclui o PDF exportado e o card da Mesa de Crédito. Hamilton avisa o João para alinhar o site.
- Passou: campos do protocolo, fonte única da taxa, higiene de texto, seção 6 (sem banco).

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO na rodada 2 (rodada 1 BLOQUEADO por falta de parecer; parecer do Robson registrado). Rodada 2: zero falhas; sugestões tratadas (contradição IPCA/TR corrigida; ressalva extra na tela pública opcional, não incluída).
- Override ("go mesmo assim"): não
- Go dado por: Hamilton, em 2026-11-17 (mensagem "GO" no chat). O hook não registrou em go-log.jsonl porque a sessão foi aberta fora do repo (hooks do projeto não carregados); estado do gate não foi editado à mão.
- Migration aplicada em produção: não se aplica
