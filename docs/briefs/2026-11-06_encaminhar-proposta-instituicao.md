# BRIEF: Encaminhar proposta para Instituição por e-mail, com documentos anexos

> Data: 2026-11-06 | Autor: Claude, a pedido do Hamilton | Status: QA LIBERADO (rodada 3), aguardando go
> Pedido do Hamilton: "na proposta do modal na mesa operacional, a parte do encaminhar para securitizadora, trocar encaminhar para Instituição, tem como selecionar e enviar por email? e colocar no corpo do email os detalhes da proposta e os documentos em anexo"; "quero que confirme o email também, ou dê para editar quando for mandar, e no cadastro de instituições dá para add mais de um email e o estado que se encontra o gerente de atendimento"; "quero que anexo os documentos".

## SCOPE
1. **Cadastro de instituições com vários contatos:**
   - Cada instituição passa a ter uma lista de contatos, com nome, e-mail, UF onde o gerente de atendimento está (ou "Nacional"), cargo (padrão "Gerente de atendimento"), telefone opcional e um contato principal.
   - Os e-mails que já existem (`contato_email` e `email`) entram como primeiros contatos, pela migration.
2. **Modal da proposta:**
   - A seção "Encaminhar para Securitizadora" vira **"Encaminhar para Instituição"**.
   - O envio passa a ser por **e-mail**, a uma ou várias instituições do cadastro.
3. **Confirmar e editar os destinatários na hora do envio:**
   - Para cada instituição escolhida, aparecem os contatos dela já marcados. Vêm primeiro os da UF da proposta e os "Nacional".
   - A mesa pode desmarcar contatos, corrigir um e-mail ou incluir outro só para este envio.
   - Um e-mail corrigido aqui não altera o cadastro.
4. **Corpo do e-mail com os detalhes da proposta** e uma mensagem opcional da mesa.
5. **Documentos anexados:**
   - A mesa marca quais documentos da proposta vão. Todos vêm marcados.
   - Se a soma passar do limite de um e-mail, o envio é dividido em partes ("Parte 1 de 2"), cada uma com o resumo da proposta.
6. **Registro:**
   - Cada envio fica gravado, com instituição, destinatários, documentos, partes, quem enviou, data, hora e resultado.
   - A instituição entra sozinha em "Instituições Encaminhadas".
   - O envio aparece no histórico do modal.
7. **Acompanhamento de cada e-mail** (pedido do Hamilton: "quero um acompanhamento de envio"):
   - Cada destinatário recebe o **seu próprio e-mail**. Assim, um não vê o endereço do outro, e a situação fica por pessoa.
   - A situação de cada destinatário chega pelo webhook do Resend:
     - Enviado;
     - Entregue (chegou na caixa);
     - Aberto, quando o rastreio de abertura estiver ligado;
     - Atrasado;
     - Devolvido (e-mail inexistente ou caixa cheia), com o motivo;
     - Marcado como spam.
   - Devolução ou spam gera alerta no sino da mesa: "E-mail da proposta [código] para [e-mail] voltou: [motivo]".
8. **Tela "E-mails enviados"** (pedido do Hamilton: "uma tela que podemos ver os e-mails enviados"):
   - Página `/mesa-operacional/envios`, no menu da Mesa Operacional.
   - Mostra todos os encaminhamentos de todas as propostas.
   - Detalhe por destinatário, com a linha do tempo de cada e-mail.
9. **E-mail que avisa quando falha:** uma função nova de envio devolve o identificador do e-mail ou o erro. A função atual (`send` em `lib/email.ts`) engole o erro em silêncio, e com ela a mesa acharia que enviou quando não enviou.

**Fora do escopo:**
- A integração por API com securitizadora (`/api/credit-proposals/[id]/submit-partner`) continua no código, mas o botão sai da tela. Hoje só existe um parceiro, e inativo.
- A instituição responder pela plataforma.
- A senha do portal da instituição guardada no cadastro (`instituicoes.portal_senha`). É um achado de segurança e terá BRIEF próprio.

## IMPACT
- **Arquivos alterados:**
  - `components/mesa-credito/proposta-detail-modal.tsx`: a seção nova substitui "Encaminhar para Securitizadora"; o resto do modal não muda.
  - `components/mesa-operacional/instituicoes-panel.tsx`: bloco "Contatos" no formulário da instituição.
  - `app/api/instituicoes/route.ts` e `app/api/instituicoes/[id]/route.ts`: devolvem os contatos junto.
  - `lib/email.ts`: função nova `enviarEmailRegistrado`, que lança erro e devolve o id. A `send` atual não muda.
- **Arquivos novos:**
  - `components/mesa-credito/encaminhar-instituicao.tsx`.
  - `app/api/instituicoes/[id]/contatos/route.ts` (GET, POST) e `app/api/instituicoes/contatos/[contatoId]/route.ts` (PATCH, DELETE).
  - `app/api/credit-proposals/[id]/encaminhar/route.ts`: GET dados para a tela; POST envia.
  - `lib/encaminhar-instituicao.ts`: corpo do e-mail, divisão em partes e validação de e-mail.
  - `tests/unit/encaminhar-instituicao.test.ts`.
  - `app/api/webhooks/resend/route.ts`: recebe os eventos do Resend e confere a assinatura (Svix) com `RESEND_WEBHOOK_SECRET`. Sem assinatura válida, responde 401 e não grava nada.
  - `app/api/envios-instituicoes/route.ts`: lista para a tela, só ADMIN, GESTAO e MESA_OPERACIONAL.
  - `app/(platform)/mesa-operacional/envios/page.tsx` (com `requireRole`) e `components/mesa-operacional/envios-instituicoes-client.tsx`.
  - `proxy.ts`: `/api/webhooks/resend` entra em `PUBLIC_ROUTES`, como o `/api/webhooks/certone`. A segurança é a assinatura conferida dentro da rota.
  - `components/layout/sidebar.tsx`: item "E-mails enviados" na Mesa Operacional.
- **Tabelas:**
  - Nova `instituicao_contatos`: `id`, `instituicao_id`, `nome`, `email`, `uf` (2 letras ou nulo para Nacional), `cargo`, `telefone`, `principal`, `ativo`, `created_at`, `updated_at`. Índice único em (`instituicao_id`, `lower(email)`).
  - Nova `credit_proposal_envios`: `id`, `proposal_id`, `instituicao_id`, `instituicao_nome`, `destinatarios` (text[]), `assunto`, `mensagem`, `documentos` (jsonb: `doc_id`, `file_name`, `bytes`), `partes`, `resend_ids` (text[]), `status` (`enviado`, `parcial` ou `falha`), `erro`, `enviado_por`, `enviado_em`.
  - `credit_desk_proposals.instituicao_encaminhada`: coluna que já existe, recebe o nome da instituição.
  - Nova `credit_proposal_envio_destinatarios`, uma linha por destinatário e por parte: `id`, `envio_id`, `email`, `nome`, `fora_do_cadastro` (bool), `parte`, `resend_id` (único), `status` (`enviado`, `entregue`, `aberto`, `atrasado`, `devolvido`, `spam` ou `falha`), `motivo`, `enviado_em`, `entregue_em`, `aberto_em`, `devolvido_em`, `atualizado_em`.
  - Nova `email_eventos`: log bruto do webhook, com `id`, `resend_id`, `tipo`, `ocorrido_em`, `recebido_em`, `svix_id` (único, para não processar o mesmo evento duas vezes). Guarda só o tipo, a hora e o destinatário, nunca o corpo do e-mail.
  - `audit_logs`: um registro por envio.
- **APIs e integrações:** Resend, para o envio com anexos, e Supabase Storage, para baixar os documentos.

## UX: ONDE O USUÁRIO VÊ ISSO
- **Cadastro (Mesa Operacional → Instituições → editar instituição):**
  - Bloco "Contatos" com uma linha por contato: Nome, E-mail, UF (lista das 27 UFs e "Nacional", em ordem alfabética, com "Nacional" no topo), Cargo, Telefone e "Principal".
  - Botões "Adicionar contato" e "Remover". Remover abre o modal V3: "Remover o contato [nome]? Ele deixa de aparecer nos próximos envios. Envios já feitos continuam no histórico."
  - E-mail validado ao digitar. Telefone com DDI, no padrão `+55 (XX) XXXXX-XXXX`, gravado em E.164.
  - **Ordem da lista de contatos:** principal primeiro; depois por UF (Nacional antes) e por nome, com `localeCompare("pt-BR")`.
  - Estado vazio: "Nenhum contato. Adicione pelo menos um e-mail para encaminhar propostas a esta instituição."
- **Modal da proposta (Mesa Operacional e Mesa de Crédito, só ADMIN, GESTAO e MESA_OPERACIONAL):** a seção **"Encaminhar para Instituição"** tem três passos.
  1. **Instituições:**
     - Lista do cadastro, só as ativas, em ordem alfabética (`localeCompare("pt-BR")`), com caixa de seleção.
     - Instituição sem contato aparece desabilitada, com "sem e-mail cadastrado" e o link "Cadastrar contato".
     - Instituição que já recebeu esta proposta mostra a etiqueta "Já encaminhada em DD/MM/AAAA".
  2. **Destinatários (confirmar ou editar):**
     - Para cada instituição, os contatos aparecem com caixa de seleção, nome, e-mail, UF e cargo.
     - Vêm marcados os da UF da proposta e os "Nacional". A UF da proposta é a do primeiro imóvel em garantia ou, se não houver imóvel, a do endereço do cliente.
     - Cada e-mail pode ser corrigido no próprio campo, só para este envio.
     - O campo "Incluir outro e-mail" adiciona um destinatário avulso, também só para este envio.
     - Nenhuma instituição pode seguir sem pelo menos um destinatário válido.
  3. **Documentos e mensagem:**
     - Lista dos documentos da proposta, com nome do documento do checklist, nome do arquivo e tamanho em MB. Todos vêm marcados.
     - Na ordem do checklist e, dentro do documento, por data de envio.
     - Mostra o total em MB e, quando passar do limite, o aviso "O envio será dividido em N e-mails".
     - Campo opcional "Mensagem para a instituição", com até 2.000 caracteres.
     - Botão "Ver o e-mail" mostra a prévia do corpo.
- **Confirmação:**
  - O botão "Encaminhar" abre o modal vermelho V3: "Encaminhar a proposta [código] para [N] instituições? Serão enviados [X] e-mails para: [lista de e-mails por instituição], com [Y] documentos ([Z] MB). Depois de enviado, o e-mail não pode ser desfeito."
  - O modal fecha só em "Cancelar" ou "Confirmar e enviar"; clicar fora não fecha.
- **Resultado:**
  - Uma linha por instituição: "Enviado para [e-mails] em [N] partes", ou "Falhou: [motivo]" com o botão "Tentar de novo" só para as que falharam.
  - Histórico "Envios" na mesma seção: data e hora (`DD/MM/AAAA HH:MM`), instituição, destinatários, número de documentos e quem enviou, do mais recente para o mais antigo.
- **Estado vazio do histórico:** "Esta proposta ainda não foi encaminhada a nenhuma instituição."

**Acompanhamento no modal da proposta:**
- No histórico "Envios", cada destinatário mostra uma etiqueta com a situação: Enviado, Entregue, Aberto, Atrasado, Devolvido, Spam ou Falhou, mais a data e hora da última mudança.
- Devolvido e Spam aparecem em vermelho, com o motivo e o botão "Corrigir e-mail e reenviar". Esse botão reenvia só para aquele destinatário, com o e-mail editado, e pede confirmação.

**Tela "E-mails enviados" (`/mesa-operacional/envios`, menu Mesa Operacional, só ADMIN, GESTAO e MESA_OPERACIONAL):**
- **Resumo no topo:** envios nos últimos 30 dias, entregues, abertos, devolvidos e com falha. Os números são clicáveis e filtram a lista.
- **Lista:** uma linha por envio, com:
  - data e hora (`DD/MM/AAAA HH:MM`);
  - proposta (código e cliente);
  - instituição;
  - destinatários (até 3, depois "+N");
  - documentos (quantidade e MB) e partes;
  - quem enviou;
  - situação geral, que é a pior entre os destinatários (Devolvido > Falhou > Atrasado > Enviado > Entregue > Aberto).
- **Ordem:** do mais recente para o mais antigo.
- **Filtros:**
  - período (padrão: últimos 30 dias);
  - instituição (lista em ordem alfabética pt-BR);
  - situação;
  - quem enviou (lista por nome, `localeCompare("pt-BR")`);
  - busca por código da proposta ou e-mail.
- **Ordem do filtro de situação:** a escala Devolvido, Spam, Falhou, Atrasado, Enviado, Entregue, Aberto, que é ordinal com significado.
- **Paginação:** de 50 em 50.
- **Detalhe**, ao clicar, num painel lateral:
  - assunto, mensagem e lista de documentos de cada parte;
  - linha do tempo de cada destinatário: enviado às HH:MM, entregue às HH:MM, aberto às HH:MM ou devolvido com o motivo;
  - botão "Abrir proposta", que abre o modal da proposta;
  - botão "Reenviar" para quem falhou ou foi devolvido.
- **Estado vazio:** "Nenhum e-mail enviado no período. Os encaminhamentos feitos pelo modal da proposta aparecem aqui."
- O corpo do e-mail e os anexos **não** são guardados de novo. A tela mostra o que foi enviado a partir do registro (nomes dos arquivos e mensagem), e os documentos continuam na proposta.

**O e-mail que a instituição recebe:**
- **Remetente:** V3 Partners. **Responder para:** o e-mail de quem enviou da mesa.
- **Assunto:** "Proposta de crédito [código]: [linha], [valor]" (ex.: "Proposta de crédito CR-26-000318: Home Equity, R$ 350.000,00").
- **Corpo (modelo V3, sem travessão e sem emoji):**
  - mensagem da mesa;
  - código e linha;
  - valor solicitado em `R$ 1.500.000,00`;
  - prazo e **objetivo do crédito** (finalidade);
  - garantia: **tipo da garantia** (imóvel urbano, rural ou sem garantia) e, para cada imóvel, cidade/UF, zona, padrão e **avaliação** (o valor da avaliação técnica quando houver; se não, o valor estimado informado, com a indicação "estimado");
  - cliente: tipo, nome ou razão social, cidade/UF, renda ou faturamento mensal, e se tem restrição. **Sem CPF ou CNPJ no corpo** (decisão do Hamilton em 06/11/2026); o documento do cliente vai só nos anexos;
  - lista dos documentos anexados;
  - "Parte X de N", quando dividido;
  - aviso de confidencialidade.
- **Não vão:**
  - o nome do partner, por não circunvenção;
  - notas internas da mesa;
  - comissões;
  - outras instituições encaminhadas;
  - análise de IA;
  - telefone e e-mail do cliente;
  - CPF ou CNPJ, RG e data de nascimento (vão só nos documentos anexos).

## DEPENDENCIES
- **Deve existir antes:** o cadastro `instituicoes` (13 instituições, 9 com e-mail de contato), o bucket `credit-documents` e o Resend configurado.
- **Migration pendente:** `20261107a_instituicao_contatos_envios.sql`. Cria as duas tabelas, copia os e-mails existentes para `instituicao_contatos` e aplica RLS fechada. Exige segundo go antes de aplicar.
- **Parecer do Robson:** `[VALIDAR COM ROBSON]`, bloqueante. Ver PARECER DE COMPLIANCE.
- **Configuração no Resend (Hamilton ou quem tem acesso ao painel):**
  - criar o webhook apontando para `https://app.v3partners.com.br/api/webhooks/resend`, com os eventos `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained` e `email.opened` (obrigatório, parecer do Robson, item 5);
  - copiar o segredo de assinatura para a variável `RESEND_WEBHOOK_SECRET` na Vercel. Eu gravo pelo CLI se o valor for colado no terminal, sem passar pelo chat;
  - ligar o rastreio de abertura no domínio (obrigatório, parecer do Robson, item 5).
- **Migration:** inclui as tabelas `credit_proposal_envio_destinatarios` e `email_eventos`.

## BANCO E ACESSO
- **Tabelas novas:** `instituicao_contatos`, `credit_proposal_envios`, `credit_proposal_envio_destinatarios` e `email_eventos`. Nas quatro:
  - RLS ligada;
  - `revoke all ... from anon, authenticated` explícito na migration;
  - nenhuma política;
  - nenhuma view;
  - nenhuma função `SECURITY DEFINER`.
- **Quem lê e escreve:**
  - Só as rotas de servidor, com a chave de serviço, depois de conferir `profiles.role` em ADMIN, GESTAO ou MESA_OPERACIONAL.
  - O webhook grava em `email_eventos` e `credit_proposal_envio_destinatarios` só depois de validar a assinatura Svix.
  - Partner e anon nunca leem: os envios revelam a quais instituições a proposta foi, o que a cláusula de não circunvenção protege.
- **Imposição no banco (6.5):** como não há política para `authenticated`, o banco nega qualquer leitura com sessão de usuário. A regra de quem lê fica só na rota, por desenho, e o teste 6.8 prova a negação no banco.
- **Storage:** o bucket `credit-documents` continua privado. Os anexos são baixados no servidor e não ganham link público.

## RISKS (nunca "nenhum")
- **LGPD:** envio de dado pessoal e documentos do cliente (IR, extratos, RG) por e-mail a terceiro. O anexo fica na caixa da instituição sem controle da V3. Exige o Robson.
- **E-mail errado:** documento de cliente indo para a pessoa errada é o maior risco. Mitigações:
  - confirmação com a lista de e-mails visível;
  - destinatário avulso marcado como "fora do cadastro" na confirmação;
  - registro completo de cada envio;
  - "Responder para" o analista, que percebe resposta de endereço estranho.
- **Tamanho:**
  - O Resend aceita até 40 MB por e-mail, já com os anexos codificados, que crescem cerca de um terço.
  - O limite por parte é de **25 MB de arquivos**.
  - Arquivo sozinho maior que 25 MB não pode ser anexado: aparece desmarcado, com o aviso "Arquivo grande demais para e-mail".
  - A caixa de entrada da instituição pode ter limite menor que o do Resend (Gmail e Outlook aceitam de 20 a 25 MB). **Por isso o padrão é 20 MB por parte**, ajustável numa constante.
- **Tempo:**
  - Baixar até cerca de 100 MB e enviar vários e-mails cabe na função da Vercel com `maxDuration = 300`, o mesmo do OCR em lote.
  - Com 10 instituições e propostas grandes, o envio é feito instituição por instituição, e a tela mostra o progresso.
- **Envio parcial:** parte enviada e parte com falha fica com status `parcial`. O "Tentar de novo" reenvia só as partes que falharam.
- **Breaking change:** o botão "Enviar para Parceiro" (API) sai da tela. As propostas antigas com `instituicao_encaminhada` continuam iguais.
- **Rastreio de abertura:**
  - Ligar o "Aberto" exige ativar o rastreio de abertura no domínio do Resend, que coloca uma imagem invisível no e-mail.
  - Isso registra quando o funcionário da instituição abriu o e-mail. É dado pessoal dele, e por isso vai na pergunta 5 ao Robson.
  - O sistema funciona sem o "Aberto": nesse caso a etiqueta para em "Entregue".
  - Programas de e-mail que bloqueiam imagens não registram abertura. "Não aberto" nunca deve ser lido como "não leu".
- **Webhook público:** `/api/webhooks/resend` recebe chamadas da internet. A assinatura Svix é conferida antes de qualquer gravação; chamada sem assinatura válida recebe 401 e é ignorada. Evento repetido (mesmo `svix_id`) é ignorado.
- **Um e-mail por destinatário:** 3 contatos e 2 partes dão 6 e-mails. O plano do Resend tem limite de envios por segundo; o envio usa uma pausa curta entre e-mails para não estourar.
- **Spam:** e-mail com muitos anexos pode cair em spam. O remetente é o domínio V3 já autenticado no Resend, o assunto é claro e não há link encurtado.

## APPROACH
- **Abordagem:**
  - Envio montado no servidor: a rota baixa os documentos marcados do bucket, divide em partes de até 20 MB e envia pelo Resend com a função nova que confirma o envio.
  - Cada envio é gravado em `credit_proposal_envios` antes e atualizado depois, com o id do Resend ou o erro.
  - Os contatos ficam numa tabela própria, com UF, para filtrar pelo estado da proposta.
- **Alternativa descartada 1:** link seguro em vez de anexo. Descartada por decisão do Hamilton ("quero que anexo os documentos").
- **Alternativa descartada 2:** abrir o programa de e-mail do analista (`mailto:`) com os dados. Não anexa arquivos, não registra o envio e depende do computador de cada um.
- **Alternativa descartada 3:** guardar os vários e-mails numa coluna de texto da instituição. Não permite UF por gerente, contato principal nem impedir e-mail repetido.

## ESTIMATE
- Complexidade: L (perto de XL por causa do webhook e da tela nova)
- Esforço: 2,5 a 3 dias, com cadastro de contatos, modal em três passos, envio com partes, acompanhamento por webhook, tela de e-mails enviados e testes.
- Confiança: Média. A parte nova é a divisão de anexos e o comportamento do Resend com vários anexos grandes, a validar com um envio de teste real.

## PLANO DE TESTE
- **Unitários:**
  - Divisão em partes: 5 arquivos de 8 MB com limite de 20 MB dão 3 partes.
  - Arquivo maior que 25 MB fica fora.
  - E-mail inválido é recusado.
  - Destinatário avulso aparece marcado na confirmação.
  - O corpo do e-mail não contém o nome do partner, CPF ou CNPJ do cliente, telefone ou e-mail do cliente, nem notas internas (teste de paridade com lista de campos).
  - Ordem dos contatos e das instituições em pt-BR.
  - Envio parcial grava `parcial` e o reenvio manda só o que falhou.
  - Webhook: assinatura inválida recebe 401 e não grava nada; evento repetido é ignorado; `email.bounced` muda o destinatário para Devolvido e gera alerta; evento fora de ordem (entregue depois de aberto) não rebaixa a situação.
  - Situação geral do envio: a pior entre os destinatários.
- **Acesso ao banco (6.8), em transação abortada:** anon negado nas quatro tabelas novas (leitura e inserção); partner logado negado nas quatro; equipe só pela rota de servidor (teste de rota: PARTNER e FINANCEIRO recebem 403).
- **Produção:**
  - Cadastrar um contato de teste com o e-mail do Hamilton.
  - Encaminhar uma proposta de teste com 3 documentos e conferir a chegada, os anexos e o corpo.
  - Encaminhar uma com mais de 20 MB e conferir as partes.
  - Conferir o histórico e a auditoria.

## PARECER DE COMPLIANCE
`[VALIDAR COM ROBSON]`, bloqueante. Perguntas:
1. A V3 pode enviar à instituição, por e-mail, os documentos do cliente anexados (IR, extratos, RG, matrícula)? A cláusula 5.8 do Termo da API e a política de privacidade preveem o compartilhamento com instituições. A pergunta é sobre o **meio**, e-mail com anexo.
2. ~~CPF ou CNPJ no corpo~~: **decidido pelo Hamilton em 06/11/2026: o corpo não leva CPF nem CNPJ.** Resta ao Robson: a renda ou o faturamento mensal podem ir no corpo?
3. É preciso um aviso de confidencialidade no rodapé? Proposta: "Este e-mail e seus anexos contêm dados pessoais e informações confidenciais, compartilhados exclusivamente para análise de crédito. Se você não é o destinatário, apague e avise suporte@v3partners.com.br."
4. Por quanto tempo guardar o registro dos envios? Proposta: o mesmo prazo da proposta.
5. A V3 pode registrar quando o funcionário da instituição **abriu** o e-mail (imagem invisível de rastreio)? Proposta: sim, com menção no aviso de privacidade da V3. Se não for aprovado, o acompanhamento para em "Entregue".

**Parecer do Robson Lino (Compliance), 06/11/2026**, recebido pelo Hamilton e colado no chat. Imagem guardada em `docs/briefs/anexos/2026-11-06_parecer-robson-encaminhar-instituicao.png`. Texto:

> Eu, Robson, autorizo a continuidade dos procedimentos conforme as respostas abaixo:
> 1. Pode enviar os documentos do cliente anexados por e-mail à instituição? Sim, autorizado.
> 2. A renda ou o faturamento mensal podem constar no corpo do e-mail? Sim, incluindo avaliação da garantia, tipo da garantia, valor solicitado pelo cliente e objetivo do crédito.
> 3. O texto de confidencialidade no rodapé está adequado? Sim, aprovado.
> 4. Por quanto tempo guardar o registro dos envios? Concordo que seja pelo mesmo prazo de guarda da proposta.
> 5. Pode registrar quando a instituição abrir o e-mail? Sim, deve ser registrado.
>
> Declaração final: Eu, Robson, autorizo e concordo com todos os cinco itens acima, permitindo a continuidade do processo nesse formato. Data: 06/11/2026.

**Reflexo no desenho:**
- O corpo inclui renda ou faturamento, tipo e avaliação da garantia, valor solicitado e objetivo do crédito. CPF e CNPJ continuam fora, por decisão do Hamilton.
- O rodapé de confidencialidade aprovado entra como está.
- O registro de envios é guardado pelo prazo da proposta.
- O rastreio de abertura é **obrigatório**: o evento `email.opened` entra no webhook e o rastreio de abertura é ligado no domínio do Resend.

## RELATÓRIO DO QA DE GOVERNANÇA

### Rodada 1 (06/11/2026): BLOQUEADO (4 falhas)
- [4.1] O filtro "quem enviou" não tinha ordem declarada.
- [6.1] A migration não declarava o `revoke` explícito de anon e authenticated nas tabelas novas.
- [6.8] O plano de teste citava "duas tabelas novas", e são quatro.
- `[VALIDAR COM ROBSON]`: e-mail com documentos do cliente, CPF no corpo, aviso de confidencialidade, guarda do registro e rastreio de abertura.

As falhas 4.1, 6.1 e 6.8 foram corrigidas na seção "Banco e acesso", nos filtros da tela e no plano de teste.

### Rodada 2 (06/11/2026): BLOQUEADO (1 falha)
```
RELATÓRIO DE QA DE GOVERNANÇA
Material analisado: docs/briefs/2026-11-06_encaminhar-proposta-instituicao.md

PASSOU
- 1.1: valor sai do número gravado, em R$ 1.500.000,00; nenhum campo de valor digitado nesta tela.
- 1.4: telefone do contato com DDI, máscara +55 (XX) XXXXX-XXXX e gravação em E.164.
- 1.5: datas em DD/MM/AAAA e hora HH:MM na tela e no histórico.
- 3.3: envio com modal vermelho V3 listando destinatários e anexos, fechando só pelos botões; remover contato com modal; reenvio com confirmação.
- 4.1: ordem declarada em instituições, contatos, UFs, documentos, histórico, lista de envios e filtros (incluindo a escala de situação).
- 5.1: assunto, corpo e alertas sem travessão e sem emoji.
- 6.1, 6.2 e 6.5: quatro tabelas com RLS, revoke de anon e authenticated, sem política; leitura só pela rota com papel conferido.
- 6.3 e 6.4: sem view e sem função nova.
- 6.6: chave de serviço só no servidor; segredo do webhook em variável de servidor.
- 6.7: bucket privado; anexos baixados no servidor.
- 6.8: plano em transação abortada cobrindo as quatro tabelas.
- Webhook público com assinatura Svix conferida antes de gravar e eventos repetidos ignorados.

FALHOU (BLOQUEANTE)
- [LGPD] [VALIDAR COM ROBSON]
  Trecho: "Data, quem respondeu e texto: [PENDENTE]"
  Correção exigida: parecer do Robson sobre as 5 perguntas, registrado no BRIEF.

SUGESTÃO DE UX
- Na confirmação, destacar em ouro o destinatário "fora do cadastro", para a mesa olhar duas vezes antes de mandar documento de cliente.
- Na tela de e-mails enviados, permitir exportar a lista do período em CSV para prestação de contas.

NÃO SE APLICA
- 1.2, 2.1 a 2.4 e 3.4: sem contrato.
- 1.3: nenhum CPF ou CNPJ digitado nesta tela, e o corpo do e-mail não leva CPF nem CNPJ (decisão do Hamilton).
- 3.1 e 3.2: a tela não revela dado de cliente além de código e nome.

VEREDITO: BLOQUEADO (1 falha: parecer do Robson)
```

### Rodada 3 (06/11/2026): LIBERADO
Parecer do Robson registrado (5 de 5 autorizados, 06/11/2026). Corpo do e-mail ajustado ao item 2 (tipo e avaliação da garantia, valor solicitado, objetivo do crédito, renda ou faturamento) e rastreio de abertura tornado obrigatório (item 5). Nenhum outro item mudou desde a rodada 2.

```
FALHOU (BLOQUEANTE)
- nenhum

VEREDITO: LIBERADO PARA "GO"
```

## REGISTRO DE LIBERAÇÃO
`[PENDENTE]`

## NOTAS DE IMPLEMENTAÇÃO (06/11/2026)

Go do Hamilton em 06/11/2026: "go BRIEF 2026-11-06_encaminhar-proposta-instituicao". Branch `feat/encaminhar-instituicao`.

- **Arquivos:**
  - `lib/encaminhar-instituicao.ts`: lógica pura, também usada na tela.
  - `lib/encaminhar-instituicao-webhook.ts`: assinatura Svix, só no servidor, para não levar criptografia ao navegador.
  - `lib/encaminhar-instituicao-servidor.ts`: dados, envio e reenvio, com dependências injetáveis.
  - `lib/email.ts`: nova `enviarEmailRegistrado`, que lança o erro e devolve o id.
  - Rotas: `app/api/credit-proposals/[id]/encaminhar` (GET; POST `enviar`, `reenviar` e `previa`), `app/api/instituicoes/[id]/contatos`, `app/api/instituicoes/contatos/[contatoId]`, `app/api/webhooks/resend` e `app/api/envios-instituicoes`.
  - Telas: `components/mesa-credito/encaminhar-instituicao.tsx`, que substitui o bloco "Encaminhar para Securitizadora" do modal; `components/mesa-operacional/contatos-instituicao.tsx`, que substitui o quadro "Contato Responsável" no card da instituição; `app/(platform)/mesa-operacional/envios` com `components/mesa-operacional/envios-instituicoes-client.tsx`.
  - Menu: "E-mails enviados" em Mesa Operacional. `proxy.ts`: `/api/webhooks/resend` público.
- **Mudanças em relação ao desenho:**
  - **Reenvio com e-mail corrigido:** a tentativa antiga recebe `substituido_por`, que aponta para a nova, e sai do cálculo da situação. Sem isso, o envio ficaria "parcial" para sempre. A coluna está na migration.
  - **Contatos no cadastro:** carregados pela rota própria (`/api/instituicoes/[id]/contatos`), sem mudar o `GET /api/instituicoes`. Assim a tela de instituições não depende de a migration ter rodado para listar as instituições.
  - **Remover contato** marca como inativo (`ativo = false`). Cadastrar de novo o mesmo e-mail reativa o contato.
  - **"Abrir proposta"** na tela de e-mails enviados usa `/mesa-operacional?proposalId=`, que a Mesa Operacional já entende.
  - **Prévia do e-mail:** montada no servidor (POST `previa`) e mostrada num `iframe` com `sandbox`.
- **Testes:** `tests/unit/encaminhar-instituicao.test.ts`, 13 testes. Cobrem:
  - partes;
  - e-mail;
  - ordem dos contatos;
  - contatos padrão por UF;
  - corpo com o que o Robson aprovou e sem CPF, contato do cliente, RG, nascimento, notas e partner;
  - situação que não rebaixa;
  - assinatura Svix;
  - envio parcial com destinatário fora do cadastro;
  - documento de outra proposta recusado.

  Suíte inteira: 347 de 347. Tipos sem erro. Auditoria de acesso ok.
- **Teste de acesso (6.8):** `docs/briefs/anexos/2026-11-07_teste-acesso-encaminhar.sql`. Resultado: `[PENDENTE]`.
- **Ordem do deploy:**
  1. Aplicar a migration `20261107a`.
  2. Configurar o webhook no Resend.
  3. Gravar `RESEND_WEBHOOK_SECRET` na Vercel.
  4. Deploy.

  Sem o segredo, o webhook responde 401 a tudo, e os e-mails ficam em "Enviado". O envio em si funciona.
- **Teste de acesso, 06/11/2026 (primeira versão):** 10 de 10 negados como esperado (anon e partner, leitura e inserção, nas 4 tabelas). A importação trouxe 7 contatos em vez de 9: os campos de contato da Oxy (dois e-mails separados por "/") e da Red Asset (e-mail com texto junto) não passaram na validação. O da Galleria Bank não tem e-mail e precisa de cadastro manual.
- **Migration 20261107a aplicada** pelo Hamilton no SQL Editor em 06/11/2026 ("Success. No rows returned"), na versão anterior à correção da importação. O segundo go por escrito não foi digitado no chat. Conferência pela API REST de produção: as 4 tabelas existem, anon recebe 401 em todas, a coluna `substituido_por` existe, e há 7 contatos em 6 instituições.
- **Complemento `20261107b_instituicao_contatos_importacao.sql`:** importa os contatos que faltaram, separando o campo por espaço, ponto e vírgula, vírgula, barra ou barra vertical. Não cria tabela nem muda permissão, e rodar de novo não duplica. Aplicado pelo Hamilton no SQL Editor em 06/11/2026. Conferência: 10 contatos em 8 instituições, com 1 principal em cada (Oxy com 2 e Red Asset com 1 a mais).
- **Instituição nova ou editada (pergunta do Hamilton: "se criar novas instituições, vai puxar automático?"):** ao criar (`POST /api/instituicoes`) ou editar os e-mails (`PATCH /api/instituicoes/[id]`), os e-mails digitados nos campos "E-mail do contato" e "E-mail" entram sozinhos na lista de contatos (`sincronizarContatosDoCadastro`), com a mesma separação de vários e-mails e texto junto.
  - O primeiro e-mail vira principal só se a instituição ainda não tiver um principal.
  - E-mail repetido é ignorado.
  - Contato removido volta ativo se o e-mail for digitado de novo no cadastro.
  - Testes: 2 novos. Suíte inteira: 349 de 349.
