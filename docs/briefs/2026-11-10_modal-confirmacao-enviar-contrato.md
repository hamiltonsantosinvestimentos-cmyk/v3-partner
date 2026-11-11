# BRIEF: Modal de confirmação antes de "Gerar e enviar para assinatura" (Contrato de Parceria / Gold / Diamante)

> Data: 2026-11-10 | Autor: Claude Code (pedido do Hamilton) | Status: GO DADO (Hamilton, 10/11/2026)
> Pedido literal (10/11/2026): "faz o modal de confirmação no enviar contrato". Origem: achado do QA de governança (regra 3.3) nos BRIEFs 2026-11-10_contrato-enterprise-item-3-1-acordo-comercial e 2026-11-10_contrato-parceria-anuidade-do-anexo-iii.

## SCOPE
Em `/admin-cadastros`, no card "Enviar contrato" do cadastro aprovado, o botão **"Gerar e enviar para assinatura"** passa a abrir o modal V3 **vermelho** de confirmação (`confirmar()` com `perigo`, o mesmo do PR #390) antes de gerar o contrato e mandá-lo ao ClickSign. Sem confirmar, nada é gerado nem enviado. Vale para as duas famílias que usam o card: Contrato de Parceria (Partner, Partner PRO, Enterprise) e Gold/Diamante.

## IMPACT
- Arquivos afetados:
  - `components/admin-cadastros/enviar-contrato-parceria.tsx`: `gerarEEnviar` chama `confirmar()` depois da validação dos campos e antes do `fetch` de geração; o componente guarda também a anuidade lida da minuta (`anuidadeDoAnexoIII`, só família parceria) para mostrar no modal, sem guardar o HTML;
  - `lib/contrato-parceria-partner.ts`: nova função pura `textoConfirmacaoEnvio(...)`, que monta o texto do modal (testável);
  - `tests/unit/confirmacao-enviar-contrato.test.ts` (novo).
- Tabelas afetadas: nenhuma.
- Rotas afetadas: nenhuma. `POST /api/contracts/generate` e `POST /api/contracts/[id]/send` não mudam.
- APIs e integrações: nenhuma nova. O ClickSign só é chamado depois da confirmação, como hoje depois do clique.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso (ADMIN): `/admin-cadastros` → abrir um cadastro aprovado → card "Contrato de Parceria v2.4" (ou "Contrato V3 Gold / V3 Diamante") → "Enviar contrato" → preencher → **"Gerar e enviar para assinatura"** → modal.
- Modal (vermelho, borda, título e botão em `#E24B4A`; fecha só pelos botões; Escape cancela; nunca fecha ao clicar fora; não usa `window.confirm()`):
  - título: "Enviar contrato para assinatura";
  - botão de ação: "Gerar e enviar"; botão de saída: "Cancelar" (com foco inicial, como já é no `confirmar()`);
  - texto, em linhas próprias para conferência:
    - "Isso gera o contrato e envia na hora para assinatura no ClickSign, sem volta. Para desfazer, só cancelando o contrato na Central de Contratos."
    - "Contrato: {título} {versão da minuta}" (ex.: "Contrato de Parceria v2.4"); sem versão no nome da minuta, sai só o título (nunca "null");
    - "Plano: {plano}";
    - família parceria: "Anuidade: {R$ x} (Anexo III da minuta)"; no Enterprise com o item de acordo, acrescenta ", ou o valor do acordo comercial (item {n})";
    - família parceria: "Data prevista de pagamento: {dd/mm/aaaa}";
    - Gold/Diamante: "Mensalidade: {R$ 397,00 ou R$ 897,00}, após 30 dias grátis";
    - "Licenciado: {razão social em CAIXA ALTA}" (família parceria) ou "Contratante: {razão social em CAIXA ALTA}" (Gold/Diamante);
    - "Assinatura enviada para: {e-mail do cadastro}";
    - se já houver contrato enviado ou assinado: "Atenção: este cadastro já tem o contrato {código ou "sem código"} ({status}). Enviar de novo gera um segundo contrato.";
    - se a lista de contratos ainda não carregou: "Não foi possível verificar contratos anteriores deste cadastro."
- Depois de confirmar: o fluxo de hoje continua igual (spinner, mensagem de sucesso ou de erro na caixa já existente).
- Cancelar: nada acontece, o formulário continua aberto com os dados preenchidos.
- Estado vazio: N/A. O modal só abre com o formulário válido; campos faltantes continuam barrados pela validação de hoje, antes do modal.
- Nota do porquê (tooltip): N/A, sem campo novo.

## DEPENDENCIES
- Deve existir antes: `confirmar()` com a opção `perigo` (PR #390, em produção) e o `<Toaster />` montado no layout raiz (`app/layout.tsx`), já usado em `/admin-cadastros` pela aprovação do Enterprise.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: não. Só acrescenta um passo antes da chamada existente.
- Falha segura: sem o `<Toaster />` montado, `confirmar()` devolve `false` e **nada é enviado** (comportamento documentado em `lib/aviso.ts`). O risco é o botão "não fazer nada" se o host sumir da tela; mitigação: o `<Toaster />` está no layout raiz (`app/layout.tsx`), e o teste manual em produção cobre.
- Clique duplo (QA rodada 1, sugestão): o estado `enviando` é ligado **antes** do `await confirmar()` e desligado se o ADMIN cancelar. O botão fica desabilitado enquanto o modal está aberto, então dois cliques rápidos não abrem dois modais nem geram dois contratos. Teste manual em produção.
- Minuta editada depois de a página abrir: o servidor calcula a anuidade sobre a minuta relida no momento do POST (com `resolveVerticalBlocks`); o cliente calcula sobre a minuta baixada na abertura da página. Mitigação: ao clicar em "Enviar contrato" (abrir o formulário), o componente recarrega a lista de minutas e recalcula a anuidade e o item de acordo. Minuta aprovada só muda por nova rodada de quórum, então a janela é pequena; se ainda assim divergir, o servidor continua sendo a trava.
- Valor exibido no modal: a anuidade vem da mesma função que o servidor usa (`anuidadeDoAnexoIII`), sobre a minuta escolhida. Se a leitura falhar no cliente, o modal mostra "Anuidade: conforme o Anexo III da minuta" e o servidor continua sendo a trava (a geração para com erro claro).
- E-mail exibido: o servidor usa sempre o e-mail do cadastro (o formulário não envia o e-mail, já é assim). O modal mostra o e-mail do cadastro, o mesmo que recebe o ClickSign.
- LGPD e compliance: o modal mostra a razão social e o e-mail do cadastro para o próprio ADMIN que já os vê no formulário. Não há exposição nova.
- Segurança de acesso ao banco: nenhum objeto novo, nada de `anon`.
- Performance: nenhuma chamada nova; a anuidade é lida da minuta que o componente já baixa hoje.
- Vercel timeout (60s): N/A, sem chamada à IA.

## APPROACH
- Abordagem escolhida: reaproveitar o `confirmar()` vermelho do PR #390, com o texto montado por função pura testável. Mesmo padrão visual da aprovação do Enterprise.
- Alternativa descartada: um `ModalV3` próprio dentro do componente com prévia completa do contrato. Mais trabalho e duplica a revisão do texto que já existe na Central; a conferência dos dados que mudam por contrato (plano, valor, data, e-mail) já resolve o risco de envio errado.

## DESENHO TÉCNICO
- `textoConfirmacaoEnvio({ titulo, versao, planoLabel, familia, anuidade, itemAcordo, isEnterprise, dataPagamento, razaoSocial, email, contratoAtivo })` devolve a mensagem em linhas (`\n`), sem travessão. Valor em BRL por `formatarBRL`; data por `dataBR`; razão social em `toUpperCase()`.
- `lib/contrato-parceria-partner.ts` ganha também `mensalidadeDoPlano(plano)` (lê o `PLANO_MENSAL` já existente do Gold/Diamante, que hoje não é exportado).
- No componente, na carga das minutas (abertura da página e cada abertura do formulário): `tentarAnuidade(html, plano)` é um wrapper local do componente, `try { return anuidadeDoAnexoIII(html, plano) } catch { return null }`, usado só na família parceria. O HTML continua fora do estado.
- `gerarEEnviar`: depois de `if (!template || faltam.length > 0) return;` e de `if (enviando) return;`, liga `setEnviando(true)`, chama `const ok = await confirmar(texto, { perigo: true, titulo: "Enviar contrato para assinatura", botao: "Gerar e enviar" });` e, se `!ok`, faz `setEnviando(false)` e retorna.
- Sem migration. Reversão: revert do commit.

## PLANO DE TESTE
- Unitário (`textoConfirmacaoEnvio`):
  - Partner com a v2.4: tem "Contrato de Parceria v2.4", "Anuidade: R$ 10.896,96", a data e o e-mail; não tem "acordo comercial";
  - Enterprise com item de acordo: tem "ou o valor do acordo comercial (item 3.2.1)";
  - Gold: sem linha de anuidade nem de data;
  - com contrato ativo: tem "Atenção" e o código;
  - anuidade null: "conforme o Anexo III da minuta";
  - versão null: "Contrato: Contrato de Parceria" sem "null";
  - contrato ativo sem código: "sem código";
  - contratos ainda não carregados: "Não foi possível verificar";
  - Gold: "Contratante:" e "Mensalidade: R$ 397,00";
  - sem travessão; razão social em CAIXA ALTA.
- Produção (ADMIN, cadastro interno de teste): abrir o formulário, clicar em "Gerar e enviar", conferir o modal vermelho e clicar em **Cancelar** (nada é gerado; conferir na Central). Depois, se quiser validar o envio, confirmar e cancelar o contrato gerado na Central.

## ESTIMATE
S, cerca de 40 min, confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal novo: o modal repete ao ADMIN os dados que ele já vê no formulário.

---

## RELATÓRIO DO QA DE GOVERNANÇA
### Rodada 1 de 6: LIBERADO (0 falhas)
- Sugestões acolhidas: clique duplo (estado `enviando` antes do modal); fallbacks de versão, de código e de lista não carregada; `tentarAnuidade` declarado; recarga da minuta ao abrir o formulário; "Contratante" e mensalidade no Gold/Diamante; referência correta do `<Toaster />` (`app/layout.tsx`).
- Não acolhidas, registradas: bloquear o envio quando o cliente não lê a anuidade (o servidor já trava); alinhar o Esc entre `confirmar()` e `pedirMotivo` (padrão da skill, fora deste BRIEF).

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 1)
- Override: não
- Go dado por: Hamilton, em 2026-11-10 (mensagem "go", registrada pelo hook)
- Implementação: 426 de 426 testes unitários (4 novos em `tests/unit/confirmacao-enviar-contrato.test.ts`), lint limpo.
- Migration aplicada em produção: não se aplica
