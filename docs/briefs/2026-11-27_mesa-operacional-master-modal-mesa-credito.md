# BRIEF: Mesa Operacional do master abre a proposta na mesma janela da Mesa de Crédito

> Data: 2026-11-27 | Autor: Claude | Status: em QA
> Pedido do Hamilton: "a proposta deve abrir igual abre o modal na mesa de credito, abre tambem com as mesmas informaçoes na mesa operacional da AGS".
> Escolha do Hamilton: "Igual à Mesa de Crédito (Recomendado)". A janela traz as mesmas informações e as mesmas ações que o master já tem na Mesa de Crédito, e nada além disso.
> Altera o BRIEF `2026-11-26_mesa-operacional-master-enterprise.md` (PR #440) só no clique do card. Ali, a janela de detalhe era só de leitura ("Só acompanhar"); com esta escolha, ela passa a ser a janela da Mesa de Crédito.

## SCOPE
Na aba "Mesa Operacional" do master Enterprise (`/enterprise/mesa-operacional`), o clique no card deixa de abrir a janela própria de leitura e passa a abrir a **mesma janela da Mesa de Crédito** (`PropostaDetailModal`). Ela vem com os mesmos dados e as mesmas permissões que a Mesa de Crédito N1, N2 e N3 dá ao master:
- `canChangeStage = false`
- `canEditValorSolicitado = false` (ENTERPRISE não está na lista)
- `canEditInstituicao = false`
- `canGenerateContract = false`
- `isAdmin = false`
- `onProposalUpdate`: faz merge das mudanças na proposta aberta e marca que houve gravação, como o `handleProposalUpdate` de `nivel1-client.tsx`. É por ele que a janela recebe do servidor a metadata atualizada depois de uma ação.
- `onStageChange`: função vazia. Com `canChangeStage=false` a janela não move etapa (também não "resolve pendência e volta para ANALISE").

As demais props ficam omitidas, como em N1, N2 e N3 (`canCompileDocuments`, `canSendMandato`, `canDuplicate` etc.).

O Kanban, os cards, os contadores, o filtro e a busca do PR #440 **não mudam**: o card continua com o CPF/CNPJ mascarado e montado pela visão do partner.

## IMPACT
- Arquivos afetados:
  - `components/enterprise/mesa-equipe-client.tsx`:
    - sai a janela própria de leitura (`Detalhe`);
    - no clique, o cliente busca a proposta em `GET /api/credit-proposals?id=<id>`, a mesma rota e o mesmo recorte por papel que a Mesa de Crédito usa;
    - converte a resposta com `propostaDaMesaDeCredito` e abre `PropostaDetailModal` com as props acima;
    - ao fechar a janela, chama `router.refresh()` **sempre**. Várias ações da janela gravam sem avisar o pai (remover documento, checklist, chat), então só assim os cards refletem o que mudou. O refresh do servidor mantém o estado da tela (filtro e busca).
    - enquanto uma proposta está abrindo, os outros cards ficam desabilitados e a busca anterior é cancelada (`AbortController`), para uma resposta atrasada não abrir a proposta errada.
  - `app/(platform)/enterprise/mesa-operacional/page.tsx`: a leitura passa a filtrar `.is("deleted_at", null)`, a mesma regra da rota e da Mesa de Crédito. Proposta excluída sai do Kanban (antes aparecia como card e, mascarada, continuava exibida ao master).
  - `app/(platform)/enterprise/mesa-operacional/exibicao.ts`: nova `propostaDaMesaDeCredito(p)`, que é a mesma conversão campo a campo de `nivel1-client.tsx` e `credit-desk-client.tsx` (de `client_cpf_cnpj` para `cpf_cnpj`, metadata para client_type, email, telefone, prazo e finalidade, `partner` para partner_id, partner_name e partner_role, pendências e notas). É pura e testada.
  - `tests/unit/mesa-equipe.test.ts`: teste da conversão.
- Tabelas: nenhuma alteração. A leitura da janela passa pela rota que já existe; a da página ganha o filtro de `deleted_at`.
- Rotas e APIs: nenhuma nova e nenhuma alterada. A janela chama as mesmas rotas que já chama na Mesa de Crédito, com as mesmas checagens de servidor por papel e equipe (`idsDaEquipe`).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: menu "Mesa Operacional" do master. Ao clicar em qualquer card, abre a janela da Mesa de Crédito: as mesmas abas, informações, documentos e chat que o master vê ao abrir a proposta em Mesa de Crédito › N1, N2 ou N3.
- Carregando: o card mostra "Abrindo…" e fica desabilitado até a janela abrir.
- Erros (a janela nunca abre com dado parcial):
  - resposta 404, de proposta excluída ou fora da equipe: "Esta proposta não está mais disponível.";
  - qualquer outra falha (rede, 500, 401): "Não foi possível abrir a proposta agora. Tente de novo." 
- Subtítulo da tela: passa a ser "Operações da sua equipe, em tempo real. As etapas são movidas pela mesa de análise."
- Estado vazio: o mesmo do PR #440.
- Sem UI? Não, é a tela acima.

## DEPENDENCIES
- Deve existir antes: o PR #440 (no ar), `PropostaDetailModal` e `GET /api/credit-proposals?id=` (no ar).
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- **Ações na janela:** o master passa a poder, a partir desta aba, fazer o que já faz na Mesa de Crédito: chat da proposta, enviar documento e outras ações de partner. Mover etapa, aprovar, editar instituição e gerar contrato continuam fora. As permissões reais ficam no servidor, nas rotas que a janela chama, e não mudam. É uma porta a mais para o mesmo acesso, sem acesso novo.
- **LGPD: mascaramento e log de revelação (FALHA ACEITA PENDENTE, ver abaixo).** Na janela aparecem o CPF/CNPJ completo e os links para baixar documentos, sem clique para revelar e sem log, igual à janela da Mesa de Crédito que o master já usa (`idsDaEquipe`, regra do Enterprise desde 24/09/2026). Não há destinatário novo, mas é uma tela a mais com o dado completo. O BRIEF do PR #440 usou o mascaramento como argumento ("mostra menos"); esta mudança desfaz isso na janela. O card continua mascarado. `[VALIDAR COM ROBSON]`.
- **Instituições parceiras:** a janela recebe o mesmo dado que o master já recebe na Mesa de Crédito, pelo mesmo `recortarTransferenciaPorPapel`. Esta tela não acrescenta nada.
- **Ações irreversíveis expostas (FALHA ACEITA PENDENTE, ver abaixo):** a janela tem, sem confirmação:
  - "Remover" documento (`handleDelete`);
  - "Remover arquivo" (`removeFile`), os dois com DELETE direto;
  - marcar ou desmarcar o checklist, que grava na hora (PATCH /checklist).

  É o mesmo comportamento da Mesa de Crédito hoje. Esta tela só abre mais uma porta para ele. O servidor confere a equipe (`ehDaEquipe`) no DELETE. Pôr confirmação nessas ações mexe na janela de todas as telas e vira outro BRIEF.
- **Proposta de teste V3-CR-TESTE-AGS-0001:** com a janela, o testador consegue agir nela. A regra "só olhar" do BRIEF `2026-11-27_operacao-teste-ags-teste.md` continua valendo: não responder a pendência, não enviar documento, não usar o chat. Se algo for gravado, a exclusão para e o inventário mostra o que foi feito.
- **Regressão:** a janela da Mesa de Crédito não é alterada, só passa a ser usada em mais uma tela. Ela faz fetch próprio (status de análise, documentos etc.) ao abrir.
- **Divergência da conversão:** se `nivel1-client` mudar a conversão no futuro, esta tela não acompanha sozinha. O teste congela os campos de hoje, e o comentário no código aponta as duas origens.
- Performance: 1 chamada a mais por clique. Vercel timeout: não se aplica.

## APPROACH
- Abordagem escolhida: reutilizar a janela da Mesa de Crédito com as props de partner e buscar a proposta pela mesma rota que a Mesa de Crédito usa. Assim, "igual à Mesa de Crédito" vale por construção.
- Alternativas descartadas:
  - **A mesma janela só de leitura:** exigiria mexer na janela de 6 mil linhas para esconder cada ação. O Hamilton escolheu "Igual à Mesa de Crédito".
  - **Mandar o master para a Mesa de Crédito ao clicar:** tira a pessoa da tela e não mostra as propostas de N2 e N3 juntas.
  - **Carregar a proposta completa no servidor da página:** duplicaria a leitura e o recorte por papel que a rota já faz.

## PLANO DE TESTE
- Unitário: `propostaDaMesaDeCredito` converte uma resposta da rota (com `partner`, metadata, pendências e notas) nos mesmos campos de `nivel1-client`.
- Build da Vercel e testes automáticos de tela.
- Em produção, com o Hamilton logado como "Teste AGS V3":
  - clicar no card V3-CR-TESTE-AGS-0001 abre a janela da Mesa de Crédito com os mesmos dados que aparecem em Mesa de Crédito › N1;
  - sem botão de mover etapa;
  - **sem agir na proposta** (regra "só olhar"): abrir e ficar **só na aba Detalhes**, sem entrar em Documentos nem no Chat, e fechar a janela.

## ESTIMATE
S. 1h. Confiança alta.

## PARECER DE COMPLIANCE
Pendente de resposta do Robson sobre mascaramento e log de revelação (item 1 das falhas que dependem de aceite): `[VALIDAR COM ROBSON]`. Quando ele responder, registrar aqui a data, quem respondeu e o texto. Enquanto isso, a liberação depende do aceite do João ou do Hamilton ("go mesmo assim"), registrado em REGISTRO DE LIBERAÇÃO.

Registro de 27/11/2026 (Claude): pela rota, não há destinatário novo. O master já recebe esses dados na Mesa de Crédito, pela mesma rota e com o mesmo recorte.

## FALHAS QUE DEPENDEM DE ACEITE DO JOÃO OU DO HAMILTON
Ficam abertas até o aceite ("go mesmo assim") ou o parecer do Robson:
1. **Mascaramento e log de revelação** (QA 3.1/3.2): a janela mostra o CPF/CNPJ completo e os documentos sem clique para revelar e sem log, herdado da janela da Mesa de Crédito. `[VALIDAR COM ROBSON]`: a tela do PR #440 mascarava, e esta mudança volta a mostrar completo na janela.
2. **Exclusão sem confirmação** (QA 3.3): "Remover" documento e "Remover arquivo" apagam com um clique, herdado da janela da Mesa de Crédito. Corrigir mexe na janela de todas as telas (outro BRIEF).

## QA DE GOVERNANÇA
Rodada 1, 27/11/2026: BLOQUEADO, com 4 falhas.
- 2 corrigidas:
  - `onProposalUpdate` com merge e a frase sobre as props corrigida;
  - filtro de `deleted_at` na página, com a mensagem de 404 separada.
- 2 declaradas como falha herdada, que depende de aceite: mascaramento/log com `[VALIDAR COM ROBSON]`, e exclusão sem confirmação.

Sugestões aplicadas:
- busca cancelada e cards bloqueados enquanto abre;
- refresh ao fechar (rodada 2: sempre, porque algumas ações gravam sem chamar `onProposalUpdate`);
- teste só na aba Detalhes;
- comentário apontando a origem da conversão.

Rodada 2, 27/11/2026: BLOQUEADO, com 3 falhas.
- O Parecer de compliance contradizia o resto do BRIEF. Foi reescrito como pendente do Robson.
- Restam exatamente as 2 falhas herdadas que dependem de aceite: mascaramento e log com `[VALIDAR COM ROBSON]`, e exclusão sem confirmação.

Sugestão aplicada: refresh sempre ao fechar.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 2), só pelas 2 falhas herdadas declaradas
- Override: pendente ("go mesmo assim" do João ou do Hamilton, aceitando as falhas 1 e 2 e a pendência do Robson)
- Pendência para outro BRIEF: confirmação antes de "Remover" documento ou arquivo na janela da Mesa de Crédito, para todas as telas
