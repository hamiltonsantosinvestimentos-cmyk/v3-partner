# BRIEF: Identidade do Enterprise, fase 1. Chat da Mesa, Minhas operações e PDFs dos simuladores

> Data: 2026-11-23 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO pelo QA na rodada 3; aguardando go
> Fase 1 do BRIEF `2026-11-19_identidade-enterprise-documentos-gerados.md` (que segue valendo para as fases 2 e 3: crédito, M&A, IA, listas e e-mails). Este BRIEF traz da fase 1 só a base (identidade jurídica no perfil) e os simuladores, e acrescenta as duas telas pedidas hoje.

## PEDIDO DO HAMILTON (23/11/2026, no chat, depois de entrar com o usuário de teste da AGS)
"no chat da mesa, deve aparecer AGS e nao v3 as informaçoes todas ags, nas minhas operações deve aparecer tambem so que tudo com o nome de AGS, e outro ponto, nos pdf gerado como simulador por exemplo, deve aparecer a logo da AGS e informaçoes da AGS"

Regra permanente (19/11): tudo o que o login Enterprise gera ou exporta sai com logo, marca, CNPJ e razão social do cliente. Contratos, cobranças em que a V3 recebe e comprovante de comissão seguem V3.

## SITUAÇÃO HOJE (levantamento no código, 23/11)
- **Chat da Mesa** (o partner conversa com a Mesa Operacional):
  - `app/(platform)/chat/page.tsx:41,45`: "Chat com a Mesa V3", "Converse diretamente com a equipe operacional V3 Partners".
  - `components/chat/chat-client.tsx:439,443`: título "Mesa V3" e "Chat direto com a equipe V3 · respondemos em horário comercial" (visão do partner).
  - `components/chat/chat-float-widget.tsx:263`: "Mesa V3 Partners".
  - `lib/chat-partners.ts:100,113`: avisos automáticos gravados com `sender_name: "Mesa V3 · aviso automático"`.
  - `app/api/chat/messages/route.ts:133,136`: notificação in-app "Nova mensagem da Mesa V3" e e-mail `notifyChatMensagemPartner` ("Você recebeu uma nova mensagem da equipe V3 Partners", `lib/email.ts:1326`).
  - `app/api/chat/assumir/route.ts:15` e `app/api/chat/notas/route.ts:31`: fallback "Mesa V3" para nome de quem atende/anota (lado interno, o partner não vê as notas).
- **Minhas operações** (`components/minhas-operacoes/minhas-operacoes-client.tsx`): aba Portfólio com o título "Portfólio V3 Partners 2026" (linha 390) e o `PortfolioViewer` (`components/portfolio/portfolio-viewer.tsx`), que mostra "PORTFÓLIO V3 PARTNERS 2026" (linha 598) e gera o PDF de checklist com `/logo.jpg`, "CHECKLIST DE DOCUMENTOS — V3 PARTNERS 2026" e "Documento de uso interno — V3 Partners Soluções Ltda" (linhas 82-107, 220).
- **Simuladores** (impressão em PDF pelo navegador): `components/simulador/cash-client.tsx:96,114,316`, `homecash-client.tsx:167,186,242,535`, `home-equity-client.tsx:242,281,385-386,696`: título, cabeçalho, rodapé "V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br" e "Consulte um assessor V3 Partners". O simulador público (`home-equity-publico-client.tsx`) fica fora: não tem login.
- `lib/enterprise.ts` conhece só `nome`, `logoUrl` e `tema`. Razão social e CNPJ do cliente existem só em `partner_registrations` (`razao_social`, `cnpj`), ligada ao master pelo e-mail.

## SCOPE
1. **Identidade jurídica no perfil do master**: colunas `white_label_razao_social text` e `white_label_cnpj text` (nullable) em `profiles`.
   - **Formato canônico do CNPJ gravado**: 14 caracteres, sem pontuação (`[^0-9A-Za-z]` removido) e em maiúsculas (aceita o CNPJ alfanumérico). A máscara `XX.XXX.XXX/XXXX-XX` (`formatCNPJ` de `lib/validators/cpf-cnpj.ts`) só na exibição e na impressão. Razão social: `trim`, espaços repetidos reduzidos, até 200 caracteres.
   - **Preenchimento inicial** por UPDATE na migration, só para `profiles` com `role = 'ENTERPRISE'` e `enterprise_id is null` (masters), a partir de `partner_registrations` com `lower(email)` igual, `status = 'APROVADO'` e `plano = 'ENTERPRISE'` (`APROVADO` em `app/api/cadastro-partner/aprovar/route.ts:213,317`; `ENTERPRISE` no CHECK de `partner_registrations.plano` e no mapeamento da linha 229). Havendo mais de um cadastro aprovado com o mesmo e-mail, usa o mais recente (`created_at` desc, `limit 1`). O CNPJ é normalizado e só é copiado se tiver 14 caracteres e dígito verificador válido (validação de dígito numa função **`pg_temp.cnpj_valido(text)`**, criada na própria migration em `pg_temp` e sempre chamada qualificada (`pg_temp.cnpj_valido(...)`): existe só durante a sessão que roda a migration, some sozinha no fim, não fica objeto em `public` nem executável por `anon`; mesma regra de `isValidCNPJ`, inclusive alfanumérico: valor de cada caractere = código ASCII − 48); senão fica NULL e a aba Marca mostra o aviso. Razão social copiada só se não vazia.    - Editáveis na aba Marca do `/enterprise` pelo master e pelo ADMIN no modo ADMIN (mesmo caminho de `POST /api/enterprise/marca`, com `logAuditStrict` antes de gravar, como já faz o tema). **A rota valida no servidor**: normaliza, exige 14 caracteres e `isValidCNPJ` (senão 400 "CNPJ inválido."), e grava o formato canônico; a tela também valida, mas quem decide é a rota.
   - **Leitura no banco**: as colunas seguem as políticas que já existem em `profiles` (`profiles_select_own` e `profiles_select_admin`, levantadas no BRIEF 2026-11-20_rls-crm-insert-e-profiles-update-own.md): cada login lê só a própria linha; ADMIN lê todas. Nenhuma view das migrations lê `profiles` (conferido 23/11: a única view que aparece no grep, `v3_client_risk_trajectory`, lê `credit_profiles`). Escrita direta bloqueada pelo trigger `profiles_trava_colunas_sensiveis` (lista fechada; só ADMIN e service role).
2. **`IdentidadeEnterprise`** em `lib/enterprise.ts`: `{ nome, logoUrl, razaoSocial, cnpj, site }` (site = domínio próprio quando `white_label_dominio_status = 'ativo'`, senão nulo). Função `identidadeDoPerfil(db, perfilId)`: master ou usuário da equipe devolvem a do master; os demais devolvem `null` (fica V3). Rota `GET /api/enterprise/identidade`: sessão obrigatória; descobre o master a partir do perfil da sessão (`contextoEnterprise`) e lê a linha do master **com o cliente de serviço no servidor**, porque o usuário da equipe não lê a linha do master pela RLS; devolve só `{ nome, logoUrl, logoClaroUrl, razaoSocial, cnpj (mascarado), site }` do próprio Enterprise, nunca recebe id de outro por parâmetro.
3. **Chat da Mesa**, só na visão de quem é do Enterprise (master ou equipe):
   - Página, título e subtítulo do chat e do widget flutuante: "Chat com a Mesa {marca}", "Converse diretamente com a equipe operacional {marca}", "Mesa {marca}", "Chat direto com a equipe {marca} · respondemos em horário comercial".
   - Avisos automáticos: `sender_name` "Mesa {marca} · aviso automático" quando a sala é de um partner do Enterprise (gravado assim; mensagens antigas ficam como estão).
   - Na exibição para o partner do Enterprise, qualquer `sender_name` que comece com "Mesa V3" aparece com "Mesa {marca}" (cobre as mensagens antigas sem reescrever o banco).
   - Notificação in-app "Nova mensagem da Mesa {marca}" e e-mail com "equipe {marca}" no texto (o e-mail já troca o logo por `aplicarMarca`). Remetente (`EMAIL_FROM`) e rodapé do e-mail continuam V3 nesta fase: ficam para a fase 3 (e-mails) e para o BRIEF do domínio da AGS.
   - Nome da pessoa da Mesa que responde: continua o nome dela (não é marca).
   - Lado interno (ADMIN/Mesa) não muda: a lista de salas e a conversa vistas pela Mesa continuam como hoje.
4. **Minhas operações**, só para o Enterprise: título "Portfólio {marca} {ano}" na aba e no `PortfolioViewer`; o PDF de checklist sai com o logo claro do Enterprise (`white_label_tema.logo_claro_url`, porque o PDF é de fundo branco; o jsPDF recebe o logo convertido em PNG num canvas do navegador; sem logo claro, ou se a conversão falhar, só o nome em texto), título "CHECKLIST DE DOCUMENTOS · {MARCA} {ano}" e rodapé "{razão social} · CNPJ {cnpj}" (sem razão social/CNPJ: "{marca}"). Sem menção à V3.
5. **Simuladores** (Cash, HomeCash, Home Equity, dentro da plataforma), só para o Enterprise: título do documento "Simulação {linha} · {marca}" (sem travessão), cabeçalho com o logo claro do Enterprise (fundo branco; sem logo claro, o nome em texto) e "{linha} · {marca}" no lugar de "... — V3 Partners"; rodapé "{razão social} · CNPJ {cnpj} · {site}" (sem site: omite), "Esta simulação foi gerada pela plataforma {marca}", **mantendo o resto dos avisos legais de hoje** (ex.: `home-equity-client.tsx:386`, "Não constitui proposta formal de crédito. O crédito ainda será analisado. Esta simulação não constitui aprovação de crédito.", e os equivalentes do Cash e do HomeCash, sem cortar nada) e, na tela e no PDF, "Consulte um assessor {marca} para proposta formal.". Dados do Enterprise no topo; no fim, em letra pequena, "Simulação técnica fornecida pela V3 Partners." (ver DECISÃO). Nenhuma outra menção à V3.
   - Marca, razão social e site entram no HTML impresso (`win.document.write`) sempre escapados com `escapeHtml` de `lib/html-escape.ts`; o logo entra só como URL do bucket `white-label` em atributo escapado.
6. Fora do Enterprise nada muda: o helper devolve `null` e cada tela usa os textos de hoje.

## DECISÃO DO HAMILTON (23/11/2026, no chat)
Texto: "deve ter o logo e informaçoes da ags acima, e bem abaixo, letras pequenas deve mencionar analise tecnica ou simulador fornecida pela V3 PARTNERS".
Aplicação nos PDFs dos 3 simuladores do Enterprise: logo e dados da AGS no topo (logo, marca, razão social, CNPJ); no fim da última página, em letra pequena (8 px, cor do texto secundário), a linha **"Simulação técnica fornecida pela V3 Partners."**. É a única menção à V3 no documento. Mesmo padrão do parecer do Robson para a análise de crédito ("Análise técnica fornecida pela V3 Partners", fases 2 e 3).
O PDF de checklist de Minhas operações não é simulação nem análise: sai só com a AGS, sem a linha.

## IMPACT
- Arquivos: `lib/enterprise.ts`, `app/api/enterprise/identidade/route.ts` (novo), `app/api/enterprise/marca/route.ts`, `components/enterprise/enterprise-client.tsx` (aba Marca: 2 campos), `app/(platform)/chat/page.tsx`, `components/chat/chat-client.tsx`, `components/chat/chat-float-widget.tsx`, `lib/chat-partners.ts`, `app/api/chat/messages/route.ts`, `lib/email.ts` (`notifyChatMensagemPartner`: parâmetro de marca), `components/minhas-operacoes/minhas-operacoes-client.tsx`, `components/portfolio/portfolio-viewer.tsx`, `components/simulador/{cash,homecash,home-equity}-client.tsx`.
- Tabela: `profiles` (+2 colunas nullable, UPDATE de preenchimento). Migration `supabase/migrations/20261123b_white_label_identidade_juridica.sql` + `_rollback.sql.txt` (drop das 2 colunas).
- Rotas: `GET /api/enterprise/identidade` (nova), `POST /api/enterprise/marca` (aceita `razao_social`, `cnpj`).

## UX: ONDE O USUÁRIO VÊ ISSO
- Usuário da AGS, menu **Chat**: cabeçalho "Chat com a Mesa AGS Finance"; na conversa, "Mesa AGS Finance"; avisos automáticos "Mesa AGS Finance · aviso automático"; widget flutuante "Mesa AGS Finance"; notificação "Nova mensagem da Mesa AGS Finance". Estado vazio: o que existe hoje, com a marca no lugar de V3.
- Usuário da AGS, **Minhas operações › Portfólio**: "Portfólio AGS Finance 2026"; botão de checklist gera PDF com logo e dados da AGS.
- Usuário da AGS, **Simuladores**: botão de imprimir/PDF gera o documento com logo, razão social e CNPJ da AGS no topo e, no fim, em letra pequena, "Simulação técnica fornecida pela V3 Partners."; texto da tela "Consulte um assessor AGS Finance".
- Master e ADMIN (modo ADMIN), **/enterprise › aba Marca**: campos "Razão social" e "CNPJ" (máscara de CNPJ, aceita o CNPJ alfanumérico novo, dígitos validados com `lib/validators/cpf-cnpj.ts`), já preenchidos pelo cadastro; texto de apoio "Aparecem nos PDFs e simulações gerados pela sua equipe."; sem os dois preenchidos, aviso "Preencha razão social e CNPJ para saírem nos documentos." e os documentos usam só a marca.
- Partners da V3 e equipe interna: nada muda.

## DEPENDENCIES
- Tema e marca do Enterprise (PRs #415, #416) no ar. Logo claro da AGS configurado em `white_label_tema.logo_claro_url`: os PDFs (fundo branco) usam esse; as telas (fundo escuro) usam `white_label_logo_url`.
- Decisão do Hamilton sobre a menção à V3 no simulador: tomada em 23/11 (ver DECISÃO).
- Migration com segundo go antes de aplicar.

## RISKS
- Seção 6 (banco): 2 colunas novas em `profiles`. Conferido em 23/11: nenhuma view das migrations lê `profiles`; o trigger `profiles_trava_colunas_sensiveis` tem lista fechada e já bloqueia as colunas novas para quem não é ADMIN nem service role. Sem policy, GRANT, view ou função persistente nova (a função de validação é `pg_temp`, temporária).
- Dado: CNPJ e razão social são dados de empresa; o campo aceita só CNPJ (Enterprise é PJ).
- Identidade errada: a rota de identidade devolve só a do Enterprise da sessão; teste de que usuário de um Enterprise não recebe a de outro.
- Mensagens antigas do chat: não são reescritas no banco; a troca é na exibição.
- Regressão para a V3: sem Enterprise o helper devolve `null` e os textos atuais ficam; teste com login de partner V3.
- Preenchimento inicial por e-mail pode não achar o cadastro (e-mail diferente): campos ficam vazios e o aviso da aba Marca aparece.
- Performance: uma consulta a mais por tela (identidade em cache por sessão no client).

## APPROACH
- Escolhida: identidade gravada no perfil do master + rota de identidade + troca de texto na exibição para o Enterprise; PDFs dos simuladores montados com a identidade.
- Descartada: ler `partner_registrations` a cada geração (frágil se o e-mail mudar; sem lugar para corrigir os dados). Descartada também: reescrever `sender_name` das mensagens antigas no banco (altera histórico).

## PLANO DE TESTE
- Login do usuário de teste da AGS: chat (página, conversa, widget, aviso automático novo e antigo, notificação), Minhas operações (título, PDF de checklist), os 3 simuladores (tela e PDF): AGS no topo e a única menção à V3 é a linha pequena do fim; nas outras telas, nenhuma "V3".
- Login de partner V3: as mesmas telas exatamente como hoje (print antes/depois).
- `GET /api/enterprise/identidade`: sem sessão 401; partner V3 `null`; usuário AGS a da AGS.
- Aba Marca: CNPJ inválido recusado; alfanumérico válido aceito; master edita pela rota; edição direta pela REST bloqueada pelo trigger (42501).
- Migration, antes de aplicar, no SQL Editor em `begin ... rollback` (nada fica gravado):
  - aplicar o DDL e o UPDATE e conferir a linha do master da AGS (razão social e CNPJ canônico, ou NULL com motivo);
  - (a) `set local role anon` + `select white_label_cnpj, white_label_razao_social from public.profiles` → 0 linhas;
  - (b) `set local role authenticated` + `request.jwt.claims` de um partner V3 → só a própria linha, sem a do master da AGS;
  - (c) mesmo com o `sub` do usuário de teste da AGS (07668ecf-b524-4495-8bf2-ef18bb23db51) → não lê a linha do master;
  - (d) com o `sub` de um ADMIN → lê;
  - (e) UPDATE de `white_label_cnpj` pelo master com JWT dele → 42501 (trigger);
  - `pg_temp.cnpj_valido` com um CNPJ numérico válido, um alfanumérico válido (exemplo `12.ABC.345/01DE-35` de `tests/unit/cnpj-alfanumerico.test.ts`) e um inválido: resultados iguais aos de `isValidCNPJ`;
  - consulta da seção 6 do QA ("tabelas que anon consegue ler") rodada e colada aqui;
  - `reset role` entre um caso e outro e antes do `rollback`;
  - `rollback;` e conferir que as colunas não existem.
- Logo PNG e logo SVG no teste do checklist e dos simuladores (conversão ou nome em texto).
- Visão da Mesa (ADMIN) do chat da AGS com print: igual a hoje.
- PDF do simulador pronto lido inteiro: "gerada pela plataforma {marca}" e "Simulação técnica fornecida pela V3 Partners." não soam contraditórias; avisos legais presentes.

## ESTIMATE
M. Cerca de 4 a 6 horas. Confiança média (três simuladores com HTML próprio).

## PARECER DE COMPLIANCE
- Parecer existente (Robson, 19/11, repassado pelo Hamilton): análise de crédito do Enterprise sai com marca e CNPJ do Enterprise e "Análise técnica fornecida pela V3 Partners". Este BRIEF não gera análise de crédito.
- Simulador: decisão do Hamilton de 23/11 aplica ao simulador o mesmo padrão do parecer do Robson (marca e CNPJ do Enterprise + "Simulação técnica fornecida pela V3 Partners." em letra pequena). Recomendado o Robson confirmar por escrito, junto com a confirmação do parecer de 19/11; não bloqueia, porque segue o padrão já aprovado por ele.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (23/11): BLOQUEADO, 5 falhas: (1) [1.3] CNPJ sem formato canônico e preenchimento sem validação → formato de 14 caracteres, máscara só na exibição, UPDATE com filtro exato (APROVADO/ENTERPRISE, mais recente) e dígito validado, validação no servidor; (2) [5.1] travessão em título → "·" em checklist e simuladores; (3) [6.5] leitura por papel → políticas existentes declaradas, rota lê o master com cliente de serviço, views conferidas; (4) [6.8] teste de acesso → transação desfeita com anon, partner, equipe AGS, ADMIN e trigger; (5) decisão do simulador e Robson → decisão do Hamilton registrada (23/11, depois de o QA começar), Robson tratado no PARECER. Sugestões aplicadas: logo claro em fundo branco com conversão para PNG, escapeHtml no HTML impresso, remetente do e-mail fica para a fase 3.

Rodada 2 de 6 (23/11): BLOQUEADO, 1 falha: [6.1/6.4] validação SQL do CNPJ sem dizer se cria função → `pg_temp.cnpj_valido`, temporária, com teste de equivalência com `isValidCNPJ`. Compliance do simulador: resolvido sem bloqueio (a linha "Simulação técnica fornecida pela V3 Partners." fecha a lacuna da rodada 1; extensão do parecer feita pelo Hamilton; confirmação escrita do Robson recomendada). Sugestões aplicadas: avisos legais mantidos, RISKS e cabeçalho atualizados, citação de linhas corrigida, leitura do PDF pronto no teste.

Rodada 3 de 6 (23/11): LIBERADO, zero falhas. Sugestões aplicadas: referência do exemplo alfanumérico, quebra de linha, `reset role` entre casos, chamada qualificada da função pg_temp. Confirmação escrita do Robson recomendada, sem bloquear.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO na rodada 3 de 6 (23/11/2026)
- Go: "go" do Hamilton em 23/11/2026, capturado pelo gate (válido até 24/11 00:08 UTC)
- Migration aplicada em produção: sim, pelo Hamilton no SQL Editor em 23/11/2026 (segundo go = ele rodou o arquivo), "Success. No rows returned"

## NOTA DE IMPLEMENTAÇÃO (23/11/2026)
- PDF de checklist (Minhas operações): o cabeçalho desse PDF é escuro (faixa navy), não branco como o BRIEF supôs. Por isso ele usa o logo para fundo escuro (`white_label_logo_url`), convertido em PNG num canvas; sem logo, o nome em texto. Os simuladores (fundo branco) usam o logo claro, como previsto.
- O código funciona antes da migration: a identidade é lida de forma tolerante e, sem as colunas, sai só com a marca.

## TESTE DA MIGRATION ANTES DE APLICAR (23/11/2026)
Rodado pelo Hamilton no SQL Editor de produção (`teste-migration-identidade-ags.sql`): migration inteira + testes num bloco que termina com erro proposital (tudo desfeito). Resultado:
- Masters preenchidos: 1. AGS: razão social "AGS AGRONEGÓCIOS SUSTENTÁVEIS S.A.", CNPJ 33735094000104 (igual ao cadastro aprovado).
- `pg_temp.cnpj_valido`: numérico válido true, alfanumérico válido true, inválido false (igual a `isValidCNPJ`).
- (a) anon lê profiles: 0. (b) partner V3 lê o master AGS: 0. (c) usuário da equipe AGS lê o master: 0. (d) ADMIN lê: 1. (e) UPDATE do master no CNPJ: bloqueado, 42501.
- Tabelas com GRANT de leitura para anon: 183 (todas dependem de RLS; profiles com RLS ligada). Fica registrado para o BRIEF de RLS por dono.
Tudo como esperado. Aplicação real: segundo go do Hamilton.
- Conferência depois de aplicar (identidadeDoPerfil, leitura): usuário de teste AGS recebe nome "AGS Finance", razão social "AGS AGRONEGÓCIOS SUSTENTÁVEIS S.A.", CNPJ 33.735.094/0001-04; partner V3 recebe null. A AGS não tem logo para fundo claro: os PDFs dos simuladores saem com o nome em texto até o upload do logo claro na aba Cores.
