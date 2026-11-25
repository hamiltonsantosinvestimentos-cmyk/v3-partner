# BRIEF: E-mails para a equipe do Enterprise saem com o remetente dele

> Data: 2026-11-25 | Autor: Claude (pedido do Hamilton) | Status: GO MESMO ASSIM (pendente de captura)
> Salvar em `docs/briefs/2026-11-25_emails-remetente-enterprise.md` e commitar junto com o código.

## SCOPE
Pedido do Hamilton em 25/11/2026 ("continuar com o white label" → opção "E-mails saindo pela AGS"). Decisão já registrada em 21/11/2026: os e-mails de aviso passariam a sair com o nome da AGS depois que o domínio dela existisse. O domínio `agsfinance.app` foi criado em 24/11.

Hoje todo e-mail da plataforma sai de `EMAIL_FROM` = "V3 Partners <noreply@v3partners.com.br>". Isso vale também quando quem recebe é da equipe de um Enterprise. O ponto único de envio, `send()` em `lib/email.ts`, já troca o logo da V3 pelo do Enterprise (`marcaPorEmail` + `aplicarMarca`). Só o remetente continua V3.

Mudança: quando o destinatário é um usuário Enterprise (master ou equipe) e o domínio próprio do master está **verificado no Resend**, o e-mail sai como `"{nome da marca}" <naoresponda@{domínio}>`, por exemplo "AGS Finance <naoresponda@agsfinance.app>". Nos demais casos fica `EMAIL_FROM`, como hoje. A regra vale para qualquer Enterprise que tiver domínio próprio verificado.

**Texto (decisão do Hamilton em 25/11/2026, "Trocar por AGS"):** quando o remetente é o do Enterprise, as frases institucionais do e-mail que dizem "V3 Partners" passam a dizer o nome da marca, e o rodapé vira "{marca} · Powered by V3 Partners". A troca segue uma lista fechada de trechos, e não um "substituir tudo". Os trechos em que a V3 é **parte de contrato** continuam V3, pela decisão de 19/11 de que contratos mantêm a V3: contra-assinatura, "Contratada — V3 Partners", "Assinar como V3 Partners", "Assinado pela V3 Partners" e os assuntos "… — V3 Partners · {código}" de contrato e assinatura. Trechos trocados:
- rodapé `V3 Partners · Plataforma Financeira` → `{marca} · Powered by V3 Partners`;
- `Bem-vindo à V3 Partners` / `Bem-vindo(a) à V3 Partners` → `Bem-vindo à {marca}`;
- `seu perfil na V3 Partners` e `na V3 Partners está ativa` → `na {marca}`;
- `Seu contrato de parceria com a V3 Partners` não muda, porque é contrato.

Infraestrutura (fora do código, feita com autorização expressa do Hamilton no chat em 25/11/2026: "pode cadastrar e criar os registros"). **Concluída em 25/11/2026:** domínio `agsfinance.app` cadastrado no Resend (id 3744b284-e6b5-437d-bb7b-f1bcca76d073, sa-east-1) e 4 registros criados no DNS da Vercel (TXT `resend._domainkey`, MX e TXT `send`, CNAME `rsend`). Status no Resend: **verified**. A `RESEND_API_KEY` de produção leu `GET /domains` sem erro, então tem permissão de leitura. O DMARC `p=none` foi oferecido e o Hamilton respondeu "Não agora". Passos executados:
1. Cadastrar `agsfinance.app` no Resend, na mesma região do domínio da V3 (sa-east-1).
2. Criar na Vercel (o DNS de `agsfinance.app` está lá) os registros que o Resend indicar: DKIM (`resend._domainkey`, TXT) e o MX e o SPF do subdomínio de retorno (`send`). Nada muda em `agsfinance.app` raiz, porque o domínio não recebe e-mail hoje.
3. Pedir a verificação no Resend e esperar o status `verified`.

## IMPACT
- Arquivos afetados:
  - `lib/email-remetente.ts` (novo, `server-only`), com duas funções:
    - `dominiosVerificadosResend()`: lê `GET https://api.resend.com/domains` com a `RESEND_API_KEY` e guarda em memória por 10 minutos o conjunto dos domínios com `status = verified`;
    - `remetentePara(email)`: procura o perfil do destinatário, por e-mail em minúsculas com os curingas `%` e `_` escapados (sugestão do QA). Se for ENTERPRISE, lê `white_label_dominio`, `white_label_dominio_status`, `white_label_nome` e `full_name` do master. O remetente da marca só é usado com **status `ativo`** e com o domínio **exatamente igual** a um domínio verificado no Resend. Um subdomínio de plataforma (plataforma.cliente.com.br) não casa com a raiz verificada; isso é intencional, porque cada Enterprise novo terá o domínio de envio cadastrado igual ao `white_label_dominio`. Senão, devolve `null`.
    - Cache negativo: falha ou resposta não ok (401/429) guarda o conjunto vazio por 2 minutos, para não repetir a chamada a cada e-mail de um disparo em série.
  - `lib/enterprise.ts`: `aplicarMarca` passa a trocar também os trechos da lista fechada acima, no HTML e no assunto (`aplicarMarcaNoAssunto`).
  - `lib/email.ts`: em `send()` (o ponto único das funções `notify*`, de `enviarEmailHtml` e do convite da equipe em `/api/enterprise/usuarios`), o `from` passa a ser `remetentePara(to) ?? FROM`, dentro do mesmo `try` da marca, para que uma falha caia em `FROM`. `enviarEmailRegistrado` (envio para instituição) não muda, porque o destinatário não é um partner.
- Tabelas afetadas: nenhuma alteração. Leitura de `profiles` (role, enterprise_id, white_label_dominio, white_label_nome, full_name) com service role, no servidor, a mesma usada hoje por `marcaPorEmail`.
- Rotas afetadas: nenhuma rota nova.
- APIs e integrações afetadas: Resend. A leitura de `/domains` é nova, só GET, com cache. A conta do Resend passa a ter um segundo domínio.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: na caixa de entrada de quem é da equipe da AGS. Os avisos da plataforma passam a chegar com remetente "AGS Finance" e endereço `naoresponda@agsfinance.app`. Exemplos de avisos: nova mensagem no chat da Mesa, proposta atualizada, convite de usuário, comentário na proposta e boas-vindas. O logo da AGS já entra hoje.
- Estado vazio: um Enterprise sem domínio, ou com domínio ainda não verificado, continua recebendo de "V3 Partners <noreply@v3partners.com.br>", sem erro.
- Sem UI? Não há tela nova. Na aba Domínio do `/enterprise` também não há indicador de "e-mail verificado"; isso fica fora deste escopo.
- Nota do porquê (tooltip): não se aplica.

## DEPENDENCIES
- Deve existir antes:
  - o domínio `agsfinance.app` verificado no Resend (os passos 1 a 3 acima). Sem isso, o código não muda nada, porque a verificação é a trava;
  - `white_label_dominio` gravado no master (já está) e `white_label_nome` = "AGS Finance" (já está).
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - Se o Resend recusar o remetente (domínio desverificado depois), o `send()` engole o erro como já faz hoje, e o aviso não chega.
  - Para reduzir esse risco, a lista de verificados é lida do próprio Resend (cache de 10 min). Um domínio que perder a verificação volta para `FROM` em até 10 minutos.
  - Se a leitura da lista falhar (rede ou chave), o conjunto fica vazio e tudo sai como V3.
- Entregabilidade:
  - Um domínio novo (criado em 24/11) não tem reputação. Os primeiros e-mails podem cair no spam até o domínio "aquecer". O volume da AGS é baixo (poucos usuários), o que ajuda.
  - O DMARC não é criado neste BRIEF. O Resend recomenda, mas não exige. Vou sugerir um registro `p=none` depois.
- LGPD e compliance:
  - Não há dado pessoal novo. O destinatário já recebe os mesmos avisos hoje, só que de outro remetente.
  - Ponto de atenção: um e-mail com remetente da AGS é uma comunicação em nome da AGS, cliente da V3, que a plataforma envia. Isso está coberto pelo white label contratado (Parceria v2.4, item 6.8), mas cabe ciência do Robson. Marcação: **[CIÊNCIA ROBSON, não bloqueante]**, porque a decisão de 21/11 foi do Hamilton.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem DDL. Usa a service role só no servidor (`server-only`). A `RESEND_API_KEY` já é usada no servidor e não sai dele.
- Performance:
  - Uma consulta a `profiles` a mais por e-mail enviado (o master do destinatário). Hoje `marcaPorEmail` já faz duas. Junto vem uma chamada ao Resend a cada 10 minutos por instância.
  - Disparos em massa (relatório mensal) passam por `send()` em série, então o custo é linear e pequeno.
- Outro:
  - Respostas: `naoresponda@` não recebe resposta, igual ao `noreply@` da V3 hoje. `reply_to` não é definido.
  - Os e-mails que saem fora de `lib/email.ts` (cerca de 30 rotas com `new Resend` próprio, como o cadastro de partner, M&A e a Mesa de Comissões) continuam V3. Em geral eles vão para a equipe interna da V3, investidores ou instituições, não para a equipe do Enterprise. Ficam fora deste escopo.
  - Os e-mails de autenticação do Supabase (recuperação de senha) não passam pelo Resend da aplicação e continuam V3.

## APPROACH
- Abordagem escolhida: escolher o remetente no ponto único `send()`, pelo destinatário, com a mesma lógica de marca que já existe. A trava é a lista de domínios verificados no próprio Resend: a mudança só passa a valer quando a verificação é concluída, sem flag manual e sem migration.
- Alternativa descartada:
  - Coluna nova `white_label_email_verificado` em `profiles`. Exige migration, e alguém precisa lembrar de marcar e desmarcar. O Resend já é a fonte da verdade.
  - Uma variável de ambiente com a lista de domínios. Exige redeploy a cada Enterprise novo.
  - Enviar com o remetente da AGS também os e-mails para os clientes finais da equipe AGS (link de assinatura de documentos, link de análise). Depende de saber quem originou cada envio em rotas espalhadas. Fica para a fase 2.

## DESENHO TÉCNICO
```ts
// lib/email-remetente.ts
import "server-only";
let cacheVerificados: { em: number; dominios: Set<string> } | null = null;
export async function dominiosVerificadosResend(): Promise<Set<string>> {
  if (cacheVerificados && Date.now() - cacheVerificados.em < 600_000) return cacheVerificados.dominios;
  try {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, cache: "no-store" });
    const j = await r.json();
    const dominios = new Set<string>((j.data ?? []).filter((d) => d.status === "verified").map((d) => String(d.name).toLowerCase()));
    cacheVerificados = { em: Date.now(), dominios };
    return dominios;
  } catch { return new Set(); }
}
export async function remetentePara(db, email): Promise<string | null> {
  // perfil do destinatário → master (ele mesmo ou enterprise_id) → white_label_dominio + nome
  // nome sem aspas nem <>; domínio verificado → `"${nome}" <naoresponda@${dominio}>`
}
```
Nome da marca: `white_label_nome` (ou `full_name` do master). Aspas, `<`, `>` e quebras de linha são removidos, e o tamanho fica limitado a 60 caracteres.

Reversão: reverter o PR. A infraestrutura (domínio no Resend e DNS) pode ficar, porque sem o código ela não tem efeito.

## PLANO DE TESTE
- Teste unitário (`tests/unit/email-remetente.test.ts`): monta o remetente (limpeza do nome, domínio em minúsculas); domínio não verificado devolve `null`; perfil V3 devolve `null`; falha na lista devolve conjunto vazio.
- Lint e o build da Vercel.
- Depois do merge, com o domínio verificado:
  - enviar uma mensagem pelo chat da Mesa para o usuário teste da AGS (v3partnersbrasil@gmail.com). O e-mail deve chegar com o remetente "AGS Finance <naoresponda@agsfinance.app>". Conferir no painel do Resend: `from` e `delivered`;
  - conferir um aviso para um partner V3, que deve continuar saindo de "V3 Partners <noreply@v3partners.com.br>".

## ESTIMATE
M. Cerca de 1 hora de código mais o tempo da verificação de DNS no Resend (minutos a algumas horas). Confiança alta.

## PARECER DE COMPLIANCE
[VALIDAR COM ROBSON] Sem resposta do Robson até 25/11/2026. Seguiu por "go mesmo assim" do Hamilton (ver REGISTRO DE LIBERAÇÃO). Pontos a levar ao Robson: (a) e-mails com nome e domínio da AGS, sendo que o domínio `agsfinance.app` foi registrado pela V3 na conta Vercel da V3, e não há autorização escrita da AGS arquivada para envio com esse domínio; (b) canal de resposta: `naoresponda@` sem reply_to. Texto original deste campo:

Sem dado pessoal novo. O remetente em nome do cliente Enterprise decorre do white label contratado (Parceria v2.4, item 6.8) e da decisão do Hamilton de 21/11/2026 ("e-mails de aviso com remetente/nome da AGS DEPOIS do domínio criado"). [CIÊNCIA ROBSON, não bloqueante]: avisar o Robson de que a plataforma passa a enviar e-mails com o nome do cliente Enterprise como remetente.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6, 25/11/2026. VEREDITO: BLOQUEADO (1 falha). Falha: compliance. Comunicação em nome de terceiro marcada como "ciência não bloqueante", quando deveria ser [VALIDAR COM ROBSON]; falta autorização escrita da AGS; o texto dos e-mails dizia V3 com remetente AGS; não há canal de resposta. Tratamento: texto resolvido pela decisão do Hamilton (lista fechada de trocas acima); compliance aceito por override. Sugestões aplicadas: status `ativo` + casamento exato do domínio, cache negativo e `r.ok`, leitura de domínios confirmada com a chave de produção, e-mail sem curingas. DMARC recusado pelo Hamilton por agora.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 1)
- Override ("go mesmo assim"): sim, decidido pelo Hamilton em 25/11/2026. Falha aceita: compliance sem parecer do Robson e sem autorização escrita da AGS para envio com o domínio dela (avisar Robson).
- Go dado por: pendente
- Migration aplicada em produção: não se aplica
