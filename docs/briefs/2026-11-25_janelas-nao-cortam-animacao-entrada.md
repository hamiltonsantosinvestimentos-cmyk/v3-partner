# BRIEF: Janela do card da Mesa Operacional sem corte (animação de entrada)

> Data: 2026-11-25 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-25_janelas-nao-cortam-animacao-entrada.md` e commitar junto com o código.

## SCOPE
Pedido do Hamilton em 25/11/2026: "sobre a tela do card, e nao cortar a tela, na mesa operacional da v3 partners, consegue ajustar isso?"

**Causa.** O contêiner raiz da Mesa Operacional (`components/mesa-operacional/mesa-op-client.tsx:2214`) usa a classe `animate-fade-in`. Ela está definida em `app/globals.css:295-299`: `@keyframes fadeIn` termina em `transform: translateY(0)` e a animação usa `forwards`. Pela regra do CSS, um ancestral com qualquer `transform` diferente de `none` vira o bloco de referência dos elementos `position: fixed` dentro dele. Por isso a janela do card (`PropostaDetailModal`, que abre em `fixed inset-0` com `w-screen h-screen`) fica presa à área de conteúdo, deslocada pela barra lateral e pelo topo, em vez de ocupar a tela, e sai cortada. A janela de ticket, a de editar proposta e as demais da Mesa Operacional têm o mesmo problema. Foi a mesma causa do PR #430 (Nova Proposta), que ali foi resolvida com portal.

**Correção.** Alterar só o fim da animação em `app/globals.css`: `to { opacity: 1; transform: none; }`. A entrada continua igual (sobe 8 px e aparece em 0,28 s). Ao terminar, o `transform` fica `none` e o contêiner deixa de prender as janelas. Isso corrige a Mesa Operacional e as outras telas que usam a classe (73 ocorrências em 50 arquivos) que usam `animate-fade-in` com janelas dentro.

## IMPACT
- Arquivos afetados: `app/globals.css` (uma linha do `@keyframes fadeIn`).
- Tabelas afetadas: nenhuma.
- Rotas afetadas: todas as telas que usam `animate-fade-in`, entre elas a Mesa Operacional (`/mesa-operacional`), só no visual.
- APIs e integrações afetadas: nenhuma.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Mesa Operacional → Kanban → clique num card de proposta. A janela da proposta abre na tela inteira, sem corte à direita nem embaixo. O mesmo vale para a janela de ticket, a de editar proposta, a de pendência e a de resolução.
- Estado vazio: não se aplica.
- Sem UI? É só UI (CSS).
- Nota do porquê: não se aplica.

## DEPENDENCIES
- Deve existir antes: nada.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: algum elemento `fixed` que hoje depende, sem querer, de ficar preso a um contêiner com `animate-fade-in` passa a se posicionar pela tela. Esse é exatamente o comportamento esperado de `fixed`. Nos primeiros 0,28 s da animação o contêiner ainda tem `transform`, mas as janelas só abrem por clique, depois disso.
- LGPD e compliance: não se aplica, porque não há dado nenhum envolvido.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem alteração.
- Camadas (stacking context): o `transform` também cria um contexto de empilhamento. Com `none`, um filho com z-index dentro dessas telas (cabeçalho sticky, dropdown, tooltip) passa a disputar camada com o topo e a barra lateral do layout. É improvável, mas é a única regressão visual plausível, e por isso entra no plano de teste.
- Performance: nenhuma mudança (a mesma animação).
- Vercel timeout (60s): não se aplica.
- Outro: as janelas do tema do Enterprise herdam a correção, sem efeito no tema.

## APPROACH
- Abordagem escolhida: corrigir a origem no CSS (`transform: none` no fim da animação). Uma linha resolve todas as telas.
- Alternativas descartadas:
  - Portal (`createPortal`) em cada janela da Mesa Operacional, como no PR #430: exige mexer em uns dez componentes, e as outras telas continuariam com o problema.
  - Tirar `animate-fade-in` do contêiner da Mesa Operacional: corrige só essa tela.

## DESENHO TÉCNICO
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
```
Reversão: reverter o PR.

## PLANO DE TESTE
- Build da Vercel e o teste automático de telas.
- Em produção:
  - conferir no CSS publicado que o `fadeIn` termina em `transform:none`;
  - o Hamilton abre um card na Mesa Operacional e confere a janela em tela inteira.
- Conferir também a Nova Proposta (portal do #430), que deve continuar igual.
- Rolar a Mesa de Crédito e a tela de Usuários, abrir filtros e menus e conferir que o topo e a barra lateral continuam por cima do conteúdo.

## ESTIMATE
S. Cerca de 10 minutos. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 25/11/2026. LIBERADO, zero bloqueantes. Sugestões aplicadas: risco de stacking context registrado, teste de rolagem em Mesa de Crédito e Usuários, contagem corrigida (73 ocorrências em 50 arquivos).

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 1)
- Override: não
- Go dado por: Hamilton, 25/11/2026
- Migration aplicada em produção: não se aplica
