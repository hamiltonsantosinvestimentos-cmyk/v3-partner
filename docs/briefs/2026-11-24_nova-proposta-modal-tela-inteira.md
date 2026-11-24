# BRIEF: Nova Proposta abre na tela inteira e mais larga

> Data: 2026-11-24 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-24_nova-proposta-modal-tela-inteira.md` e commitar junto com o código.

## SCOPE
Pedido do Hamilton em 24/11/2026: "quando abro a mesa de credito da AGS, ele fica em meia tela a nova proposta, abrir a tela maior para aparecer os dados para preenchimento."

A causa não é da AGS. Em `components/mesa-credito/nivel1-client.tsx`, a página do Nível 1 fica dentro de um `div` com a classe `animate-fade-in`. Essa animação termina com `transform: translateY(0)` e fica aplicada por causa do `forwards`. Um ancestral com `transform` passa a servir de referência para os elementos `position: fixed` dentro dele. Assim, o fundo e a janela de `NovaPropostaModal` (`fixed inset-0`) ficam presos à área da página, e não à tela, e a janela abre cortada.

O mesmo problema já foi corrigido em `pedido-detail-modal.tsx` com `createPortal(…, document.body)`.

Correção:
1. `NovaPropostaModal` passa a ser renderizado com `createPortal` direto em `document.body`. Assim ele ocupa a tela inteira em qualquer página que o abra.
2. A janela fica mais larga e mais alta: `max-w-2xl` (672 px) passa para `max-w-4xl` (896 px), e `max-h-[92vh]` passa para `max-h-[calc(100vh-3rem)]`. Os campos que já estão em grade de 2 colunas ganham espaço.

Vale para todos os usuários (V3 e Enterprise) em todos os pontos que abrem a janela: Nível 1, `credit-desk-client` (Níveis 2 e 3), CRM e Mesa Operacional.

## IMPACT
- Arquivos afetados: `components/mesa-credito/nova-proposta-modal.tsx`, só os dois `return` com o invólucro `fixed`: o de sucesso (linha ~726) e o do formulário (linha ~779).
- Tabelas afetadas: nenhuma.
- Rotas afetadas: nenhuma.
- APIs e integrações afetadas: nenhuma. O envio do formulário não muda.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: o botão "Nova Proposta" em Mesa de Crédito › Nível 1 (e nos Níveis 2 e 3, no CRM e na Mesa Operacional). A janela abre centralizada no topo da tela, com o fundo escuro cobrindo a tela inteira, 896 px de largura e altura até a tela menos 3 rem. O conteúdo rola dentro da janela.
- Estado vazio: não se aplica.
- Sem UI? Há UI.
- Nota do porquê (tooltip): não se aplica.

## DEPENDENCIES
- Deve existir antes: nada. `react-dom` já está no projeto e `createPortal` já é usado em `pedido-detail-modal.tsx` e `prospeccao-client.tsx`.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - Com o portal, a janela sai da árvore do DOM da página. O estado continua no React (props e estado do componente), então os eventos e o formulário funcionam igual.
  - É preciso proteger o render no servidor: o portal só é criado no cliente, porque o componente já é `"use client"` e só abre depois de um clique (`open`). Mesmo assim, uma função `noBody()` única no arquivo faz a checagem `typeof document` e o portal, usada pelos dois `return`.
- LGPD e compliance: sem mudança de dado. Só a apresentação.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem alteração.
- Performance: nenhuma.
- Outro:
  - Em telas estreitas (celular), `max-w-4xl` com `w-full` continua ocupando a largura disponível menos o `p-4`.
  - O único seletor da janela é um `<select>` nativo, que o navegador desenha fora da pilha de z-index; não há popover Radix a conferir.

## APPROACH
- Abordagem escolhida: portal para `document.body`, o padrão que já existe no projeto, mais o aumento do tamanho. O portal resolve a causa em qualquer página, inclusive em outras que no futuro usem `animate-fade-in`.
- Alternativa descartada:
  - Tirar `animate-fade-in` do Nível 1 ou trocar `forwards` no CSS global. Resolveria só esta tela, ou mudaria a animação da plataforma inteira.
  - Tela cheia (100% da largura). O formulário tem campos de texto curtos e ficaria espalhado demais em monitores largos. 896 px dá duas colunas confortáveis.

## DESENHO TÉCNICO
```tsx
import { createPortal } from "react-dom";
// nos dois returns:
if (typeof document === "undefined") return null;
return createPortal(
  <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
    <div className="bg-card ... w-full max-w-4xl max-h-[calc(100vh-3rem)] flex flex-col animate-fade-in">…</div>
  </div>,
  document.body,
);
```
A janela de sucesso continua com `max-w-lg`. Só muda o portal.

Reversão: reverter o PR.

## PLANO DE TESTE
- Lint e o build da Vercel.
- Na prévia e em produção, com uma conta V3:
  - abrir Mesa de Crédito › Nível 1 › Nova Proposta: a janela cobre a tela inteira, com 896 px de largura e os campos visíveis;
  - fechar com o X;
  - abrir pelo Nível 2 ou 3, pelo CRM e pela Mesa Operacional e conferir o mesmo comportamento;
  - conferir em largura de celular (cerca de 400 px) que a janela ocupa a largura menos as margens.
- Pedir ao Hamilton que confira com o usuário teste da AGS em agsfinance.app (o agente não digita senha).
- Não vou enviar uma proposta real só para testar a janela de sucesso. Ela usa o mesmo invólucro e foi conferida na leitura do código.

## ESTIMATE
S. Cerca de 15 minutos. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal novo: muda só o tamanho e o ponto de montagem da janela.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6, 24/11/2026. VEREDITO: LIBERADO PARA "GO". Zero bloqueantes.
Sugestões aplicadas: (1) risco dos popovers corrigido (só há `<select>` nativo); (2) guarda de `document` e portal numa função única; (3) plano de teste com Níveis 2/3 e celular. Registrada fora do escopo: fechar com Esc (manter sem fechar ao clicar fora, porque o formulário é longo).

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 1)
- Override: não
- Go dado por: pendente
- Migration aplicada em produção: não se aplica
