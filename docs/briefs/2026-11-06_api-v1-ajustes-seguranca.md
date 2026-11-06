# BRIEF: Ajustes de segurança da API de Propostas (v1.1)

> Data: 2026-11-06 | Autor: Claude, a pedido do Hamilton | Status: QA LIBERADO (rodada 1), aguardando go
> Origem: revisão de segurança feita no chat em 06/11/2026, depois do deploy da v1 (PR #370). BRIEF anterior: `docs/briefs/2026-11-06_api-partner-propostas-credito.md`.

## SCOPE
Fechar os pontos de reforço achados na revisão de segurança da API v1:
1. **Chamada por `http://`**:
   - A Vercel redireciona para HTTPS antes de a plataforma ver a chamada, então a chave já viajou aberta. Não há como recusar no código.
   - A documentação passa a dizer isso com exatidão: "use sempre `https://`; chave enviada por `http://` deve ser tratada como vazada e revogada".
2. **Arquivo grande e arquivo esquecido**:
   - Na confirmação, o tamanho é conferido pelos dados do armazenamento **antes** de baixar o arquivo. Acima de 25 MB, o arquivo é apagado sem ser baixado.
   - Todo link de envio fica registrado. O cron apaga arquivos não confirmados em 24 horas.
   - Cada chave pode ter no máximo 50 envios pendentes ao mesmo tempo.
3. **Proposta em dobro em chamadas simultâneas**: a `Idempotency-Key` é reservada no banco **antes** de criar a proposta, com chave única. A segunda chamada igual recebe a proposta já criada ou, se a primeira ainda estiver em andamento, `409 em_processamento` com `Retry-After: 2`.
4. **Segredo próprio para o identificador de envio**:
   - A variável `API_V1_UPLOAD_SECRET` passa a ser obrigatória, sem cair na chave principal do banco.
   - Antes do deploy, o valor é gerado (48 bytes aleatórios) e gravado na Vercel. Sem a variável, as rotas de envio respondem 500 e não aceitam envio.
5. **Verificação de PDF mais forte**:
   - Além da busca no texto, o PDF é aberto com `pdf-lib`, que lê também as partes compactadas.
   - É recusado o PDF que tiver qualquer destes elementos: `/JS`, `/JavaScript`, `/Launch`, `/OpenAction` com ação, `/AA`, `/EmbeddedFile`, `/RichMedia` ou `/XFA`.
   - PDF com senha, ou que o `pdf-lib` não consegue abrir, também é recusado.
   - **DOC e DOCX**: o DOC antigo (`.doc`) pode trazer macro, então passa a ser recusado. DOCX com macro (`vbaProject.bin` dentro do zip) também é recusado.
6. **Alerta ativo**: o ADMIN recebe notificação na plataforma e e-mail quando:
   - um IP é bloqueado por tentativas com chave inválida;
   - uma chave válida é usada de um IP fora da lista, o que indica possível vazamento da chave;
   - uma chave passa de 80% do limite diário.

   Cada tipo de alerta é enviado no máximo uma vez por hora por chave ou IP, para não lotar a caixa.

7. **Documentação para o dev em PDF, sem abrir `/api`** (decisão do Hamilton em 06/11/2026: "cria um site que não tem risco então, ou pdf"):
   - O pedido de abrir `/api` em minúsculas foi **retirado**. Nada muda no `proxy.ts` nem no `next.config.ts`.
   - A documentação passa a existir também em **PDF**, gerado da mesma página, para o partner mandar ao dev por e-mail. Não depende de nenhuma rota da plataforma.
   - Arquivo: `docs/integracao/V3-Guia-API-Propostas.pdf`.
   - `/API` (maiúsculo, já no ar) continua: é um HTML estático, sem dado nem chamada ao banco.

**Fora do escopo:**
- **Antivírus nos arquivos:** fica para outro BRIEF. Precisa escolher o serviço (ver ALTERNATIVAS) e passar pelo Robson, porque os documentos dos clientes sairiam para um terceiro.
- **Teste de invasão externo:** decisão de contratação, fora do código.

## IMPACT
- **Arquivos alterados:**
  - `lib/api-v1/arquivos.ts`: análise de PDF com `pdf-lib`, DOCX com macro, recusa de DOC, segredo obrigatório.
  - `app/api/v1/propostas/route.ts`: reserva da `Idempotency-Key`.
  - `app/api/v1/propostas/[id]/documentos/upload-url/route.ts`: registro do envio e limite de 50 pendentes.
  - `app/api/v1/propostas/[id]/documentos/route.ts`: tamanho antes de baixar e baixa do pendente.
  - `lib/api-v1/auth.ts`: alertas de IP bloqueado, IP fora da lista e 80% do limite.
  - `app/api/cron/api-v1-manutencao/route.ts`: limpeza de envios não confirmados e de reservas antigas.
  - `lib/api-v1/http.ts`: códigos `em_processamento` e `limite_de_envios`.
  - Documentação: `docs/integracao/api-propostas-credito.html` e `public/integracao/api-propostas.html` (HTTPS, DOC, novos códigos).
  - `docs/integracao/V3-Guia-API-Propostas.pdf`: documentação em PDF.
- **Arquivo novo:** `lib/api-v1/alertas.ts`.
- **Tabelas novas:**
  - `partner_api_uploads`: `id`, `key_id`, `partner_id`, `proposal_id`, `storage_path` (único), `tipo_documento`, `criado_em`, `expira_em`, `confirmado_em`.
  - `partner_api_idempotencia`: chave primária (`key_id`, `idempotency_key`), `status` (`em_andamento` ou `concluida`), `proposal_id`, `criado_em`.
  - `partner_api_alertas`: `id`, `tipo`, `referencia` (IP ou `key_id`), `enviado_em`. Serve para não repetir o alerta dentro de 1 hora.
- **Tabelas existentes:** nenhuma alteração de estrutura.
- **Rotas:** as quatro rotas `v1` listadas e o cron.
- **APIs e integrações:** Supabase Storage (`list` ou `info` para ler o tamanho) e Resend, para o e-mail de alerta.
- **Variável de ambiente:** `API_V1_UPLOAD_SECRET` na Vercel, em produção.

## UX: ONDE O USUÁRIO VÊ ISSO
- **Dev do partner:**
  - Nova seção "Segurança" no passo a passo, em `app.v3partners.com.br/API`: só `https://`; chave usada por `http://` deve ser revogada; DOC não é aceito, use PDF ou DOCX sem macro.
  - Na tabela de erros, os códigos novos `em_processamento` (409) e `limite_de_envios` (429).
- **ADMIN:**
  - Notificação no sino da plataforma, com e-mail para o `EMAIL_ADMIN`.
  - Títulos: "API: IP bloqueado por tentativas com chave inválida", "API: chave usada de IP não autorizado (possível vazamento)" e "API: chave perto do limite diário".
  - O link da notificação abre `/admin-cadastros/chaves-api`.
- **Partner:** nenhuma tela muda. O e-mail de "chave usada de IP não autorizado" também vai para ele, com a orientação de revogar a chave se não reconhecer o IP.
- **Estado vazio:** sem mudança nas telas. Sem alerta, nada aparece.
- **Sem UI?** A limpeza de arquivos é do cron diário. O resultado aparece no retorno do cron (`uploads_apagados`).

## DEPENDENCIES
- **Deve existir antes:** a API v1 em produção (PR #370) e a migration `20261106a`, já aplicada.
- **Migration pendente:** `20261106b_partner_api_seguranca.sql`, com as 3 tabelas novas. Exige segundo go antes de aplicar.
- **Variável:** `API_V1_UPLOAD_SECRET` gravada na Vercel antes do deploy. Faço pelo CLI da Vercel depois do go, sem mostrar o valor no chat.
- **Uploads em andamento:** nenhum partner tem chave hoje. A troca do segredo não invalida nenhum envio em curso.

## RISKS (nunca "nenhum")
- **Breaking change:**
  - Arquivo `.doc` passa a ser recusado (415). Hoje nenhum partner usa a API, então ninguém é afetado; a documentação avisa.
  - PDF legítimo com formulário XFA ou anexo embutido também passa a ser recusado. O dev é orientado a "imprimir como PDF" para achatar o arquivo.
- **Falso positivo:** PDF gerado por alguns programas traz `/OpenAction` só para abrir na página 1. Só será recusado o `/OpenAction` que tiver ação de script, link ou lançamento; o que só aponta para uma página passa. Os testes cobrem os dois casos.
- **Performance:** o `pdf-lib` carrega o PDF inteiro, até 25 MB, na memória da função. Com `maxDuration` de 60 segundos e o limite de 25 MB, fica dentro do aceitável. Se a carga falhar por tempo, o envio é recusado, nunca aceito sem análise.
- **Vercel timeout:** nada chama o Claude.
- **Alertas em excesso:** limitados a um por tipo, por hora, por chave ou IP.
- **LGPD/Compliance:** o e-mail de alerta leva só o IP, o prefixo da chave e o nome do partner, sem dado de cliente. O antivírus, que envolve terceiro, fica fora deste BRIEF.
- **Segredo na Vercel:** se for gravado errado, os envios falham (500) até a correção. Nenhum envio passa sem assinatura.
- **Corrida na reserva da `Idempotency-Key`:** se a criação falhar no meio, a reserva fica `em_andamento`. Ela é liberada em 2 minutos, e o cron apaga reservas sem proposta.

## APPROACH
- **Abordagem:** tudo no servidor da plataforma, com tabelas pequenas de controle, que dão unicidade e trilha de auditoria. A análise de PDF usa a biblioteca `pdf-lib`, que já está no projeto.
- **Alternativa descartada 1:** limpar arquivos esquecidos varrendo o bucket inteiro. É lento, custa caro e não diferencia arquivo da API de arquivo do modal.
- **Alternativa descartada 2:** idempotência com trava em memória. A Vercel roda várias instâncias, e a trava em memória não vale entre elas.
- **Alternativa descartada 3:** aceitar `.doc` e confiar no futuro antivírus. Enquanto ele não existe, o risco de macro é real.

**Antivírus (decisão para o próximo BRIEF):**
- **(a) ClamAV próprio** num serviço da Railway. Os arquivos não saem da infraestrutura da V3; custo mensal baixo; precisa de manutenção da base de vírus.
- **(b) Serviço pago**, como Cloudmersive. Os documentos dos clientes vão a um terceiro, o que exige o Robson.
- **(c) VirusTotal:** descartado, porque compartilha os arquivos com terceiros.

## ESTIMATE
- Complexidade: M
- Esforço: 5 a 7 horas, com testes.
- Confiança: Alta. São ajustes em código que acabou de ser escrito e testado.

## PLANO DE TESTE
- **Unitários:**
  - PDF com `/JavaScript` dentro de parte compactada é recusado.
  - PDF com `/OpenAction` só de página passa; com `/OpenAction` de script, é recusado.
  - PDF com `/EmbeddedFile` é recusado.
  - DOCX com `vbaProject.bin` e qualquer `.doc` são recusados.
  - A reserva da `Idempotency-Key`: a segunda chamada simultânea recebe 409 ou a mesma proposta, nunca uma segunda.
  - O limite de 50 envios pendentes.
  - O tamanho é conferido antes do download.
  - Sem `API_V1_UPLOAD_SECRET`, a assinatura falha.
  - O alerta não se repete dentro de 1 hora.
- **Acesso ao banco (6.8):** repetir o script de teste em transação abortada, incluindo as 3 tabelas novas: anon negado; partner A e B negados.
- **Produção, demais itens:** com uma chave de teste, enviar um PDF normal (aceito) e um PDF com script (recusado). Conferir o alerta de IP não autorizado chamando de outro IP. Conferir que o cron apaga um envio não confirmado.

## PARECER DE COMPLIANCE
Sem dado pessoal novo. Os alertas levam IP, prefixo da chave e nome do partner, que a V3 já trata no log de chamadas (Termo v2.1, cláusula 9.1). O antivírus, que envia documento a terceiro, fica fora deste BRIEF e terá `[VALIDAR COM ROBSON]` próprio. Parecer: dispensado neste escopo, registrado por Claude em 06/11/2026.

## RELATÓRIO DO QA DE GOVERNANÇA

### Rodada 1 (06/11/2026)
```
RELATÓRIO DE QA DE GOVERNANÇA
Material analisado: docs/briefs/2026-11-06_api-v1-ajustes-seguranca.md

PASSOU
- 3.3: nenhuma ação irreversível nova na tela. A limpeza de envios não confirmados é automática e só apaga arquivo não registrado em proposta.
- 4.1: nenhuma lista nova na tela; os alertas entram no sino, que já tem ordem cronológica.
- 5.1: textos de alerta e de documentação sem travessão e sem emoji.
- 6.1 e 6.2: as 3 tabelas novas seguem a regra da v1 (RLS ligada, revoke de anon e authenticated, nenhuma política); plano de teste 6.8 cobre as 3.
- 6.6: o segredo novo fica só em variável de servidor, nunca em NEXT_PUBLIC_*.
- 6.7: o bucket continua privado; a limpeza reduz arquivo órfão.
- Item 7: PDF estático, sem mudança de acesso (o pedido de abrir /api foi retirado pelo Hamilton).
- LGPD: sem dado pessoal novo; o antivírus com terceiro fica fora, com [VALIDAR COM ROBSON] próprio.

FALHOU (BLOQUEANTE)
- nenhum

SUGESTÃO DE UX
- Na notificação de "chave usada de IP não autorizado", incluir um botão para revogar a chave direto da notificação.

NÃO SE APLICA
- 1.1 a 1.5: sem campo financeiro, documento de pessoa, telefone ou data novos.
- 2.1 a 2.4 e 3.4: sem contrato.
- 3.1 e 3.2: sem dado mascarado ou revelação nova.
- 6.3 e 6.4: sem view nem função nova.

VEREDITO: LIBERADO PARA "GO"
```

## REGISTRO DE LIBERAÇÃO
`[PENDENTE]`

## NOTAS DE IMPLEMENTAÇÃO (06/11/2026)

Go do Hamilton em 06/11/2026: "go BRIEF 2026-11-06_api-v1-ajustes-seguranca". Branch `feat/api-v1-seguranca`.

- **Item 7 trocado** a pedido do Hamilton: em vez de abrir `/api`, documentação em PDF (`docs/integracao/V3-Guia-API-Propostas.pdf`, 14 páginas, modelo premium V3: capa com logo, sumário, páginas navy com ouro, cabeçalho e rodapé, contracapa; gerado por `scripts/gera-pdf-api-propostas.js`). Sem mudança em `proxy.ts` nem `next.config.ts`.
- **Análise de PDF:**
  - Recusa as chaves `/JS`, `/JavaScript`, `/Launch`, `/EmbeddedFile(s)`, `/RichMedia`, `/XFA`, `/AA`, `/SubmitForm`, `/ImportData`, `/GoToR` e `/GoToE`.
  - Recusa também as ações desses tipos e o `/OpenAction` que não seja `/GoTo`.
  - **Link comum (`/URI`) não é recusado**: extratos e boletos trazem links, e recusar daria falso positivo demais.
  - PDF sem página, como arquivo corrompido aberto vazio pelo `pdf-lib`, é recusado.
- **Segredo:** `API_V1_UPLOAD_SECRET` gravado na Vercel (produção) em 06/11/2026, com 64 caracteres gerados localmente e enviados direto ao CLI, sem passar pelo chat.
- **Testes:** `tests/unit/api-v1-seguranca.test.ts`, 9 testes, com PDF real gerado no teste (JavaScript dentro de object stream, anexo embutido, OpenAction de página). Suíte inteira: 334 de 334. Tipos sem erro.
- **Teste de acesso das 3 tabelas:** `docs/briefs/anexos/2026-11-06_teste-acesso-api-seguranca.sql`, rodado pelo Hamilton no SQL Editor em 06/11/2026: 8 de 8 conforme o esperado. anon e partner logado são negados em leitura das 3 tabelas e em inserção.
- **Ordem do deploy:** aplicar a migration `20261106b` **antes** do merge. O código novo grava em `partner_api_uploads` e `partner_api_idempotencia`; sem as tabelas, o envio de documento e a criação de proposta pela API respondem 500. Hoje nenhum partner tem chave, então o risco da janela é baixo.
- **Migration 20261106b aplicada** pelo Hamilton no SQL Editor em 06/11/2026 ("Success. No rows returned"), depois do teste de acesso 8 de 8. O segundo go por escrito ("go migration ...") não foi digitado no chat: a aplicação foi feita diretamente pelo Hamilton, admin do projeto. Conferência pela API REST de produção: as 3 tabelas existem; anon recebe 401 (42501) em todas.
