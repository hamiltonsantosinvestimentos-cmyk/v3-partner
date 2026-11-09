# BRIEF: Contador real de documentos no card da Mesa Operacional

> Data: 2026-11-09 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-09_mesa-op-contador-docs-card.md` e commitar junto com o código.

## SCOPE
O card da proposta no Kanban da Mesa Operacional já mostra uma barrinha "X/8", mas o número está errado: o total é fixo em 8 e o anexado conta arquivos, não documentos. Corrigir para mostrar **o mesmo "X/Y enviados" que a aba Documentos do modal mostra** para aquela proposta, sem abrir o modal.

## IMPACT
- Arquivos afetados:
  - `lib/mesa-operacional/contador-docs.ts` (novo, helper puro sem I/O que replica a regra do modal)
  - `app/(platform)/mesa-operacional/page.tsx` (busca `portfolio_linhas` e calcula `docs_uploaded` / `docs_required` pelo helper)
  - `components/mesa-operacional/mesa-op-client.tsx` (só o rótulo, a cor e o tooltip da barrinha já existente)
  - `components/mesa-credito/proposta-detail-modal.tsx` (só um comentário apontando para o helper, sem mudar lógica)
- Tabelas afetadas: nenhuma alterada. Passa a **ler** `portfolio_linhas` (colunas `nome, documentos_pf, documentos_pj`, filtro `ativo = true`, ordem `ordem, nome`), igual ao `/api/portfolio` que o modal usa. `credit_desk_proposals` já é lida hoje com `select("*")` (`documents`, `checklist`, `metadata`, `credit_line`, `client_type`).
- Rotas afetadas: `/mesa-operacional` (Server Component). Nenhuma rota de API nova.
- APIs e integrações afetadas: nenhuma.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Mesa Operacional → Kanban de propostas → cada card, abaixo do nome do partner: barrinha + texto `5/12 enviados` (mesmo verbo do modal). Tooltip: "5 de 12 documentos do checklist enviados (mesma contagem da aba Documentos)". Completo (enviados = total, total > 0): barra e texto em ouro V3 (`primary`), em vez do verde atual, para seguir a paleta.
- Estado vazio: proposta sem documento mostra `0/12 enviados` com barra vazia. Checklist com total 0 (linha cadastrada com lista vazia para aquele tipo de cliente, ou tudo filtrado pela regra de imóvel): mostra `sem checklist` em cinza, sem barra, para não parecer completo.
- Sem UI? Não se aplica, é só UI.
- Nota do porquê (tooltip): sim, descrito acima.

## DEPENDENCIES
- Deve existir antes: `filtrarChecklistPorImovel` e `imovelGarantiaDaProposta` (`lib/checklist-imovel.ts`), `CHECKLISTS` e `DEFAULT_CHECKLIST` (`lib/credit-checklists.ts`). Todos já existem e são os mesmos que o modal usa.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: o número no card muda (de "X/8" para o valor real). Os outros quadros (`credit-desk-client`, `nivel1-client`) não mudam neste BRIEF.
- Divergência com o modal: o helper copia a regra do modal linha a linha (ver Desenho técnico), em vez de usar `resolveChecklistForLine`, que casa linha por prefixo e não filtra `ativo`. Risco residual: se alguém mudar a regra no modal depois, o card não acompanha sozinho. Mitigação: comentário nos dois lugares apontando um para o outro. Unificar o modal no helper fica para outro BRIEF (mexer no modal de 4.000 linhas aumenta o risco desta entrega).
- Numerador: conta item do checklist com arquivo em `documents` **ou** marcado à mão (valor verdadeiro em `checklist[id]`), igual ao modal. Arquivo com `doc_id` livre ("outro documento") não conta, também igual ao modal.
- Atualização: o card reflete o estado do carregamento da página. Anexar no modal só muda o card depois de recarregar (hoje já é assim).
- LGPD e compliance: nenhum dado pessoal novo exibido. Só contagem. Não expõe nome de arquivo nem conteúdo.
- Segurança de acesso ao banco (anon, RLS, views, funções): leitura no servidor com o service client que a página já usa, depois do filtro de acesso existente (equipe vê todas, partner só as suas). `portfolio_linhas` é catálogo interno sem dado de cliente e não vai ao navegador (só os dois números por proposta). Sem `anon`, view, função, grant ou política nova. Débito anterior registrado pelo QA e fora deste escopo: a consulta de propostas é `select("*")`.
- Performance: +1 consulta a `portfolio_linhas` por carregamento (tabela pequena). Cálculo em memória.
- Outro: propostas antigas com `doc_id` que não existe mais no checklist atual deixam de contar, igual ao modal.

## APPROACH
- Abordagem escolhida: helper `contarDocsChecklist(proposta, mapaPortfolio)` que reproduz exatamente o modal; o `page.tsx` monta o mapa do portfólio uma vez e chama o helper por proposta.
- Alternativa descartada 1: usar `resolveChecklistForLine`. Descartada: casa por prefixo, não filtra `ativo`, lê só `client_type` e não aplica o filtro de imóvel nas listas fixas, então diverge do modal (achado do QA, rodada 1).
- Alternativa descartada 2: buscar o checklist no navegador por card. Descartada: N requisições e o card piscaria.
- Alternativa descartada 3: coluna nova com contador. Descartada: exige migration e trigger e fica desatualizada quando o portfólio muda.

## DESENHO TÉCNICO
Sem migration, sem SQL de escrita.

Regra do modal reproduzida (proposta-detail-modal.tsx: montagem do mapa ~1666-1684, checklist ~4612-4615, marcados ~1646-1651):
```ts
// mapa: para cada linha ativa, na ordem (ordem, nome); se documentos_pf ou documentos_pj não vazio,
// mapa[nome.toLowerCase()] = { PF: pf ?? [], PJ: pj ?? [] }  (linha repetida: a última vence, igual ao modal)
const clientType = ((meta.client_type ?? p.client_type) === "PJ") ? "PJ" : "PF";
const docs = filtrarChecklistPorImovel(
  mapa[p.credit_line?.toLowerCase()]?.[clientType] ?? CHECKLISTS[p.credit_line]?.[clientType] ?? DEFAULT_CHECKLIST[clientType],
  imovelGarantiaDaProposta(p.metadata));
const marcados = { ...(objeto(p.checklist) ? p.checklist : {}) };
for (const d of documents) marcados[d.doc_id] = true;
docs_required = docs.length; docs_uploaded = docs.filter(d => marcados[d.id]).length;
```
Consulta: `svc.from("portfolio_linhas").select("nome, documentos_pf, documentos_pj").eq("ativo", true).order("ordem").order("nome")`. Erro na consulta: segue com mapa vazio (cai em CHECKLISTS/DEFAULT, como o modal quando o fetch falha).
Cliente: `{docs_uploaded}/{docs_required} enviados`, `title` com a explicação, `bg-primary`/`text-primary` quando completo, `sem checklist` quando total 0. Roles: sem mudança.

## PLANO DE TESTE
- Typecheck (`tsc --noEmit`) com exit 0.
- Script de leitura (só `select`) em produção rodando o helper em propostas reais: uma PF, uma PJ, uma com imóvel em garantia e uma com item marcado à mão sem arquivo; conferir contra a aba Documentos do modal das mesmas propostas.
- Depois do deploy: abrir /mesa-operacional e conferir que os cards batem com o modal.
- Não testável: perfil partner logado (sem conta de teste partner nesta sessão). O filtro de acesso não muda.

## ESTIMATE
S. ~40 min. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal novo: só exibe uma contagem de documentos de propostas que o usuário já pode ver hoje.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (2 falhas: numerador sem a marcação manual; resolução do checklist diferente do modal). Corrigido nesta versão.

Rodada 2 de 6: LIBERADO, zero falhas. Sugestões acatadas: modal no IMPACT (só comentário), texto "valor verdadeiro". Sugestão de teste unitário do helper: será feito junto com o código.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 2)
- Override: não
- Go dado por: Hamilton, 09/11/2026 (registrado pelo hook)
- Migration aplicada em produção: não se aplica
