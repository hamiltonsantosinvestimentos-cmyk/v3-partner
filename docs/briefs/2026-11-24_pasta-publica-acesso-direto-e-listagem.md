# BRIEF: Pasta Pública (bucket `v3-docs-publico`): fim do acesso direto de externos e listagem só do que foi concedido

Data: 24/11/2026 · Pedido: diretoria ("ok"), prioridade ALTA, prazo 27/11/2026 · Status: QA rodada 3 liberada; override e go da diretoria em 24/11/2026

## Problema (verificado no banco e no código em 24/11/2026)

1. **Acesso direto ao Storage.** As políticas `granted_read_storage` (SELECT) e `granted_write_storage` (INSERT) em `storage.objects` deixam qualquer usuário com concessão em `folder_access_grants` ler e gravar no bucket `v3-docs-publico` direto pela API do Storage, por fora de qualquer rota da V3. Hoje há **57 concessões ativas para papéis externos** (PARTNER_PRO 38, STARTER 11, DIAMANTE 7, GOLD 1), **56 com permissão `admin`**: 44 em pastas de Crédito, 9 em pastas de deal de M&A, 2 de Consórcios, 1 da Bolsa. Contraria a regra 1 da política de sigilo de 31/10/2026.
2. **A tela já não precisa desse acesso.** A Pasta Pública (`components/pasta-publica/pasta-publica-client.tsx`) usa só `/api/governance/files`, `/api/governance/download` e `/api/governance/folders`, que leem com a chave de serviço e conferem a concessão no servidor. O envio pelo navegador é por link assinado (`uploadToSignedUrl`), que não depende dessas políticas (teste `tests/unit/sigilo-ci.test.ts` já proíbe outro uso do Storage pelo navegador).
3. **Vazamento de nomes na listagem.** Em `/api/governance/files`, para quem não é ADMIN:
   - com `path` vazio, a rota lista a **raiz do bucket** sem conferir nada (`if (!hasAccess && folderPath)`);
   - a regra `p.startsWith(folderPath)` deixa listar **qualquer pasta-mãe** de uma pasta concedida: um partner com concessão em uma pasta de deal lista `MA` inteira e vê o código e o nome de todos os deals de M&A.
4. **Validade ignorada e prefixo frouxo.** As três rotas não filtram `expires_at` da concessão, e a comparação por `startsWith(p)` sem a barra final aceita pasta irmã de nome parecido (`.../TST-001_A` libera `.../TST-001_AB`). A rota de download não recusa `..` no caminho.

## SCOPE

1. **Migration** `20261125a_pasta_publica_sem_acesso_direto.sql`: remove as políticas `granted_read_storage` e `granted_write_storage` de `storage.objects`, e também `user_read_own_grants` (`folder_access_grants`), `granted_read_registry` (`folder_registry`) e `granted_read_chunks` (`document_chunks`, trechos de texto dos documentos usados na busca por IA, achada na conferência de dependências de 24/11/2026; a busca usa a função `search_documents_rag`, que é SECURITY DEFINER e não depende dela), que deixam o partner ler direto pela API do banco as próprias concessões e as pastas concedidas, cujo `full_path` traz código do deal e nome do cliente. Mantém só as políticas de ADMIN (`admin_full_storage`, `admin_manage_grants`, `admin_full_access_registry`). Essas tabelas passam a ser lidas só pelas rotas, com a chave de serviço. O rollback é montado a partir do texto atual em `pg_policies` (as políticas `granted_*` não existem em nenhuma migration do repo: foram criadas direto no SQL Editor). Não apaga nenhuma concessão: `folder_access_grants` continua sendo a lista de quem pode ver o quê **pela rota**. Arquivo de rollback recriando as cinco políticas com o texto atual (`.rollback.sql.txt`). Segunda camada: `revoke all on folder_registry, folder_access_grants from anon, authenticated` (só as três rotas de governança usam essas tabelas, todas com a chave de serviço), com o `grant` correspondente no rollback. Ensaio por transação desfeita antes de aplicar.
2. **Função pura** `lib/governance/acesso-pasta.ts`, usada pelas três rotas:
   - concessão vale só se `expires_at` for nulo ou futuro;
   - caminho é acessível se for igual a uma pasta concedida ou estiver **dentro** dela (`caminho === p || caminho.startsWith(p + "/")`);
   - caminho com `..`, barra inicial ou barra dupla é recusado;
   - na raiz e em pasta-mãe de uma pasta concedida, a listagem devolve **só os itens que levam a uma pasta concedida** (ex: em `MA`, só a pasta do deal concedido), nunca os demais nomes;
   - **concessão de externo só vale se ele for o dono da operação** da pasta: em `MA`, `coalesce(originator_profile_id, created_by)` do deal com o mesmo código; em `Credito`, `partner_id` ou `created_by` da proposta com o mesmo código. Concessão de externo em pasta que não bate (hoje as 2 de `Consorcios` e a 1 de `BolsaDeAtivos`) fica **suspensa** na rota e vai em lista ao Robson;
   - **duplo cego nas subpastas:** perfil externo vê `01_NDA`, `02_Teaser`, `03_CIM` e `04_Due_Diligence` da operação que originou (material do próprio cliente); `05_Propostas`, `06_Contrato` e `07_Closing`, que podem trazer a identidade da contraparte, ficam ocultas para externo até regra própria depois de contratos e mandato assinados e da due diligence liberada [VALIDAR COM ROBSON];
   - em `Credito` (subpastas de `create_deal_folder`: `01_Analise`, `02_Documentacao`, `03_Parecer`, `04_Contrato`, `05_Monitoramento`), perfil externo vê `01_Analise` e `02_Documentacao` da proposta que originou; `03_Parecer`, `04_Contrato` e `05_Monitoramento`, que podem trazer o parecer interno da V3 e a identidade da instituição financiadora, ficam ocultas para externo até regra própria [VALIDAR COM ROBSON]. Em `Consorcios` e `BolsaDeAtivos`, nenhuma subpasta é exibida a externo enquanto as concessões estiverem suspensas;
   - **oculta = sem acesso:** para perfil externo, qualquer caminho dentro de subpasta oculta é tratado como sem acesso. A listagem não a mostra, e `files` e `download` respondem 403 a qualquer caminho dentro dela, mesmo com a concessão na pasta raiz do deal;
   - na pasta raiz do deal, o externo vê o aviso neutro "Algumas pastas são liberadas em etapas posteriores da operação.";
   - **ordem:** pastas antes de arquivos, cada grupo em ordem alfabética por `localeCompare(..., "pt-BR")` (substitui o `sortBy name` do Storage, que não respeita acentuação). `/api/governance/folders` mantém a ordem por `full_path`.
3. **`/api/governance/files`**: aplica a função (raiz e pasta-mãe filtradas; fora disso, 403 "Sem acesso a esta pasta"). Para não ADMIN, grava `logAudit` da listagem (usuário, caminho), sem bloquear a resposta.
4. **`/api/governance/download`**: aplica a função (só arquivo dentro de pasta concedida e válida; `..` recusado). Link de 5 minutos mantido. Grava `logAuditStrict` (usuário, papel, caminho) com `await` antes de gerar o link; se falhar, 500 sem link.
5. **`/api/governance/folders`**: filtra concessões vencidas.
6. **Teste de CI** novo em `tests/unit/sigilo-ci.test.ts` (ou arquivo próprio): falha se uma migration criar política em `storage.objects` para `v3-docs-publico`, ou em `folder_registry` e `folder_access_grants`, que não seja só de ADMIN, e se o navegador acessar esse bucket fora de `uploadToSignedUrl`. Como as políticas atuais nasceram fora das migrations, a consulta a `pg_policies` dessas três entra também na varredura periódica de sigilo.
7. **Tela:** quando a rota devolve 403, a Pasta Pública mostra "Sem acesso a esta pasta" (hoje mostra "Pasta vazia"); lista sem nenhuma concessão mostra "Nenhuma pasta liberada para você.". Corrige o travessão do subtítulo e o acento de "Pasta Pública" no título e no caminho.
8. Testes unitários da função (matriz de caminhos, validade, `..`, filtro da raiz e da pasta-mãe, subpastas ocultas de M&A e de Crédito, concessão suspensa).

### Quem vê o quê depois

| Perfil | Storage direto (`v3-docs-publico`) | Pasta Pública pela rota |
|---|---|---|
| ADMIN | Sim (`admin_full_storage`, equipe) | Tudo |
| Demais papéis da equipe e externos com concessão válida | **Não** | Equipe com concessão: as pastas concedidas e o que está dentro delas. Externo: só pasta de operação que ele originou (concessões sem dono identificado suspensas), sem as subpastas ocultas (M&A `05` a `07`; Crédito `03` a `05`); na raiz e nas pastas-mãe, só o caminho até elas |
| Sem concessão | Não | Lista vazia |
| Anônimo | Não | 401 |

**Escrita:** hoje nenhuma rota da Pasta Pública grava arquivo; a gravação direta pelo Storage era o único caminho de escrita de externo e deixa de existir. Envios de documento por partner continuam pelas rotas próprias (ex: `/api/ma/documents`, com as regras do PR #432).

## IMPACT

- Arquivos: `supabase/migrations/20261125a_pasta_publica_sem_acesso_direto.sql` (+ rollback), `lib/governance/acesso-pasta.ts` (novo), `app/api/governance/files/route.ts`, `app/api/governance/download/route.ts`, `app/api/governance/folders/route.ts`, testes unitários.
- Tabelas: `storage.objects` (só políticas), `folder_access_grants` e `folder_registry` (leitura). Nenhuma concessão apagada.
- APIs externas: nenhuma.

## UX: onde o usuário vê isso

- **Ponto de acesso:** menu "Pasta Pública" (`/pasta-publica`). Nada muda para quem tem concessão: navega da raiz até as suas pastas como hoje, mas sem ver os nomes das pastas dos outros.
- **Estado vazio:** quem não tem concessão vê a lista vazia ("Nenhuma pasta liberada para você." no lugar da lista em branco).
- **Sem UI nova** para a remoção das políticas: é camada de banco.

## Camada do banco (verificada em 24/11/2026)

- `storage.buckets`: `v3-docs-publico` com `public = false`.
- `storage.objects` para o bucket: `admin_full_storage` (ALL, só ADMIN), `granted_read_storage` (SELECT, por concessão), `granted_write_storage` (INSERT, por concessão `write` ou `admin`).
- `folder_access_grants`: 57 concessões ativas de papéis externos (números acima). Políticas: `admin_manage_grants` (ALL, só ADMIN) e `user_read_own_grants` (SELECT, o próprio usuário).
- `folder_registry`: `admin_full_access_registry` (ALL, só ADMIN) e `granted_read_registry` (SELECT, pastas com concessão do usuário). RLS ligado nas duas; `anon` e `authenticated` têm privilégio de tabela, então a RLS é a única barreira.
- **Cruzamento das 57 concessões externas com o dono da operação (24/11/2026):** `MA` 10 de 10 batem com o originador do deal; `Credito` 44 de 44 batem com o partner da proposta; `Consorcios` 0 de 2 e `BolsaDeAtivos` 0 de 1 sem operação do partner identificada: suspensas na rota e listadas ao Robson. Todas as concessões estão na pasta raiz do deal (nenhuma direto em subpasta).

## DEPENDENCIES

- Deve existir antes: nada.
- Migrations pendentes: esta.

## RISKS

- **Breaking changes:** algum processo fora da tela que use o Storage direto com sessão de partner deixa de funcionar. Varredura do código: nenhum uso pelo navegador fora de `uploadToSignedUrl` (teste de CI já garante). Fluxos n8n e MCP usam a chave de serviço, não afetados.
- **LGPD/Compliance:** reduz exposição. ⚠️ ROBSON: exposição histórica (partners com acesso direto e listagem da raiz desde 17/06/2026, sem log por usuário no Storage). Mesmo tratamento do BRIEF de `/api/ma/documents`: aplicar com override da diretoria e pedir ciência ao Robson em seguida. Override: [x] diretoria, data 24/11/2026 ("override aceito" e "go para início autorizado" registrados), aceitando aplicar antes da resposta do Robson: (1) a exposição histórica (acesso direto e listagem da raiz desde 17/06/2026) e (2) a suspensão das 3 concessões sem dono identificado e a regra provisória das subpastas ocultas para externo (M&A `05` a `07`; Crédito `03` a `05`), até a resposta dele.
- **Permissão `admin` de partner:** continua gravada em 56 concessões, sem efeito depois da migration (nenhuma rota dá poder extra a `admin` de não ADMIN). Revisar e rebaixar para `read` fica como item separado, com o Robson.
- **Performance:** a filtragem da raiz é em memória sobre as concessões do usuário (dezenas).
- **Vercel timeout:** não há chamada a modelo de IA.
- **CI:** um push por vez.

## APPROACH

- **Escolhida:** tirar as cinco políticas de acesso direto (Storage, as duas tabelas de pasta e `document_chunks`) e corrigir a listagem nas rotas, mantendo as concessões como lista de autorização da rota. Fecha a quebra da regra 1 sem tirar de ninguém o acesso pela tela.
- **Descartada:** revogar as 57 concessões. Tiraria dos partners a visão das próprias pastas pela tela, sem necessidade.
- **Descartada:** manter as políticas e só corrigir as rotas. Continuaria permitindo leitura e gravação direta por fora da V3.

## ESTIMATE

- Complexidade: M
- Esforço: 3 a 4 horas com ensaio e teste em produção
- Confiança: Alta

## Teste antes de declarar pronto

1. Unitário: matriz da função (igual, dentro, irmã de nome parecido, pasta-mãe, raiz, `..`, concessão vencida, concessão de externo sem dono, externo pedindo arquivo e pasta dentro de `06_Contrato` em M&A e de `04_Contrato` em Crédito: sem acesso).
2. Ensaio da migration por transação desfeita, com `set local role authenticated` e claims de um partner com concessão: antes lê e grava no Storage e lê `folder_registry`/`folder_access_grants`; depois, 0 linhas e insert negado. Repetir com claims de perfil externo equivalente (outro plano externo, STARTER ou DIAMANTE) e de GESTAO ou MESA_OPERACIONAL com concessão: Storage direto e as duas tabelas com 0 linhas. ADMIN mantém o Storage; nas duas tabelas de pasta, ADMIN também passa a ler só pela rota (efeito do `revoke`, esperado). Anônimo: 0 linhas. Conferência de dependências feita em 24/11/2026: além das políticas removidas, nenhuma política cita as duas tabelas; as funções que as usam (`create_deal_folder`, `sync_ma_documents_from_deal`, `sync_ma_documents_from_jsonb`, `search_documents_rag`) são SECURITY DEFINER e não são afetadas pelo `revoke`.
3. Produção, com conta de partner (login feito pela diretoria): Storage direto (list e download) e leitura direta das duas tabelas negados; `/pasta-publica` mostra só o caminho até as pastas dele; pedir `MA` não lista outros deals; `05_Propostas`, `06_Contrato` e `07_Closing` ocultas; download dentro da pasta concedida funciona; fora, 403. Partner sem concessão: lista vazia com a mensagem do estado vazio e `?path=MA` com 403. Download direto por caminho de arquivo em subpasta oculta: 403. Prioridade para uma conta de partner de Crédito (44 das 57 concessões): conferir `03_Parecer` oculta e `01_Analise` visível.
4. Produção, conta ADMIN: Pasta Pública completa como hoje.
5. Anônimo: 401 ou redirecionamento ao login.

## QA de governança

Rodada 1: BLOQUEADO (4: leitura direta de `folder_registry` e `folder_access_grants`, concessões sem conferência de dono e duplo cego nas subpastas, teste sem perfil externo equivalente e sem equipe não ADMIN, ordem da listagem). Corrigidas nesta versão, com as consultas feitas no banco. Rodada 2: BLOQUEADO (2: subpastas de Crédito omissas; "oculta" sem recusa no acesso direto). Corrigidas nesta versão, com as contradições de texto apontadas (quatro políticas, tabela, numeração, acento) e a segunda camada de `revoke`. Rodada 3: **LIBERADO PARA "GO"**, condicionado ao override da diretoria. Depois da rodada 3: sugestões aplicadas (resultado esperado do ADMIN no ensaio, conferência de dependências, prioridade da conta de Crédito) e acréscimo da política `granted_read_chunks` à remoção (mais fechamento, mesmo padrão).

---
Aguardando aprovação: "go", "ajusta: [instrução]" ou "cancela".
