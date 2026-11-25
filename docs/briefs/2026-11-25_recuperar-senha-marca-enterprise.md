# BRIEF: Recuperação de senha com a marca do Enterprise (e-mail e tela de nova senha)

> Data: 2026-11-25 | Autor: Claude (pedido do Hamilton) | Status: go mesmo assim (Hamilton, 25/11)
> Salvar em `docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md` e commitar junto com o código.

## SCOPE
Pedido do Hamilton em 25/11/2026: "continuar com o white label". Item escolhido: "Recuperar senha".

Hoje, quando alguém da equipe da AGS clica em "Esqueci a senha" em `agsfinance.app`:
1. A tela já sai com a marca da AGS (PR #429).
2. O navegador chama `supabase.auth.resetPasswordForEmail`. O e-mail é enviado pelo **próprio Supabase**, com o modelo único do projeto (marca V3) e o remetente da V3. Esse modelo não sabe quem é o destinatário, então não dá para trocar a marca por Enterprise dentro do Supabase.
3. O link leva a `/auth/callback` e depois a `/auth/update-password`, uma tela cliente com o logo `/logo.jpg`, o texto "V3 Partners" e as cores da V3 fixos.

A correção tem um comportamento único, decidido **só pelo domínio acessado**.

**Domínio com marca pronta.** Vale quando o host acessado é o `white_label_dominio` de um master Enterprise com status `"ativo"` e com o domínio verificado no Resend, ou seja, quando `montarRemetente` devolve remetente. Hoje só `agsfinance.app` está nesse caso.
- O navegador chama a API nova `POST /api/public/recuperar-senha`, que responde sempre `{ ok: true }`. Depois da resposta (`after()`), o servidor procura o e-mail digitado.
- **E-mail da equipe desse Enterprise** (o master, ou um usuário com `enterprise_id` = master):
  - o servidor gera o link com `auth.admin.generateLink({ type: "recovery" })`, que não envia nada sozinho;
  - envia o e-mail por `lib/email.ts`, que sai com o remetente `"AGS Finance" <naoresponda@agsfinance.app>`, o logo e o rodapé da marca (PR #434);
  - o link aponta para `https://agsfinance.app/auth/confirm?token_hash=…`.
- **Qualquer outro e-mail** (inexistente, de partner da V3, de outro Enterprise): **nada é enviado**, nem pelo Supabase. O domínio é da AGS e serve à equipe dela. Partners da V3 recuperam a senha em `app.v3partners.com.br`, como hoje. A tela mostra a mesma mensagem em todos os casos.

**Qualquer outro domínio** (`app.v3partners.com.br`, ou um domínio de Enterprise com status `"pendente"` ou não verificado no Resend): nada muda. O navegador chama `resetPasswordForEmail` como hoje, com PKCE, `redirectTo` `/auth/callback?next=/auth/update-password` e a lista de URLs que já existe. A tela decide isso pela prop `recuperacaoPelaMarca`, calculada no servidor junto com a marca. A API nova não é chamada.

**Tela `/auth/confirm`** (nova, com a marca do domínio). Ela mostra "Criar nova senha" e um botão "Continuar". O token **não é usado ao abrir a página**: só o clique no botão faz o `POST /api/public/recuperar-senha/confirmar`. Essa rota chama `verifyOtp({ type: "recovery", token_hash })` com `type` fixo no servidor, grava a sessão nos cookies, registra o LOGIN na auditoria (como `/auth/callback`) e responde 303 para `/auth/update-password`. Com isso, o antivírus de e-mail (SafeLinks), que só faz GET, não gasta o token. Se o token for inválido ou estiver vencido, a rota responde 303 para `/esqueci-senha?erro=link`, e a tela mostra "Link vencido ou já usado. Peça um novo abaixo."

**Tela `/auth/update-password`.** Ela vira uma página de servidor que resolve a marca pelo domínio (`marcaDoHost`, igual ao login) e passa a marca ao formulário cliente. Logo, nome e cores passam a usar `var(--wl-*, <cor V3>)`. No domínio da V3 nada muda.

## IMPACT
- Arquivos afetados:
  - novo `lib/recuperar-senha.ts` (`server-only`): resolve o domínio com marca pronta, a regra de equipe e o limite de envio;
  - novo `lib/recuperar-senha-regras.ts` (puro, testável): normalização do e-mail e regra `daEquipe`;
  - novo `app/api/public/recuperar-senha/route.ts` (POST `{ email }`);
  - novo `app/api/public/recuperar-senha/confirmar/route.ts` (POST de formulário `token_hash`);
  - novo `app/auth/confirm/page.tsx` (página de servidor com a marca e o formulário com o botão);
  - `app/(auth)/esqueci-senha/page.tsx` e `esqueci-senha-client.tsx`:
    - nova prop `recuperacaoPelaMarca`;
    - aviso de link vencido;
    - tratamento de falha da API;
    - fim do travessão no texto de instrução;
  - `app/auth/update-password/page.tsx`: vira página de servidor (`generateMetadata` com `metadataDaMarca` e `<style id="tema-enterprise">`). O formulário vai, sem mudança de lógica, para o novo `update-password-client.tsx`;
  - `lib/email.ts`: nova `enviarRecuperacaoSenha({ to, nome, link })`, que usa `send()` e `template()`;
  - `proxy.ts`: `/auth/confirm` e `/api/public/recuperar-senha` entram em `PUBLIC_ROUTES`. O prefixo cobre `/confirmar`.
- Tabelas afetadas:
  - leitura em `profiles` (id, role, enterprise_id, full_name, email, white_label_*);
  - escrita em `audit_logs` (reserva de envio e LOGIN).
  - Nenhuma tabela ou coluna nova. Nenhuma migration.
- Rotas afetadas: `/esqueci-senha`, `/auth/update-password`, nova `/auth/confirm`, novas `/api/public/recuperar-senha` e `/api/public/recuperar-senha/confirmar`.
- APIs e integrações afetadas: Supabase Auth Admin (`generateLink`), Supabase Auth (`verifyOtp`), Resend pelo `send()` existente.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso:
  1. `https://agsfinance.app/login` → link "Esqueci minha senha" → digita o e-mail → "Enviar link" → a mesma tela de hoje: "E-mail enviado! Se {email} estiver cadastrado, você vai receber um link…".
  2. Caixa de entrada: e-mail de "AGS Finance", assunto "Redefinir sua senha", com o logo da AGS, o botão "Criar nova senha" e o texto "O link expira em pouco tempo e só pode ser usado uma vez. Se você não pediu, ignore este e-mail." O texto não promete prazo exato, porque o prazo é o configurado no Supabase.
  3. O botão abre `agsfinance.app/auth/confirm`, com a marca da AGS, o título "Criar nova senha" e o botão "Continuar".
  4. Depois, a tela "Nova Senha" com o logo, o nome e as cores da AGS. Ao salvar, a pessoa segue para o perfil, como hoje.
  - A troca de senha obrigatória do primeiro acesso (`/auth/update-password?required=true`) também sai com a marca da AGS quando a pessoa está em `agsfinance.app`.
- Estado vazio: não se aplica.
- Erros:
  - link vencido ou usado: `/esqueci-senha` mostra "Link vencido ou já usado. Peça um novo abaixo.";
  - API nova com erro 5xx ou sem rede: "Erro ao enviar o e-mail. Tente novamente em instantes.", a mesma mensagem que já existe para o caso do Supabase.
- Sem UI? Tem UI: o e-mail e as três telas acima.
- Nota do porquê: não se aplica.

## DEPENDENCIES
- Deve existir antes:
  - `marcaDoHost` e `metadataDaMarca` (PRs #429 e #431);
  - o remetente do Enterprise em `send()` e `dominiosVerificadosResend` (PR #434);
  - `agsfinance.app` verificado no Resend (verificado em 25/11);
  - `logAuditStrict` (lib/audit.ts, já existe).
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - `/auth/update-password` passa de página cliente para página de servidor com componente cliente. A lógica do formulário (`onAuthStateChange`, `getSession`, `/api/auth/change-password`) não muda.
  - Os links do Supabase já enviados (`/auth/callback?...`) continuam funcionando.
  - O domínio da V3 não é tocado.
- Segurança:
  - **Enumeração de contas.** A API responde sempre `{ ok: true }`, e a busca e o envio rodam em `after()`, então o tempo de resposta não depende do e-mail. A escolha entre o fluxo da marca e o fluxo da V3 é feita no servidor, pelo domínio, e entregue à tela como prop. Ela nunca depende do e-mail.
  - **Abuso de envio.**
    - Só e-mails da equipe do Enterprise dono do domínio recebem algo. Para qualquer outro e-mail, nenhuma chamada ao Supabase nem ao Resend acontece, então ninguém esgota a cota de e-mail do projeto por `agsfinance.app`.
    - Para a equipe, o limite é de 1 envio a cada 60 s e 5 **envios efetivos** por hora por usuário. Ele é resistente a rajada e **falha fechado**:
      1. **teto de escrita, antes de gravar:** conta as reservas da última hora daquele usuário e daquele IP. Com 10 ou mais do usuário, ou 20 ou mais do IP, para sem gravar nada. Isso limita as linhas em `audit_logs`: no máximo cerca de 10 por usuário por hora mais a janela de corrida;
      2. **reserva antes de enviar:** insere em `audit_logs` com `.select("id, created_at")` (insert estrito próprio no módulo `server-only`, que lança erro em falha). Assim a rota sabe qual é a reserva dela. Se o insert falhar, não envia;
      3. relê as reservas do usuário na última hora, ordenadas por `created_at, id`;
      4. só envia se a reserva dela é a **primeira** dos últimos 60 s e se há menos de 5 linhas `recuperar_senha_enviado` do usuário na hora;
      5. depois do envio, grava uma linha nova `recuperar_senha_enviado` (sem update: `audit_logs` fica só de inserção).
    - Sem IP na requisição, vale só o teto por usuário.
    - Em N pedidos simultâneos, todos inserem e todos leem as N reservas, e só a mais antiga envia.
    - **Teto real:** a equipe da AGS tem no máximo 11 pessoas (o master e 10 usuários), então são no máximo 5 e-mails por pessoa por hora e 55 por hora para o domínio inteiro.
    - **Bloqueio do titular (limitação aceita):** alguém que conheça o e-mail de um usuário da AGS pode fazer 10 pedidos numa hora e travar a recuperação dele **por `agsfinance.app`** durante aquela hora. O titular continua podendo recuperar a senha por `app.v3partners.com.br`, onde vale o fluxo do Supabase, que não é afetado. A trava acaba sozinha na hora seguinte.
  - **Host forjado.** O link usa o `white_label_dominio` do master gravado no banco. Só há envio quando o host acessado é esse mesmo domínio (`enterprisePorDominio`), o status é `"ativo"`, o domínio está verificado no Resend e o usuário é da equipe desse master. Um `Host` forjado não leva o link para outro site.
  - **Token.**
    - O `token_hash` vai só no e-mail e no campo oculto do formulário de `/auth/confirm`.
    - Ele é usado só no POST, com `type` fixo `"recovery"`, e a resposta é um 303 para um caminho fixo (sem open redirect).
    - Ele vale uma vez e expira no prazo do Supabase.
    - Nunca vai para log, auditoria ou resposta de API.
    - O GET de `/auth/confirm` não usa o token, o que resolve o SafeLinks.
  - **Consulta por e-mail.** `ilike` com `emailParaIlike` e `.limit(1).maybeSingle()`, o mesmo padrão de `lib/email-remetente.ts`. O e-mail usado no `generateLink` e no envio é o **do auth**, lido por `auth.admin.getUserById(p.id)`, e não o de `profiles`. Assim uma divergência entre os dois não quebra o link nem manda para o endereço errado.
  - **CSRF na confirmação.** `/api/public/recuperar-senha/confirmar` só aceita o POST se o cabeçalho `Origin` for o host da própria requisição. Fora isso, responde 303 para `/esqueci-senha?erro=link`.
- LGPD e compliance:
  - Sem dado pessoal novo. O e-mail já é tratado na recuperação de hoje.
  - A auditoria grava o id do usuário, a data e o IP de quem pediu, com `user_name` "Pedido anônimo de recuperação de senha", para a trilha não sugerir que o titular agiu. O e-mail digitado e o token não são gravados.
  - **[VALIDAR COM ROBSON]: este BRIEF amplia o remetente com o nome da AGS para o e-mail de credencial de acesso (recuperação de senha).** O override de 25/11 cobriu só as notificações. Pontos para o Robson:
    - e-mail de credencial com o nome de terceiro é o tipo mais sensível a phishing;
    - quem é o controlador perante o usuário;
    - não há autorização escrita da AGS;
    - o domínio foi registrado pela V3.
  - **Bloqueia** até a resposta do Robson, ou até um "go mesmo assim" do João ou do Hamilton registrado aqui citando esta ampliação.
- Segurança de acesso ao banco (anon, RLS, views, funções):
  - nada muda: sem grant, política, view nem função nova;
  - service role só no servidor (rotas de API e módulo `server-only`);
  - o `anon` não ganha acesso a nada.
- Performance: até 8 chamadas curtas por pedido (perfil, 2 contagens, reserva, releitura, `getUserById`, `generateLink` e registro do envio), só para e-mail da equipe e fora do caminho de resposta. Insignificante.
- Vercel timeout (60s): não se aplica. Sem IA, e só chamadas HTTP curtas (Supabase e Resend).
- Outro:
  - Se o Resend falhar, a tela já mostrou sucesso (por causa do anti-enumeração). A falha vai para `console.error` só com o id do usuário. A reserva continua contando, então a pessoa espera 60 s e pede de novo.
  - Um partner da V3 que tentar recuperar a senha em `agsfinance.app` não recebe nada e precisa usar `app.v3partners.com.br`. É uma escolha de segurança deste BRIEF (ver acima).
  - Fora do escopo:
    - o "Redefinir senha" do perfil (`/api/profile/reset-password`), que continua com o modelo do Supabase e o link da V3;
    - o reenvio de acesso em Usuários (`/api/usuarios/reenviar-email`);
    - os modelos do Supabase.

## APPROACH
- Abordagem escolhida: o servidor gera o link (`generateLink`, que não envia) e o e-mail sai pelo `send()`, que já põe a marca. O token é validado numa rota própria no domínio do Enterprise (`verifyOtp` com `token_hash`, por POST). Assim o link não depende da lista de URLs de redirecionamento do Supabase e funciona em outro aparelho, coisa que o PKCE do fluxo atual não permite.
- Alternativas descartadas:
  - SMTP próprio no Supabase: o modelo é um só para o projeto, então não dá para escolher a marca por destinatário.
  - Hook "Send Email" do Supabase: trocaria todos os e-mails de autenticação da V3 de uma vez.
  - Mandar no servidor, pelo Supabase, o e-mail de quem não é da equipe: abriria o esgotamento da cota de e-mail do projeto a partir do domínio do Enterprise.
  - Usar o caminho novo também no domínio da V3: sem pedido para isso.

## DESENHO TÉCNICO
```ts
// lib/recuperar-senha.ts (server-only)
export async function dominioComMarcaPronta(db, host): Promise<{ masterId, dominio } | null>
  // enterprisePorDominio(host) + master.white_label_dominio_status === "ativo"
  // + montarRemetente(...) !== null   (domínio verificado no Resend)

export async function processarPedido(db, email, host, ip) {
  const alvo = await dominioComMarcaPronta(db, host); if (!alvo) return
  const p = profiles.select(id, role, enterprise_id, full_name).ilike("email", emailParaIlike(email)).limit(1).maybeSingle()
  if (!daEquipe(p, alvo.masterId)) return                          // nada é enviado
  if (await reservasNaHora({ entityId: p.id }) >= 10 || await reservasNaHora({ ip }) >= 20) return   // nada é gravado
  const minha = await svc.from("audit_logs").insert({ user_id: p.id, user_name: "Pedido anônimo de recuperação de senha",
    action: "ACCESS", entity: "profiles", entity_id: p.id, new_data: { evento: "recuperar_senha_reserva" }, ip_address: ip })
    .select("id, created_at").single()                                 // erro → lança → sem envio
  const reservas = audit_logs where entity_id = p.id and new_data->>evento = 'recuperar_senha_reserva'
                   and created_at > now-1h order by created_at, id
  if (!podeEnviar(reservas, minha.id, agora)) return  // 1ª dos últimos 60 s e < 5 linhas recuperar_senha_enviado na hora
  const { data: u } = await svc.auth.admin.getUserById(p.id)          // e-mail do auth
  const { data } = await svc.auth.admin.generateLink({ type: "recovery", email: u.user.email })
  await enviarRecuperacaoSenha({ to: u.user.email, nome: p.full_name,
    link: `https://${alvo.dominio}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}` })
  await logAudit({ ..., newData: { evento: "recuperar_senha_enviado" } })   // linha nova, sem update
}

// POST /api/public/recuperar-senha → valida o formato, after(() => processarPedido(...)), responde { ok: true }
// POST /api/public/recuperar-senha/confirmar (form) → verifyOtp({ type: "recovery", token_hash })
//      ok: logAudit LOGIN → 303 /auth/update-password ; erro: 303 /esqueci-senha?erro=link
// page esqueci-senha: recuperacaoPelaMarca = !!(await dominioComMarcaPronta(db, host))
```
`podeEnviar` e `daEquipe` ficam em `lib/recuperar-senha-regras.ts` (puro), com testes.
Reversão: reverter o PR. Os links já enviados deixam de existir em `/auth/confirm`, e a pessoa pede de novo.

## PLANO DE TESTE
- Testes unitários:
  - normalização do e-mail;
  - `daEquipe` (master, equipe, outra rede, papel diferente, nulo);
  - `podeEnviar`:
    - a primeira reserva envia;
    - a segunda em menos de 60 s não envia;
    - 10 reservas simultâneas resultam em só 1 envio;
    - com 5 envios efetivos na hora, o próximo não envia;
    - reservas que não enviaram não contam para o teto de 5.
- Lint, build da Vercel e o teste automático de telas.
- Em produção:
  - `curl https://agsfinance.app/auth/update-password` e `/auth/confirm`: título "AGS Finance", logo da AGS e `--wl-principal`;
  - `curl https://app.v3partners.com.br/auth/update-password`: igual a hoje;
  - `curl -X POST https://agsfinance.app/api/public/recuperar-senha` com um e-mail inexistente: `{ ok: true }`, nenhum envio no Resend e nenhuma linha em `audit_logs`;
  - `curl -X POST .../recuperar-senha/confirmar` com um token inválido: 303 para `/esqueci-senha?erro=link`;
  - `curl` em `GET /auth/confirm?token_hash=x`: a página carrega e o token não é usado;
  - teto de escrita: depois de 10 reservas na hora, um novo POST não grava linha;
  - POST de confirmação com `Origin` de outro site: 303 para `/esqueci-senha?erro=link`;
  - rajada: 10 POSTs paralelos com o e-mail do usuário de teste da AGS resultam em 1 envio no Resend e 10 reservas em `audit_logs`;
  - envio real para o usuário de teste da AGS: conferir o remetente "AGS Finance" no Resend. O Hamilton abre o link e cria a senha. **Eu não digito senha.**

## ESTIMATE
M. Cerca de 2h. Confiança alta.

## PARECER DE COMPLIANCE
[VALIDAR COM ROBSON] Ampliação do remetente com o nome da AGS para o e-mail de recuperação de senha (ver RISKS). Sem resposta até 25/11/2026. Bloqueia até a resposta ou até o override registrado abaixo.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 25/11/2026. BLOQUEADO, 4 falhas, todas tratadas nesta versão:
1. O limite de envio não segurava rajada e falhava aberto. Agora: reserva estrita antes do envio, só a primeira reserva envia, e o ramo de fora da equipe não chama o Supabase.
2. SCOPE e DESENHO divergiam para e-mail de fora da equipe. Agora há um comportamento único: no domínio com marca pronta, nada é enviado para quem é de fora.
3. Domínio com status diferente de "ativo" não tinha tratamento. Agora segue o fluxo da V3.
4. O Robson tinha sido dispensado por conta própria. Agora bloqueia até a resposta ou até um override explícito.
Sugestões aplicadas:
- confirmação por POST;
- `type` fixo;
- prazo do link sem número;
- textos unificados;
- erro 5xx;
- `user_name` anônimo;
- travessão removido;
- `.limit(1)`.

Rodada 2, 25/11/2026. BLOQUEADO, 2 falhas:
1. Escrita anônima sem teto em `audit_logs`, o titular podia ser bloqueado e não havia como identificar a própria reserva. Tratado: teto antes de gravar (10 por usuário e 20 por IP na hora), insert com `select id`, limite sobre envios efetivos e bloqueio do titular documentado, com o caminho por `app.v3partners.com.br`.
2. Compliance (Robson). Continua aberto até a resposta ou o override.
Sugestões aplicadas: e-mail do auth por `getUserById`, checagem de `Origin` na confirmação, emoji removido.

Rodada 3, 25/11/2026. BLOQUEADO, 1 falha: só a de compliance (Robson), que fica aberta até a resposta ou o override.
Sugestões aplicadas: envio registrado em linha nova (sem update), IP nulo usa só o teto por usuário, texto de performance atualizado.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 3). Única falha restante: compliance [VALIDAR COM ROBSON]
- Override: sim. "go mesmo assim" do Hamilton em 25/11/2026, aceitando a falha aberta de compliance [VALIDAR COM ROBSON]: o remetente "AGS Finance" passa a ser usado também no e-mail de recuperação de senha, com autorização escrita da AGS e domínio registrado pela V3 ainda pendentes com o Robson.
- Go dado por: Hamilton, 25/11/2026 ("go mesmo assim")
- Migration aplicada em produção: não se aplica
