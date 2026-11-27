# BRIEF: Operação de teste na equipe "AGS Teste" (para ver a aba Mesa Operacional do master com dado)

> Data: 2026-11-27 | Autor: Claude (pedido do Hamilton: "cria um operação de teste") | Status: LIBERADO
> Operação de dados em produção, sem código. Complementa os BRIEFs `2026-11-26_usuario-teste-master-ags-teste.md` (master temporário) e `2026-11-26_mesa-operacional-master-enterprise.md` (PR #440).

## SCOPE
Inserir **uma** proposta de crédito fictícia em `credit_desk_proposals`, originada pelo usuário de teste "Teste AGS V3" (07668ecf-b524-4495-8bf2-ef18bb23db51), que hoje é master temporário do Enterprise "AGS Teste". Assim o Hamilton vê a aba Mesa Operacional do master com um card de verdade: a coluna, o card, o selo de pendência, os documentos que faltam e a janela de detalhe.

A proposta é apagada até 30/11/2026, ou antes se o Hamilton pedir. O passo de apagar pode rodar sozinho ou como passo 0 da reversão do master temporário.

Os dados são todos fictícios e marcados como teste:

| Coluna | Valor |
|---|---|
| code | `V3-CR-TESTE-AGS-0001` (fixo, não consome a sequência de códigos) |
| title | `HOME EQUITY - CLIENTE TESTE (NÃO ANALISAR)` |
| client_name | `CLIENTE TESTE (NÃO ANALISAR)` |
| client_cpf_cnpj | `000.000.000-00` (sequência repetida, rejeitada pelo validador `isValidCPF`, então não pertence a ninguém; aparece como `***.000.000-**`) |
| credit_line | `HOME EQUITY` (linha ativa do portfólio) |
| current_level | `NIVEL_1` |
| stage / status | `AVALIACAO_IMOVEL` / `PENDING` |
| requested_value | `850000` (aparece como R$ 850.000,00) |
| partner_id / created_by | 07668ecf-… (o usuário de teste) |
| documents | `[]` (nenhum arquivo; o card mostra "0 de 10 enviados") |
| pending_reason / pending_responsible / pending_at | `Teste: enviar matrícula atualizada do imóvel` / `Partner` / agora |
| metadata | `{ "client_type": "PF", "prazo": "180", "finalidade": "Teste da Mesa Operacional do master (não analisar)", "stage_changed_at": <agora>, "teste_ags": true, "brief": "2026-11-27_operacao-teste-ags-teste" }` |

Não são preenchidos: `v3_client_id` (nenhum cliente é criado no Client 360), `credit_line_id`, `instituicao_*`, `ma_deal_id`, `referencia_externa`, `origem`.

## IMPACT
- Arquivos afetados: nenhum código. Só este BRIEF e o ADENDO de 27/11 no BRIEF do master temporário. O ADENDO acrescenta o passo 0 da reversão e a regra "só olhar" para esta proposta, e corrige as frases que diziam que o usuário de teste não tinha propostas.
- Tabelas afetadas:
  - `credit_desk_proposals`: 1 INSERT agora e 1 DELETE na reversão;
  - `audit_logs`: 1 linha antes do INSERT e 1 antes do DELETE (user_id do ADMIN que executa, 75c6cac4…, como na ida do master temporário).
- Rotas e APIs afetadas: nenhuma. O INSERT é direto, pela service role, e não passa pela rota de criação de proposta.

## UX: ONDE O USUÁRIO VÊ ISSO
- **Master de teste** (Hamilton logado como "Teste AGS V3", em app.v3partners.com.br): em "Mesa Operacional" do menu, coluna "Avaliação de Imóvel", aparece 1 card com:
  - o selo "Pendência";
  - "CLIENTE TESTE (NÃO ANALISAR)", `***.000.000-**`, HOME EQUITY e R$ 850.000,00;
  - o usuário (nome do perfil de teste) e "0 de 10 enviados".

  Nos contadores: 1 ativa e R$ 850.000,00. Clicando, abre a janela com prazo de 180 meses, a finalidade, a pendência aberta e a lista de documentos que faltam.
- **Equipe interna da V3**: a proposta aparece também na Mesa Operacional e na Mesa de Crédito N1 da V3, com a tarja "AGS Teste". O nome do cliente diz "NÃO ANALISAR", e o Hamilton avisa a mesa com o texto da REGRA DO TESTE. Fica registrado o risco de confusão já citado no BRIEF do master: a tarja "AGS Teste" usa as cores da AGS real.
- Estado vazio: depois da exclusão, a aba volta a "Nenhuma operação da equipe ainda.".
- Sem UI? Tem UI (as telas acima).

## REGRA DO TESTE: SÓ OLHAR, TAMBÉM NESTA PROPOSTA
A regra "só olhar" do BRIEF do master temporário passa a valer também para esta proposta.
- **Proibido ao testador** (logado como "Teste AGS V3"):
  - abrir a proposta na Mesa de Crédito para agir;
  - responder a pendência;
  - enviar documento;
  - abrir ou escrever no chat da proposta;
  - pedir análise ou consulta.
- **Proibido à mesa da V3:**
  - mover de etapa;
  - rodar a Avaliação Técnica;
  - lançar cobrança;
  - enviar a instituição;
  - gerar mandato ou consentimento;
  - comentar ou anexar arquivo.
- Texto do aviso que o Hamilton manda à mesa: "Tem uma proposta de TESTE na Mesa (V3-CR-TESTE-AGS-0001, CLIENTE TESTE (NÃO ANALISAR), tarja AGS Teste). Não mexam nela: não movam de etapa, não rodem avaliação, não cobrem, não enviem a instituição, não gerem mandato, não comentem. Ela será apagada até 30/11."
- A pendência só existe para o selo aparecer no card. Ninguém deve respondê-la.

## DEPENDENCIES
- Deve existir antes: o master temporário "AGS Teste" e o PR #440. Os dois estão no ar.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- **Alerta de SLA**: o cron diário `mesa-operacional-sla-alert` avisa ADMIN e MESA_OPERACIONAL a partir do estado "warning" (70% do prazo) e não filtra teste. O prazo vem de `mesa_operacional_sla_config`, ou de `DEFAULT_SLA` quando a config está vazia.
  - Lido em produção em 27/11/2026: a config está vazia, então vale o padrão de 15 dias para AVALIACAO_IMOVEL. O warning cai em 10,5 dias, por volta de 07/12, depois do prazo da exclusão (30/11).
  - A pré-checagem relê a config na hora e **para** se 0,7 × limite, contado de agora, cair antes de 01/12.
- **Relatório mensal**: o envio de 01/12 cobre novembro pela data de criação. Se a proposta não for apagada até 30/11, entra no relatório enviado em 01/12 (referência novembro). Por isso o passo de apagar pode rodar **sozinho**, sem depender da reversão do master. O agente avisa o Hamilton em 30/11 se a proposta ainda existir.
- **Contadores e painéis da V3** (dashboard, Mesa de Crédito): +1 proposta enquanto durar o teste.
- **Dados ligados à proposta e exclusão definitiva**: o DELETE só roda se a proposta estiver **exatamente como foi criada** e **nada** apontar para ela.
  - Várias tabelas têm FK para `credit_desk_proposals` sem ON DELETE, e fariam o DELETE falhar: `crm_leads`, `partner_service_orders`, `operation_contract_links`, `credit_consents`.
  - Outras apagariam em cascata: `credit_documentos_assinatura`, `credit_upload_tokens`, `credit_document_names`, `credit_proposal_envios`, as tabelas da API de partners e outras.
  - Por isso a reversão faz um **inventário** (ver REVERSÃO). Se encontrar qualquer coisa além da própria linha intacta, ela **para** e lista o que achou para o Hamilton, e a limpeza vira outro BRIEF. Nada é apagado em cascata sem passar pelo inventário.
- **Triggers e webhooks**:
  - Pelas migrations, a única trigger da tabela é `trg_exige_transferencia_ma_credito`, que só age com `ma_deal_id`. Aqui esse campo fica nulo.
  - Limite honesto: o agente não consegue listar `pg_trigger` nem os database webhooks pela API REST, e não há URL de banco no env. Trigger ou webhook criado fora das migrations não aparece nessa conferência.
  - Mitigação 1, opcional, antes do go: o Hamilton roda no SQL Editor do Supabase a consulta só de leitura `select tgname from pg_trigger where tgrelid = 'public.credit_desk_proposals'::regclass and not tgisinternal;` e confere que só aparece `trg_exige_transferencia_ma_credito`.
  - Mitigação 2, sempre: 60 segundos depois do INSERT, o script procura qualquer coisa ligada à proposta:
    - `notifications` e `execution_errors` criados depois do INSERT que citem o id ou o código;
    - `chat_messages.proposta_id`;
    - `audit_logs` com `entity_id` = id, além da linha do agente;
    - o inventário completo.

    Se surgir algo, o agente relata ao Hamilton e já propõe apagar a proposta.
  - Um webhook oculto agiria do mesmo jeito numa proposta criada pela tela. Esse risco não é maior que o da alternativa descartada.
- **Notificações das rotas**: o INSERT direto não passa pelas rotas, que são as que mandam e-mail, WhatsApp e notificação. Nenhum componente assina realtime (`postgres_changes`) desta tabela.
- **LGPD e compliance**: nenhum dado pessoal. O nome é fictício e o CPF é uma sequência repetida que o validador rejeita. A proposta não cria cliente no Client 360 (`resolveClient` não é chamado) nem dispara consulta.
- **Trava da reversão do master temporário**: muda só para esta proposta, pelo critério único da REVERSÃO. **Qualquer outra** proposta do usuário de teste continua parando a reversão. O BRIEF do master recebe o ADENDO de 27/11 com o mesmo texto.
- Performance e Vercel timeout: não se aplicam.

## APPROACH
- Abordagem escolhida: INSERT direto, por script com a service role, de uma linha fictícia marcada (`teste_ags`), com auditoria antes. O script confere as condições, insere, relê a linha e apaga a env.
- Alternativas descartadas:
  - **O Hamilton criar pela tela da Mesa de Crédito, logado como teste:** a rota real cria o cliente no Client 360 com o CPF fictício, gasta um código da sequência e avisa a mesa como proposta nova. É mais efeito colateral para um teste que só precisa de visualização.
  - **Criar no nome do Marciano / AGS real:** proibido (nunca alterar a conta do cliente real).
  - **Marcar como análise do site** (`source=partner_service_order`): esconderia a proposta da própria aba que se quer testar.

## EXECUÇÃO (ida)
Cada passo usa `await`. Se algum falhar, o script **para** sem executar o seguinte.
1. Pré-checagem, só leitura. O script para sem escrever se qualquer item falhar:
   - o perfil 07668ecf tem `role=ENTERPRISE`, `enterprise_id` nulo e `white_label_nome='AGS Teste'`;
   - o usuário tem 0 propostas;
   - não existe proposta com `code='V3-CR-TESTE-AGS-0001'`;
   - `portfolio_linhas` tem "HOME EQUITY" ativo, com `documentos_pf` não vazio (em 27/11: 11 documentos, 10 obrigatórios);
   - pela `mesa_operacional_sla_config` atual, o warning de AVALIACAO_IMOVEL cai depois de 01/12.
2. Grava em `audit_logs`: user_id do ADMIN 75c6cac4…, action CREATE, entity credit_desk_proposals, new_data com a linha a inserir, motivo "BRIEF 2026-11-27_operacao-teste-ags-teste". Se a gravação falhar, para.
3. INSERT, com retorno da linha. O **id** gerado vai para o REGISTRO DE EXECUÇÃO deste BRIEF e para o ADENDO do BRIEF do master.
4. Releitura: o usuário de teste tem exatamente 1 proposta, com os valores acima.
5. 60 segundos depois, a checagem de efeitos (ver Triggers e webhooks).
6. Apaga o script e a env.

## REVERSÃO (apagar a proposta)
Pode rodar sozinha, a pedido do Hamilton, ou como passo 0 da reversão do master temporário. O go deste BRIEF autoriza a exclusão física desta linha fictícia, sem `deletion_status`. Mesmo assim, o agente confirma de novo com o Hamilton antes de rodar.

**Critério único**, o mesmo em todos os passos: `id = <id do REGISTRO>`, `code = 'V3-CR-TESTE-AGS-0001'`, `partner_id = '07668ecf-b524-4495-8bf2-ef18bb23db51'` e `metadata->>teste_ags = 'true'`.

Cada passo usa `await`. Se algum falhar, o script **para**.
1. SELECT com o critério único. Tem de devolver exatamente 1 linha, senão para.
2. A linha tem de estar intacta: `stage`, `status`, `documents`, `mesa_comments`, `checklist`, `pending_*`, `instituicao_*`, `approved_value`, `deletion_status` e as **chaves** de `metadata` iguais às da ida. Chave nova em metadata (avaliação, imóveis, cobrança, mandato etc.) também conta como mudança. Se algo mudou, para e lista.
3. Inventário. Se qualquer um dos itens abaixo trouxer algo, para e lista:
   - **Tabelas que apontam para a proposta:**
     - todas as colunas que o esquema da API (OpenAPI do PostgREST) marca como FK para `credit_desk_proposals.id`;
     - as colunas chamadas `proposal_id`, `proposta_id`, `credit_proposal_id` ou `credit_desk_proposal_id`, consultadas pelo id.

     Isso cobre ao menos `crm_leads`, `partner_service_orders`, `operation_contract_links`, `credit_consents`, `credit_documentos_assinatura`, `credit_upload_tokens`, `credit_upload_audit`, `credit_document_names`, `credit_proposal_envios`, `credit_proposal_pld`, `analise_link_opens`, `chat_messages` e as `partner_api_*`.
   - **Storage:** arquivos com o id ou o código no caminho. Primeiro nos buckets de documentos de crédito, depois nos demais.
   - **Falha fechada:** se o OpenAPI do PostgREST não responder, se alguma consulta der erro ou se a varredura de algum bucket falhar, a reversão **para**. Erro nunca conta como "nada encontrado".
   - **Notificações:** `notifications` que citem o id ou o código.
4. Grava em `audit_logs`: action DELETE, com old_data = a linha completa relida no passo 1 mais o resultado do inventário. Se a gravação falhar, para.
5. DELETE com o critério único, com retorno. Tem de devolver exatamente aquele id; se não, para e avisa. Como não há transação, a auditoria já gravada fica como registro da tentativa.
6. Confere que o usuário de teste voltou a ter 0 propostas e registra o resultado no REGISTRO DE EXECUÇÃO.

## ESTIMATE
S. 20 min. Confiança alta.

## PARECER DE COMPLIANCE
27/11/2026, Claude. Sem dado pessoal (nome fictício; CPF de sequência repetida, rejeitado pelo validador) e sem destinatário novo. Não há `[VALIDAR COM ROBSON]`.

## QA DE GOVERNANÇA
Rodada 1, 27/11/2026: BLOQUEADO, com 5 falhas, todas corrigidas nesta versão.
1. Exclusão definitiva: o efeito do DELETE sobre os dados ligados estava errado. Agora a reversão faz:
   - o inventário completo (FKs pelo esquema, colunas pelo nome, Storage e notificações);
   - a conferência de que a linha está intacta.

   Qualquer achado para a reversão.
2. Auditoria: o DELETE grava old_data completo e o inventário. Nos dois sentidos, a gravação usa await e o script para se ela falhar. O id entra no REGISTRO.
3. Critério único (id, code, partner_id e teste_ags), com SELECT de exatamente 1 linha antes e conferência do id devolvido depois. O texto se repete no ADENDO do BRIEF do master.
4. SLA e triggers:
   - a config de produção foi lida (vazia, então vale o padrão de 15 dias) e é relida na pré-checagem, que para se for preciso;
   - o limite de não listar triggers pela API está declarado, com a consulta opcional para o Hamilton e a checagem de efeitos depois do INSERT.
5. "Só olhar" estendido a esta proposta, com o texto do aviso à mesa. O BRIEF do master foi atualizado.

Sugestões aplicadas:
- nomes sem travessão;
- texto correto sobre o CPF;
- relatório "enviado em 01/12 (referência novembro)";
- o passo de apagar pode rodar sozinho;
- a pré-checagem confere o portfólio;
- o risco das cores da tarja está registrado.

Rodada 2, 27/11/2026: LIBERADO, sem bloqueantes. Sugestões aplicadas:
- o inventário falha fechado;
- os buckets de crédito são varridos primeiro;
- o ADENDO repete "abrir a proposta na Mesa de Crédito para agir".

A consulta em pg_trigger continua opcional e é recomendada ao Hamilton antes do go.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 2)
- Override: não
- Go dado por: (pendente)

## REGISTRO DE EXECUÇÃO
- Ida: 27/11/2026, às 09:45 de Brasília (12:45:15 UTC), depois do go do Hamilton.
  - Tentativa 1: parou na pré-checagem, sem escrever nada. A consulta do ADMIN usava `like` em coluna uuid; foi corrigida para o id exato.
  - Tentativa 2:
    - pré-checagem ok: perfil AGS Teste, 0 propostas, código livre, HOME EQUITY com documentos e config de SLA vazia (15 dias, warning em 08/12);
    - auditoria CREATE gravada antes, com o ADMIN 75c6cac4-8d30-436e-b9a6-d5d494d7470b;
    - INSERT ok e releitura ok: 1 proposta, AVALIACAO_IMOVEL, `teste_ags` = true.
- **id da proposta: `e09a6eec-81a8-468b-829d-7baa1028e018`** (code V3-CR-TESTE-AGS-0001).
- Checagem de efeitos 60 s depois: **nada**. Nenhuma notificação, execution_error, chat_message nem audit_log além do do agente, e nenhuma linha em tabela com FK ou coluna de proposta. A varredura não teve erros.
- A env e o script foram apagados.
- Exclusão: pendente, até 30/11/2026.
