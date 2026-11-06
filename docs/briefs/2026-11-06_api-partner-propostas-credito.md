# BRIEF: API para o partner cadastrar proposta de crédito pelo sistema dele

> Data: 2026-11-06 | Autor: Claude, a pedido do Hamilton | Status: QA LIBERADO (rodada 3), aguardando go
> Página para o dev do partner: rascunho em `docs/integracao/api-propostas-credito.html` (versão preliminar, a API ainda não está no ar).

## SCOPE
Criar uma API externa (`/api/v1`) para que o partner integre o sistema dele à V3 e cadastre propostas de crédito sem abrir a plataforma. A proposta via API precisa chegar à mesa igual à do modal "Nova proposta", com os mesmos dados, os mesmos documentos do checklist e as mesmas travas.

Entra:
- Chave de API por partner, criada pelo próprio partner na plataforma, mostrada uma vez só, revogável.
- Consultar as linhas de crédito liberadas para o partner e os documentos exigidos por linha e por tipo de pessoa (PF ou PJ).
- Criar a proposta, com dados do cliente, da operação e dos imóveis em garantia.
- Enviar os documentos por link assinado, com o mesmo bucket (`credit-documents`) e o mesmo registro em `credit_desk_proposals.documents` do modal. Assim o OCR que já existe (`/api/credit-proposals/ocr-batch`) roda depois nesses arquivos sem nenhuma mudança.
- Consultar o andamento da proposta: etapa, pendência e documentos recebidos e faltantes.
- Página de documentação para o dev do partner.

Segurança (decisão do Hamilton em 06/11/2026: "o mais seguro possível, com termo de aceitação e segurança"):
1. **Termo de Uso da API**:
   - O partner aceita o termo antes de criar a primeira chave. A minuta está em `docs/briefs/anexos/2026-11-06_termo-uso-api-minuta.md`.
   - O aceite grava versão, hash do texto, usuário, data e hora, IP e navegador.
   - Quando sai uma versão nova do termo, as chaves ficam suspensas até o partner aceitar de novo.
2. **Confirmação por e-mail para criar chave**: código de 6 dígitos, válido por 10 minutos, enviado ao e-mail da conta. Quem roubou a sessão do partner não cria chave sem acesso ao e-mail dele.
3. **IPs permitidos, obrigatório**:
   - Toda chave tem de 1 a 10 IPs ou faixas (CIDR).
   - Chamada de outro IP recebe 403 e é registrada.
4. **Validade de 12 meses**:
   - O partner recebe um aviso por e-mail 30 dias antes de vencer.
   - A chave vencida recebe 401.
5. **Permissões separadas por chave**: "criar propostas e enviar documentos" e "consultar propostas".
6. **Chave guardada só como hash SHA-256**, com prefixo visível (`v3_live_ab12…`) e mostrada uma vez.
7. **Bloqueios automáticos**:
   - 10 chamadas com chave inválida a partir do mesmo IP em 10 minutos bloqueiam esse IP por 1 hora.
   - Volume acima do limite responde 429.
8. **Avisos por e-mail ao partner e no painel do ADMIN** quando uma chave é criada, revogada, vence ou é bloqueada.
9. **Resposta mascarada**: CPF e CNPJ mascarados; nunca devolve RG, renda ou link de documento.
10. **Arquivos**:
    - O tipo é conferido pelos bytes, não pela extensão.
    - Limite de 25 MB.
    - PDF com senha e PDF com JavaScript embutido são recusados.
11. **ADMIN**: vê todas as chaves e pode revogar qualquer uma, com motivo e auditoria.
12. **Log de chamadas**:
    - Guarda chave, IP, data e hora, rota e resultado, sem o conteúdo da chamada.
    - Fica 12 meses (decisão do Hamilton em 06/11/2026; o Marco Civil, art. 15, exige no mínimo 6) e é apagado por um cron diário.
    - Criar proposta e enviar documento ficam também na auditoria da proposta, pelo prazo de guarda da proposta.

**Exigências do Termo v2.1 (entregue pelo Hamilton em 06/11/2026) sobre o sistema:**
- **Tela de aceite (14.3 a 14.6):**
  - Mostra o texto integral do termo.
  - As cláusulas 4.8, 4.9, 11.4, 12.4, 12.5, 12.7 e 12.8 aparecem em destaque.
  - São **duas caixas de confirmação** separadas: o aceite geral e o aceite das cláusulas em destaque. O botão "Aceitar" só habilita com as duas marcadas.
  - Quem aceita confirma que tem poderes para representar o partner (2.1 e 14.5).
- **Evidência do aceite (14.4):**
  - Grava versão, hash SHA-256, usuário, data e hora com fuso, IP, navegador, dispositivo e o identificador da sessão.
  - O texto integral de cada versão fica guardado na tabela nova `partner_api_termos` (`versao`, `texto`, `hash`, `vigencia_inicio`), somente inserção. A versão 2.1 é a primeira linha.
  - O partner baixa o comprovante do aceite em PDF na tela de chaves.
- **Nova versão do termo (14.2):** publicar uma versão nova suspende as chaves de quem ainda não aceitou. A API responde 403 `termo_pendente` até o novo aceite.
- **Autorização para consultas de crédito (4.8):**
  - No `POST /propostas`, o campo `declaracoes.autorizacao_consultas` é **obrigatório**. Ele traz `true` e a data em que o partner colheu a autorização (`AAAA-MM-DD`).
  - Sem o campo, a API responde 400. A declaração fica gravada na proposta, com a chave e a data e hora.
  - A V3 pode pedir a prova; a mesa marca a proposta como "Aguardando prova de autorização". Esse fluxo da mesa fica para a fase 2.
- **Prevenção à lavagem de dinheiro (7.4):** bloco opcional `pld` no `POST /propostas`, aparente para a mesa no detalhe da proposta e nunca devolvido pela API:
  - `pep`: `SIM`, `NAO` ou `NAO_SEI`, sobre o cliente, os sócios e os representantes;
  - `beneficiario_final`: nome e CPF, para PJ;
  - `circunstancia_atipica`: texto livre, até 2.000 caracteres.
- **Registros (9.2 e 9.3):**
  - O log de chamadas fica 12 meses.
  - Registros de incidente de segurança com dado pessoal ficam 5 anos, na tabela nova `partner_api_incidentes` (data, partner, chave, descrição, medidas, quem registrou), lançados pelo ADMIN.
  - O ADMIN lança e consulta os incidentes na aba "Chaves de API", pelo botão "Registrar incidente". A lista fica em ordem de data do incidente, do mais recente para o mais antigo. Estado vazio: "Nenhum incidente registrado."
  - O registro não pode ser editado nem excluído: correção entra como novo registro que referencia o anterior.
- **Regras dos campos novos (QA, rodada 3):**
  - `declaracoes.autorizacao_consultas.data`: `AAAA-MM-DD`, gravada como texto, sem `new Date()`. Não pode ser futura nem ter mais de 180 dias.
  - `pld.beneficiario_final.cpf`: validado com `isValidCpfCnpj`; aceita só CPF; gravado com máscara.
  - `pld.pep`: lista fechada de três valores, sem ordenação a definir.
  - O bloco `pld` só aparece para ADMIN, GESTAO e MESA_OPERACIONAL no detalhe da proposta, nunca para o partner nem na API (cláusula 7.4: o cliente não pode saber de apuração).
  - Comprovante do aceite em PDF: datas em `DD/MM/AAAA` e hora com fuso de Brasília.
- **Tabelas novas, regra da seção 6:** `partner_api_termos` e `partner_api_incidentes` seguem a mesma regra das outras cinco: RLS ligada, `revoke all from anon, authenticated` e nenhuma política. São lidas só por rota de servidor, depois de conferir o papel. O teste de acesso da seção 6.8 passa a cobrir as 7 tabelas.
- **Suspensão por plano (11.1 e):** já prevista; a chave fica suspensa se o partner sair dos planos com acesso.

Fora do escopo (fase 2): webhook avisando mudança de etapa (com assinatura HMAC), editar proposta pela API, ambiente de teste separado, OCR automático no envio, antivírus nos arquivos (a Vercel não roda ClamAV; precisa de serviço externo, a avaliar).

## IMPACT
- Arquivos novos:
  - `lib/credit-proposal-create.ts`: criação da proposta extraída de `app/api/credit-proposals/route.ts` (código da proposta, `credit_line_id`, cliente 360, pasta MPS, notificações). O modal e a API passam a usar a mesma função, como foi feito com `lib/contract-send.ts`.
  - `lib/api-keys.ts`: gerar, conferir (hash SHA-256) e revogar chave; limite de requisições.
  - `app/api/v1/linhas/route.ts`: `GET`.
  - `app/api/v1/propostas/route.ts`: `POST` (criar) e `GET` (listar por `referencia_externa` ou `atualizado_desde`).
  - `app/api/v1/propostas/[id]/route.ts`: `GET`.
  - `app/api/v1/propostas/[id]/documentos/upload-url/route.ts`: `POST`.
  - `app/api/v1/propostas/[id]/documentos/route.ts`: `POST`, que confirma o upload.
  - `app/api/integracao-api/chaves/route.ts`: tela do partner (listar, criar, revogar).
  - `app/(platform)/integracao-api/page.tsx` e `components/integracao-api/chaves-client.tsx`.
  - `docs/integracao/api-propostas-credito.html`: página para o dev.
- Arquivos alterados:
  - `app/api/credit-proposals/route.ts`: o `POST` passa a chamar `lib/credit-proposal-create.ts`, sem mudar o comportamento.
  - `components/mesa-credito/credit-desk-client.tsx` e `proposta-detail-modal.tsx`: selo "Via API".
  - `components/layout/sidebar.tsx`: item "Integração por API".
- Tabelas:
  - Nova `partner_api_keys`: `id`, `partner_id`, `nome`, `prefixo`, `key_hash`, `escopos`, `ips_permitidos` (cidr[]), `expira_em`, `termo_versao`, `criada_por`, `ultimo_uso_em`, `ultimo_ip`, `revogada_em`, `revogada_por`, `motivo_revogacao`, `created_at`.
  - Nova `partner_api_termo_aceites`: `id`, `partner_id`, `user_id`, `versao`, `texto_hash`, `ip`, `user_agent`, `aceito_em`. Só recebe inserção; nunca alteração nem exclusão.
  - Nova `partner_api_codigos`: código de e-mail para criar chave (hash, expira em 10 minutos, uso único).
  - Nova `partner_api_bloqueios`: IP, motivo, até quando.
  - Nova `partner_api_requests`: `id`, `key_id`, `idempotency_key`, `metodo`, `rota`, `status_http`, `proposal_id`, `ip`, `created_at`. Serve para não criar proposta duplicada, para o limite de requisições e para auditoria.
  - `credit_desk_proposals`: duas colunas novas e nulas, `origem` (`plataforma` ou `api`) e `referencia_externa`. Índice único em (`partner_id`, `referencia_externa`).
  - `audit_logs`: criação e revogação de chave.
- Rotas: as listadas acima.
- APIs e integrações: Supabase Storage (`credit-documents`). Nenhum serviço externo novo.

## UX: ONDE O USUÁRIO VÊ ISSO
- **Partner:**
  - Menu lateral "Integração por API" abre `/integracao-api`.
  - Botão "Criar chave" pede um nome (ex.: "Sistema da corretora") e mostra a chave uma vez, num modal V3 com o aviso "Copie agora. Por segurança, não mostramos esta chave de novo."
  - A tabela de chaves mostra nome, início da chave (`v3_live_ab12…`), criada em `DD/MM/AAAA`, último uso e o botão "Revogar". Revogar abre o modal vermelho "Revogar chave? Os sistemas que usam esta chave param de funcionar na hora.", com os botões "Cancelar" e "Revogar".
  - Link "Documentação para o seu dev", que abre a página de integração.
  - **Ordem da tabela de chaves:** ativas primeiro, depois as vencidas e as revogadas; dentro de cada grupo, a mais recente primeiro (`created_at desc`).
- **ADMIN:**
  - Aba "Chaves de API" em `/admin-cadastros`, com todas as chaves de todos os partners: partner, nome da chave, prefixo, plano, IPs permitidos, criada em, vence em, último uso e situação.
  - **Ordem:** partner em ordem alfabética (`localeCompare("pt-BR")`) e, dentro do partner, a chave mais recente primeiro.
  - Filtros: situação (ativa, vencida, revogada ou bloqueada) e partner.
  - **Botão "Revogar":** abre o modal vermelho V3 "Revogar a chave [nome] de [partner]? As integrações desse partner que usam esta chave param na hora." O motivo é obrigatório, com no mínimo 10 caracteres. Os botões são "Cancelar" e "Revogar chave", e o modal não fecha ao clicar fora. A revogação grava `audit_logs` com o ADMIN, o motivo e a data e hora, e avisa o partner por e-mail.
  - **Botão "Ajustar limite":** abre um modal com os campos de chamadas por minuto e propostas por dia, com auditoria.
  - **Estado vazio do ADMIN:** "Nenhum partner criou chave de API ainda."
- **Estado vazio:** "Nenhuma chave criada. Crie uma chave para conectar o sistema da sua empresa à V3."
- **Mesa e admin:** a proposta vinda pela API aparece na Mesa de Crédito como as outras, com o selo "Via API" no card e no detalhe, e com a referência externa do partner no detalhe.
- **Sem acesso:** quem não tem o plano liberado vê a tela com o texto "A integração por API está disponível nos planos Partner PRO, Gold, Diamante e Enterprise. Fale com a V3 para mudar de plano."

## DEPENDENCIES
- **Decisões do Hamilton:**
  1. Planos com acesso à API: **decidido pelo Hamilton em 06/11/2026**. São Diamante, Gold, Partner PRO e Enterprise (roles `DIAMANTE`, `GOLD`, `PARTNER_PRO`, `ENTERPRISE`). Os demais (Starter, Partner e Partner HE) recebem 403 `sem_acesso` e veem a tela de convite. Se o partner muda para um plano sem acesso, as chaves dele ficam suspensas automaticamente; o plano é conferido a cada chamada.
  2. Link da Análise de Crédito paga: **decidido pelo Hamilton em 06/11/2026, sim**. A proposta via API gera o link igual ao modal, pela mesma função (preço e repasse do partner iguais), e devolve o link em `link_analise_credito` na criação e na consulta. O gate de avanço sem análise paga continua valendo na mesa.
  3. Limites: **decidido pelo Hamilton em 06/11/2026**. São 60 chamadas por minuto e 200 propostas por dia, por chave. Acima disso, a API responde 429 com o header `Retry-After`. O ADMIN pode ajustar o limite de uma chave, e o ajuste fica auditado.
- **Parecer do Robson**, ver PARECER DE COMPLIANCE.
- **Migrations pendentes:** `20261106_partner_api_keys.sql`, com `partner_api_keys`, `partner_api_requests`, as duas colunas e o índice. Exige segundo go antes de aplicar em produção.

## RISKS (nunca "nenhum")
- **Segurança:** a API fica aberta na internet. Uma chave vazada permite criar propostas em nome do partner e ler as propostas dele. Mitigações:
  - A chave é guardada só como hash e mostrada uma vez.
  - Revogação imediata.
  - A chave enxerga só as propostas do próprio partner.
  - Limite de requisições.
  - Log de cada chamada com IP.
  - Nenhuma rota `v1` devolve CPF, RG ou renda completos: a consulta devolve o documento mascarado.
- **LGPD:** o partner envia dado pessoal e documento de terceiro (RG, CPF, renda, imposto de renda, extrato) por um canal novo. `[VALIDAR COM ROBSON]`
- **Breaking change:** extrair a criação do `POST /api/credit-proposals` para uma função compartilhada pode mudar o modal sem querer. Os testes unitários cobrem os mesmos passos antes e depois.
- **Duplicidade:** se o sistema do partner reenviar a chamada, a proposta sairia em dobro. Por isso o header `Idempotency-Key` é obrigatório e `referencia_externa` é única por partner.
- **Arquivos ruins para o OCR:** PDF com senha, foto ilegível ou formato errado. A confirmação confere o tipo pelos bytes do arquivo, não pela extensão, e limita o tamanho a 25 MB. PDF com senha é recusado.
- **Vercel:** nada chama o Claude nesta API. O upload vai direto ao Storage pelo link assinado, sem passar pelo limite de 4,5 MB da Vercel.
- **Checklist duplicado:** existem `lib/checklists.ts` e `lib/credit-checklists.ts`. A API usa `lib/credit-checklists.ts`, o mesmo do modal. Se os dois divergirem, o OCR em lote (que lê `lib/checklists.ts`) pode não reconhecer um documento.
- **Travas:** as regras do modal precisam valer na API também. São elas:
  - Nível 3 exige no mínimo R$ 5 milhões.
  - O partner HE fica restrito às linhas de Home Equity.
  - A linha precisa existir em `LEVEL_LINES`.
  - Crédito consignado e pessoal ficam fora do escopo.

## APPROACH
- **Abordagem:**
  - API REST própria em `/api/v1`, com chave por partner no header `Authorization: Bearer`.
  - A criação usa a mesma função do modal, então mesa, código, pasta, notificações e OCR funcionam igual.
  - O documento sobe em dois passos: pedir o link e confirmar. É o mesmo desenho do modal hoje (`upload-url` mais `register`), já testado em produção para arquivo grande.
- **Alternativa descartada 1:** reaproveitar `integration_partners`. Essa tabela é para a V3 chamar sistemas de terceiros, guarda a chave em texto aberto e é de outro sentido (saída, não entrada).
- **Alternativa descartada 2:** receber o arquivo em base64 no corpo do `POST`. Bate no limite de 4,5 MB da Vercel e dobra o tamanho do envio.
- **Alternativa descartada 3:** o partner logar com usuário e senha pela API. Mistura o acesso da pessoa com o do sistema, não dá para revogar só a integração e expõe a senha no servidor do partner.

## DESENHO TÉCNICO (resumo; detalhes na página do dev)

Base: `https://app.v3partners.com.br/api/v1`

| Método | Rota | O que faz |
|---|---|---|
| GET | `/linhas` | Linhas liberadas ao partner, nível, valor mínimo e documentos por PF e PJ (`id`, `nome`, `obrigatorio`, `dica`). |
| POST | `/propostas` | Cria a proposta. Exige o header `Idempotency-Key`. Devolve `id`, `codigo`, `etapa` e `documentos_pendentes`. |
| GET | `/propostas?referencia_externa=` ou `?atualizado_desde=` | Lista as propostas do partner. |
| GET | `/propostas/{id}` | Etapa, status, pendência (motivo), documentos recebidos e faltantes. |
| POST | `/propostas/{id}/documentos/upload-url` | Recebe `tipo_documento`, `nome_arquivo` e `tamanho_bytes`. Devolve `upload_id` e uma `url` para `PUT`, válida por 2 horas. |
| POST | `/propostas/{id}/documentos` | Recebe `upload_id`. Confere se o arquivo existe, o tipo e o tamanho, e registra em `documents` com `uploaded_by` igual ao partner e `origem` igual a `api`. |

**Corpo da proposta:** espelha o `metadata` do modal, com nomes em português.
- **Cliente:** `tipo` PF ou PJ, `nome` ou `razao_social`, `cpf_cnpj`, `email`, `telefone`, `rg`, `nascimento`, `estado_civil`, `renda_mensal`, `nome_fantasia`, `socio_responsavel`, `faturamento_mensal` e `endereco` (com `cep`, `logradouro`, `cidade` e `uf`).
- **Operação:** `linha`, `valor_solicitado`, `prazo_meses`, `finalidade`, `restricao` e `observacoes`.
- **Imóveis:** `imoveis[]`, cada um com `cep`, `endereco`, `cidade`, `uf`, `valor_estimado`, `zona`, `padrao` e `proprietario`.
- **`referencia_externa`.**

**Validação:**
- Zod no servidor.
- CPF e CNPJ (inclusive o CNPJ alfanumérico) com `lib/validators/cpf-cnpj.ts`.
- Telefone com DDI.
- Valores em número, nunca texto formatado.
- Datas em `AAAA-MM-DD`.

**Visão da proposta na API (decisão do Hamilton em 06/11/2026: "a visão da proposta permanece o que somente o partner vê na Mesa de Crédito"):**
- **Regra:** `GET /propostas` e `GET /propostas/{id}` nunca devolvem informação que o partner não vê hoje no detalhe da proposta (`components/mesa-credito/proposta-detail-modal.tsx`, aberto com o papel do partner: `canChangeStage`, `canEditInstituicao`, `canGenerateContract`, `canSendMandato` e `isAdmin` falsos).
- **Implementação:**
  - A resposta sai de uma função única, `visaoDoPartner(proposta)` em `lib/api-v1/visao-partner.ts`, que parte do mesmo dado que a plataforma entrega ao partner (`GET /api/credit-proposals` com o papel dele, já passado por `recortarTransferenciaPorPapel`).
  - Sobre esse dado, a função aplica uma **lista fechada de campos permitidos**. Campo novo que entrar na proposta não vai para a API sem ser incluído nessa lista de propósito.
- **Fica fora da API, por ser exclusivo da mesa e do ADMIN:**
  - instituição encaminhada e o retorno da instituição;
  - notas e analistas dos níveis 1, 2 e 3;
  - percentuais de comissão do mandato e da instituição, e valor do crédito atual;
  - histórico interno de etapas com autor;
  - autorização de avanço sem análise paga (`analise_gate_override`);
  - vínculo com M&A (`ma_deal_id` e transferência);
  - NDA, contrato e mandato;
  - recursos liberados;
  - quem da equipe mexeu na proposta.
- **Entra na v1, porque o partner vê na tela:**
  - código, linha, nível, valor solicitado, valor aprovado, prazo e finalidade;
  - nome do cliente e documento (mascarado, mais restrito que a tela);
  - etapa e data da última mudança;
  - pendência aberta: motivo, responsável e data;
  - pendências de documento apontadas pelo OCR: documento, motivo e data;
  - documentos recebidos e faltantes;
  - link da Análise de Crédito.
- **Comentários, só leitura (decisão do Hamilton em 06/11/2026: "coloque os comentários para ele ter visão somente"):**
  - Nova rota `GET /propostas/{id}/comentarios`, que exige a permissão `propostas:ler`.
  - Devolve as mensagens do **Chat da Proposta** (`chat_messages` com `proposta_id`), as mesmas que o partner vê na aba Comentários pelo `components/chat/chat-da-proposta.tsx`. Cada mensagem traz data e hora, nome do autor como aparece na tela e texto.
  - Anexos aparecem só pelo nome do arquivo, sem link.
  - Ordem: `created_at asc`, em páginas de 50 com cursor. Suporta `?desde=` para buscar só as novas.
  - **Fica fora:** `credit_desk_proposals.mesa_comments`, as notas internas da mesa. A própria plataforma já nega essas notas ao partner (`GET /api/credit-proposals/comments` responde 403 para quem não é da mesa).
  - **A API não envia comentário.** Não existe `POST`. Para responder, o partner usa a plataforma.
  - Teste: a resposta não contém nenhum item de `mesa_comments`; uma chave do partner A recebe 404 nos comentários da proposta do partner B.
- **O partner vê na tela, mas fica fora da v1:** Recomendação, Avaliação de Imóvel, Raio-X do Extrato, Análise IA e Chat IA. São conteúdos longos ou gerados por IA. Ficam para a fase 2, se o Hamilton quiser.
- **Teste de paridade (unitário):** para uma proposta com todos os campos internos preenchidos, a resposta da API não contém nenhuma das chaves da lista "fica fora". Toda chave da resposta precisa estar na lista de campos permitidos.

**Linhas na API (pergunta do Hamilton em 06/11/2026):**
- Aparecem **todas as 28 linhas** de `LEVEL_LINES`: 8 do nível 1, 13 do nível 2 e 7 do nível 3. Os quatro planos com API já acessam os níveis 1 a 3 na plataforma (`components/layout/sidebar.tsx:71`).
- A lista sai da mesma fonte do modal (`lib/credit-checklists.ts`), então uma linha nova no modal aparece sozinha na API.
- **Ordem em `GET /linhas`:** pelo nível (1, 2, 3), que é uma escala com significado; dentro do nível, por nome com `localeCompare("pt-BR")`.
- Os documentos de cada linha seguem a ordem do checklist, que é a ordem da tela.

**Regras de dados (ajustes da rodada 1 do QA):**
- **Valores (1.1):** todo valor é número com no máximo 2 casas decimais e maior que zero. Tetos de sanidade, acima dos quais a API responde 400:
  - `valor_solicitado` e `imoveis[].valor_estimado`: R$ 5.000.000.000,00;
  - `renda_mensal`: R$ 10.000.000,00;
  - `faturamento_mensal`: R$ 1.000.000.000,00.
  - O nível 3 continua com mínimo de R$ 5.000.000,00. Na plataforma, a mesa vê os valores com a máscara BRL de sempre.
- **CPF e CNPJ (1.3):**
  - Valida com `isValidCpfCnpj` e `isValidCNPJ` (`lib/utils.ts` e `lib/validators/cpf-cnpj.ts`). Rejeita sequência repetida.
  - O CNPJ alfanumérico é aceito.
  - A entrada é normalizada removendo `[^0-9A-Za-z]` e passando para maiúsculas, nunca com `\D`.
  - Tipo e documento precisam bater: `PF` exige CPF válido e `PJ` exige CNPJ válido. A decisão é pelo `cliente.tipo` e pelo tamanho do valor normalizado (11 ou 14), nunca pela contagem de dígitos.
  - **Formato gravado** em `client_cpf_cnpj`: com máscara completa (`XXX.XXX.XXX-XX` ou `XX.XXX.XXX/XXXX-XX`, letras em maiúsculas), gerado por `formatCNPJ` ou pela máscara de CPF. É o mesmo formato que o modal grava quando o partner digita com máscara.
  - A deduplicação do cliente usa `resolveClient` e `normalizeDocument` (`lib/v3-clients.ts`), que já ignoram a máscara.
  - Na consulta, o documento sai mascarado: CPF `***.456.789-**` e CNPJ `XX.XXX.XXX/****-**`. As letras do CNPJ alfanumérico aparecem quando não estão no trecho mascarado.
  - Nenhuma rota `v1` usa `replace(/\D/g, "")` em documento; um teste unitário cobre o caso `12.ABC.345/01DE-35`.
- **Contraparte estrangeira (1.3):** a v1 aceita só cliente com CPF ou CNPJ. Cliente sem documento brasileiro, inclusive nas linhas de câmbio e internacionais, segue pela plataforma, onde a mesa trata o caso. A API responde 400 `documento_estrangeiro_nao_suportado`, com uma mensagem que orienta usar a plataforma. Passaporte e tax ID ficam para a fase 2.
- **Telefone (1.4):**
  - Obrigatório em E.164 (`+` mais DDI, DDD e número, de 10 a 15 dígitos), validado.
  - É gravado como veio em E.164, porque `telefoneCreditoParaSalvar` mantém o valor que começa com `+`. Isso serve ao WhatsApp e permite DDI de outros países.
  - Na tela da mesa, o número brasileiro aparece como `+55 (XX) XXXXX-XXXX`.
- **Datas (1.5):**
  - Na API, data no formato `AAAA-MM-DD`. É validada como data de calendário (`nascimento` no passado, idade entre 18 e 120 anos) e gravada como texto `AAAA-MM-DD`, sem `new Date()`, para não deslocar o dia pelo fuso.
  - Data com hora sai em ISO 8601 com fuso `-03:00`.
  - Nas telas, as datas aparecem em `DD/MM/AAAA`.
- **Listas da API (4.1):**
  - `GET /propostas` ordena por `atualizado_em desc` e, no empate, por `codigo desc`, em páginas de 50 com cursor.
  - Em `GET /propostas/{id}`, os documentos recebidos ficam em ordem de envio (`recebido_em asc`) e os pendentes na ordem do checklist.

**Banco e acesso (ajustes da rodada 1 do QA, seção 6):**
- **Tabelas novas:** `partner_api_keys`, `partner_api_requests`, `partner_api_termo_aceites`, `partner_api_codigos` e `partner_api_bloqueios`. Nas cinco:
  - RLS ligada;
  - `revoke all ... from anon, authenticated` explícito na migration;
  - nenhuma política para `public` ou `anon`.
- **Leitura pelo partner, imposta no banco:**
  - A tela `/integracao-api` lê com a sessão do usuário, pela view `partner_api_keys_minhas`. A view tem `with (security_invoker = true)` e lista só as colunas sem segredo (sem `key_hash`).
  - A política de `select` em `partner_api_keys` vale para `authenticated` com `using (partner_id = auth.uid())`. O `grant select` vale só nas colunas da view.
  - Escrita (criar e revogar chave) só pela rota de servidor, que confere o código de e-mail e o aceite do termo. Não existe política de `insert`, `update` nem `delete` para `authenticated`.
- **Leitura pelo ADMIN:** a aba do ADMIN lê pela rota de servidor, depois de conferir `profiles.role = 'ADMIN'`.
- **Rotas `/api/v1` (exceção declarada à regra 6.5):**
  - Não há sessão do Supabase, porque quem chama é o sistema do partner. A rota resolve o `partner_id` pela chave (hash) e só então consulta com a chave de serviço, sempre com `.eq("partner_id", partnerIdDaChave)`.
  - Controles que compensam a exceção:
    - o filtro está numa função única (`lib/api-keys.ts`, `escopoDaChave`), usada por todas as rotas `v1`;
    - um teste unitário prova que uma chave do partner A recebe 404 na proposta do partner B;
    - o log registra cada acesso.
  - `credit_desk_proposals` continua com a RLS que já tem. Nada nela muda.
- **Funções:** nenhuma `SECURITY DEFINER` nova. A limpeza do log de 12 meses roda no cron, pela rota de servidor com a chave de serviço.
- **Storage (6.7):**
  - O bucket `credit-documents` já é **privado**, conferido em 06/11/2026: `public: false`, limite de 50 MB, tipos PDF, JPG, PNG, DOC e DOCX. A API não muda o bucket.
  - O link de envio é assinado, vale para um único caminho (`{partner_id}/{proposal_id}/{tipo}_{timestamp}_{nome}`) e expira em 2 horas.
  - O limite de 25 MB da API é mais restrito que o do bucket.
- **Chave de serviço (6.6):** usada só nas rotas de servidor; nunca em `NEXT_PUBLIC_*` nem em componente.

**Erros:** JSON `{ "erro": { "codigo", "mensagem", "campos" } }`, com mensagem em português e os códigos HTTP:

| Código | Quando |
|---|---|
| 400 | Dados inválidos |
| 401 | Chave inválida ou revogada |
| 403 | Plano sem acesso ou linha não permitida |
| 404 | Proposta não encontrada |
| 409 | `referencia_externa` repetida |
| 413 | Arquivo grande demais |
| 415 | Tipo de arquivo não aceito |
| 422 | Trava de regra |
| 429 | Limite de requisições |

**Banco:** ver "Banco e acesso" acima.

## PLANO DE TESTE
- **Unitários:**
  - Geração e conferência da chave.
  - Chave revogada recebe 401.
  - Idempotência: a mesma `Idempotency-Key` devolve a mesma proposta.
  - `referencia_externa` repetida recebe 409.
  - As travas: Nível 3, partner HE e linha inexistente.
  - Documento de outro partner recebe 404.
  - Tipo de arquivo conferido pelos bytes.
  - A consulta devolve o CPF mascarado.
- **Regressão:** criar proposta pelo modal antes e depois da extração, com o mesmo resultado no banco.
- **Acesso ao banco (6.8):** antes de aplicar a migration em produção, rodar em transação desfeita (`begin; ... rollback;`) com `set local role`:
  - **anon:** `select` nas 5 tabelas novas e na view nega ou devolve 0 linhas; `insert` nega.
  - **authenticated como partner A:** a view `partner_api_keys_minhas` devolve só as chaves de A, sem `key_hash`. `select` direto em `partner_api_requests`, `partner_api_termo_aceites`, `partner_api_codigos` e `partner_api_bloqueios` nega. `insert`, `update` e `delete` em `partner_api_keys` negam.
  - **authenticated como partner B:** não vê nenhuma chave de A.
  - **Equipe (ADMIN pela tela):** acesso só pela rota de servidor; o teste da rota confere que GESTAO, MESA e FINANCEIRO recebem 403 na aba de chaves.
  - Mostrar o resultado no BRIEF antes do segundo go.
- **Produção:**
  - Com uma chave de teste do Hamilton, criar uma proposta e subir RG, comprovante e matrícula.
  - Rodar o OCR pela mesa nesses arquivos.
  - Revogar a chave e conferir o 401.
  - Conferir com `anon` que as tabelas novas devolvem 0 linhas.

## ESTIMATE
- Complexidade: L
- Esforço: 5 a 6 dias, contando a tela de chaves, o termo com aceite, o código por e-mail, os IPs permitidos, os bloqueios, o cron de limpeza do log, a página do dev e os testes.
- Confiança: Média. O fluxo de documentos e o OCR já existem; o que é novo é a autenticação por chave e o limite de requisições.

## PARECER DE COMPLIANCE
**Termo de Uso v2.1:** texto integral entregue pelo Hamilton no chat em 06/11/2026, em substituição à minuta 1.0. Gravado em `docs/briefs/anexos/2026-11-06_termo-uso-api-minuta.md`.
- Lacunas antes de publicar: data de vigência, endereço da sede, valor da multa (12.7, com sugestão de 10 mensalidades) e comarca.
- **Revisão do Robson:** em 06/11/2026, perguntado no chat se o Robson já havia revisado a v2.1, o Hamilton respondeu: "sim, o Robson já revisou". O parecer considerado é o próprio texto da v2.1, revisado pelo Robson. Ele cobre o papel das partes (5.2 a 5.4), o encarregado (5.11), os prazos de comunicação de incidente (3.5, 6.3 e 6.6), o repasse de pedido do titular em 2 dias úteis (5.6) e os prazos de registro (9.2 e 9.3).
- **Antes de publicar a tela de aceite em produção**, preencher as lacunas: data de vigência, endereço da sede, valor da multa (12.7) e comarca. A tela não entra no ar com colchetes no texto: o código recusa publicar um termo que contenha `[`.

Direção do Hamilton (sócio), 06/11/2026, no chat:
1. Termo de uso: "importante faz o mais seguro possivel, com termo de aceitação e segurança". Minuta redigida em `docs/briefs/anexos/2026-11-06_termo-uso-api-minuta.md`.
2. Base legal e prazo de guarda iguais aos da tela: "sim, correto".
3. Papel das partes e encarregado, definido pelo Hamilton em 06/11/2026: partner e V3 são controladores independentes (cláusula 3.0 da minuta). O encarregado é Robson Lino, com o e-mail de contato suporte@v3partners.com.br (cláusula 3.6; trocado de robson.lino@ para suporte@ a pedido do Hamilton em 06/11/2026), que também recebe as comunicações de incidente (2.4 e 4.2).
4. IP e log: **decidido pelo Hamilton em 06/11/2026: "registros, ficam por 12 meses"**. O log técnico fica 12 meses, acima do mínimo de 6 do Marco Civil (art. 15). Os eventos de criação e de envio de documento ficam pelo prazo da proposta.

`[VALIDAR COM ROBSON]`, bloqueante. O Robson precisa:
- revisar o texto da minuta do termo, em especial o papel de controlador do partner e da V3 (cláusula 3), o prazo de 24 horas para comunicar incidente (cláusula 4.2) e o prazo de 5 dias úteis para repassar pedido do titular (cláusula 3.5);
- confirmar os prazos de guarda do log.

Data, quem respondeu e texto do Robson: `[PENDENTE]`

## RELATÓRIO DO QA DE GOVERNANÇA

### Rodada 1 (06/11/2026): BLOQUEADO (12 falhas)
1. [1.1] Faltava teto de sanidade para os valores.
2. [1.3] Faltava o formato gravado do CPF/CNPJ e a normalização sem `\D`.
3. [1.3] Não tratava contraparte estrangeira.
4. [1.4] Faltava o formato de gravação do telefone.
5. [1.5] Datas sem regra contra deslocamento de fuso.
6. [3.3] A revogação pelo ADMIN não tinha modal nem ponto de acesso na tela.
7. [4.1] Listas sem ordenação declarada: chaves, `GET /linhas` e `GET /propostas`.
8. [6.1] A spec citava "duas tabelas novas", com cinco previstas, e sem `revoke` explícito.
9. [6.5] Leitura pelo partner imposta só na rota.
10. [6.7] Não declarava que o bucket é privado.
11. [6.8] O plano de teste de acesso só cobria `anon`.
12. `[VALIDAR COM ROBSON]`: o termo e os prazos de guarda do log.

As falhas de 1 a 11 foram corrigidas no BRIEF nas seções "Regras de dados", "Banco e acesso", UX do ADMIN e plano de teste.

### Rodada 2 (06/11/2026): BLOQUEADO (1 falha)
```
RELATÓRIO DE QA DE GOVERNANÇA
Material analisado: docs/briefs/2026-11-06_api-partner-propostas-credito.md, com o anexo do termo e a página do dev

PASSOU
- 1.1: valores numéricos com no máximo 2 casas, maiores que zero, com teto de sanidade por campo e mínimo do nível 3.
- 1.3: validação com os helpers oficiais, CNPJ alfanumérico aceito, normalização sem \D, decisão pelo tipo e pelo tamanho, formato gravado declarado, deduplicação por normalizeDocument, teste com 12.ABC.345/01DE-35, estrangeiro recusado com orientação.
- 1.4: E.164 obrigatório, DDI livre, exibição +55 (XX) XXXXX-XXXX.
- 1.5: AAAA-MM-DD na API, gravado como texto sem new Date(), DD/MM/AAAA nas telas.
- 3.1: respostas da API mascaradas; tela de chaves mostra só o prefixo.
- 3.3: revogação pelo partner e pelo ADMIN em modal vermelho V3, sem fechar por fora, com motivo e auditoria.
- 4.1: ordem declarada nas chaves do partner, na aba do ADMIN, em /linhas (escala de nível e depois pt-BR) e em /propostas.
- 5.1: textos de tela e do termo sem travessão e sem emoji.
- 6.1 e 6.2: cinco tabelas com RLS, revoke de anon e authenticated, nenhuma política para public ou anon.
- 6.3: view partner_api_keys_minhas com security_invoker.
- 6.4: nenhuma função SECURITY DEFINER nova.
- 6.5: leitura do partner imposta no banco pela política; exceção das rotas /v1 declarada, com controles e teste A contra B.
- 6.6: chave de serviço só no servidor.
- 6.7: bucket privado conferido em produção; link assinado com caminho único e expiração.
- 6.8: plano em transação desfeita para anon, partner A, partner B e equipe.

FALHOU (BLOQUEANTE)
- [3 / LGPD] [VALIDAR COM ROBSON]
  Trecho: "Data, quem respondeu e texto do Robson: [PENDENTE]"
  Correção exigida: parecer do Robson sobre a minuta do termo (cláusulas 3, 3.5 e 4.2) e sobre os prazos de guarda do log, registrado no BRIEF.

SUGESTÃO DE UX
- Na tela de criar chave, mostrar o IP de quem está criando como sugestão, com o aviso de que o IP certo é o do servidor do sistema, não o do computador.
- No e-mail de chave perto de vencer, incluir o link direto para criar a chave nova.
- Na página do dev, incluir um exemplo completo em curl do fluxo inteiro.

NÃO SE APLICA
- 1.2, 2.1 a 2.4 e 3.4: não há contrato gerado nem valor injetado em minuta.
- 3.2: não há revelação de dado completo nesta feature.

VEREDITO: BLOQUEADO (1 falha: parecer do Robson)
```

### Rodada 3 (06/11/2026): LIBERADO
```
RELATÓRIO DE QA DE GOVERNANÇA
Material analisado: BRIEF 2026-11-06_api-partner-propostas-credito.md depois do Termo v2.1, da visão do partner e dos comentários só leitura

PASSOU
- Itens da rodada 2 continuam atendidos.
- 1.3: CPF do beneficiário final validado com o helper oficial e gravado com máscara.
- 1.5: data da autorização de consulta em AAAA-MM-DD, sem new Date(), com faixa válida; comprovante em DD/MM/AAAA.
- 3.1: o bloco de PLD não sai pela API nem aparece para o partner; a resposta da API sai de uma lista fechada de campos.
- 3.3: incidentes não podem ser editados nem excluídos; a correção entra como novo registro.
- 4.1: comentários em ordem de envio; incidentes do mais recente para o mais antigo.
- 6.1, 6.2 e 6.5: as 7 tabelas novas com RLS, revoke de anon e authenticated e nenhuma política aberta; teste de acesso cobre as 7.
- LGPD: Termo v2.1 revisado pelo Robson (confirmado pelo Hamilton em 06/11/2026); publicação da tela bloqueada enquanto o texto tiver lacunas.

FALHOU (BLOQUEANTE)
- nenhum

SUGESTÃO DE UX
- Mostrar ao partner, na tela de chaves, um resumo de uma linha de cada cláusula em destaque, ao lado do texto integral.
- Avisar o partner por e-mail 15 dias antes de uma nova versão do termo entrar em vigor.

NÃO SE APLICA
- 1.2, 2.1 a 2.4 e 3.4: sem contrato gerado.
- 3.2: sem revelação de dado completo.

VEREDITO: LIBERADO PARA "GO"
```

## REGISTRO DE LIBERAÇÃO
`[PENDENTE]`

## NOTAS DE IMPLEMENTAÇÃO (06/11/2026)

Go do Hamilton em 06/11/2026: "go BRIEF 2026-11-06_api-partner-propostas-credito". Branch `feat/api-partner-propostas`.

**O que mudou em relação ao desenho, e por quê:**
- **PLD em tabela própria**, `credit_proposal_pld`, e não em coluna de `credit_desk_proposals`. O partner lê a própria proposta inteira pela plataforma, inclusive `metadata`; numa coluna ou no `metadata`, o PLD vazaria para ele. São 8 tabelas novas, e o teste de acesso cobre as 8.
- **Selo "Via API"** lido de `metadata.origem_api` (e `metadata.referencia_externa` no tooltip), além das colunas `origem` e `referencia_externa`. Assim as telas da mesa não dependem de colunas novas no `select`, e o deploy não quebra se rodar antes da migration.
- **Página do ADMIN** em `/admin-cadastros/chaves-api`, com item "Chaves de API" no menu, em vez de uma aba dentro de `/admin-cadastros`. A tela de cadastros não tem abas, e uma página própria evita mexer no componente de 1.500 linhas.
- **Comentários** vêm da sala do partner no chat (`room_id = partner_<id>`, `proposta_id = id`). Foi conferido que o `GET /api/chat/messages?proposta_id=` responde 403 para o partner; o que ele vê de verdade é a própria sala. Mensagens da proposta em outras salas não saem.
- **`restricao`** aceita só `SIM` ou `NAO`, os dois valores do modal. `NAO_SEI` saiu da documentação.
- **Documentação para o dev** servida pela própria plataforma em `/integracao/api-propostas.html` (`public/integracao`), liberada no `proxy.ts`. A cópia no Artifact continua para o Hamilton compartilhar.
- **`/api/v1/`** liberado no `proxy.ts` (sem sessão): cada rota exige a chave em `lib/api-v1/auth.ts`.
- **Termo** publicado pelo ADMIN na página de chaves ("Publicar termo"); a rota recusa texto com colchetes, então a v2.1 só entra depois de preenchidas as lacunas.

**Arquivos:** `lib/api-keys.ts`, `lib/api-v1/{auth,http,proposta,rota,arquivos,visao-partner}.ts`, `lib/integracao-api.ts`, `lib/credit-proposal-create.ts`, `app/api/v1/**`, `app/api/integracao-api/**`, `app/api/admin/{api-chaves,api-incidentes,api-termos}/**`, `app/api/cron/api-v1-manutencao`, `app/api/credit-proposals/[id]/pld`, telas em `app/(platform)/integracao-api` e `app/(platform)/admin-cadastros/chaves-api`, componentes em `components/integracao-api/`, `components/shared/selo-via-api.tsx`, `components/mesa-credito/pld-informado.tsx`; alterados `app/api/credit-proposals/route.ts` (POST usa a função compartilhada), `credit-desk-client.tsx`, `nivel1-client.tsx`, `proposta-detail-modal.tsx`, `sidebar.tsx`, `proxy.ts`, `vercel.json` (cron 06h30 UTC).

**Testes:** `tests/unit/api-v1.test.ts`, 27 testes; suíte inteira 325 de 325. Checagem de tipos sem erro nos arquivos novos e alterados.

**Teste de acesso (6.8):** `docs/briefs/anexos/2026-11-06_teste-acesso-api.sql`. Aplica a migration dentro de uma transação, testa anon, partner A e partner B, e aborta no fim mostrando o resultado. Resultado: 23 de 23 conforme o esperado (ver "Segundo go").

**Antes de ligar para os partners:**
1. Segundo go e aplicação de `supabase/migrations/20261106a_partner_api.sql`.
2. Preencher as lacunas da v2.1 e publicar em "Chaves de API" → "Publicar termo".
3. Opcional: variável `API_V1_UPLOAD_SECRET` na Vercel (sem ela, o identificador de envio é assinado com a chave de serviço).

**Lacunas do termo preenchidas (Hamilton, 06/11/2026):** vigência de 12 meses a partir da publicação; sede na Rua Visconde de Pirajá, nº 414, sala 718, Ipanema, Rio de Janeiro/RJ, CEP 22410-905 (cartão CNPJ, base pública da Receita, consultado em 06/11/2026); multa de R$ 200.000,00 por evento (12.7); foro do Rio de Janeiro/RJ (15.5). Texto pronto para publicar: `docs/briefs/anexos/2026-11-06_termo-uso-api-v2.1-publicar.txt` (passa na trava de lacunas; as 7 cláusulas em destaque são reconhecidas). Ponto para o Robson: a vigência de 12 meses convive com a cláusula 13.1 ("vigora enquanto houver acesso à API"); na prática, a renovação será uma nova versão publicada, com novo aceite.

**Segundo go (migration):** Hamilton, 06/11/2026: "go migration 20261106a_partner_api". Aplicada pelo Hamilton no SQL Editor em 06/11/2026 ("Success. No rows returned"), sem rodar antes o teste em transação. Conferência feita depois, pela API REST de produção: as 8 tabelas e a view existem; anon recebe 401 (42501, permission denied) em leitura das 9 e em inserção; colunas `origem` e `referencia_externa` presentes. Teste de acesso completo (`2026-11-06_teste-acesso-api.sql`), rodado pelo Hamilton no SQL Editor em 06/11/2026: 23 de 23 conforme o esperado. anon negado em leitura das 9 relações e em inserção; partner A vê só a chave A pela view, não lê `key_hash` e não lê, altera nem apaga nas demais; partner B vê só a chave B; `partner_api_termos` não aceita alteração (gatilho de imutabilidade).
