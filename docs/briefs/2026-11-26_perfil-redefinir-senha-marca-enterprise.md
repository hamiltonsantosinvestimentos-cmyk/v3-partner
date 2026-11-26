# BRIEF: "Redefinir senha" do Meu Perfil com a marca do Enterprise

> Data: 2026-11-26 | Autor: Claude (pedido do Hamilton: "continuar com o white label") | Status: EM QA
> Salvar em `docs/briefs/2026-11-26_perfil-redefinir-senha-marca-enterprise.md` e commitar junto com o código.

## SCOPE
Hoje o botão "Redefinir senha" em Meu Perfil (`components/perfil/perfil-client.tsx:224` → `POST /api/profile/reset-password`) chama `resetPasswordForEmail` do Supabase. Assim, mesmo um usuário da equipe AGS logado em agsfinance.app recebe o e-mail padrão do Supabase, com a marca V3, e um link que leva a app.v3partners.com.br. Depois do PR #435 a recuperação pela tela "Esqueci a senha" já sai com a marca do Enterprise; este BRIEF leva o mesmo envio para o botão do perfil.

Regra: se quem pede é da equipe de um Enterprise (role ENTERPRISE, o master ou alguém com `enterprise_id` = master) **e** o domínio do master está pronto (status "ativo" e verificado no Resend, a mesma checagem do #435), o link é gerado no servidor e enviado pelo `enviarRecuperacaoSenha` com o remetente da marca, apontando para `https://<domínio do master>/auth/confirm`. Para os demais perfis nada muda.

A marca segue **o usuário**, não o host: um usuário AGS que esteja logado por app.v3partners.com.br também recebe o e-mail e o link da AGS.

## IMPACT
- Arquivos afetados:
  - `lib/recuperar-senha.ts`: extrair o miolo de `processarPedido` (reserva, rate limit, geração do link, envio, registro) para `enviarLinkDaMarca(db, perfil, dominio, ip, origem)`, e a checagem de domínio pronto para `dominioProntoDoMaster(db, masterId)`, reaproveitada por `dominioComMarcaPronta`. `processarPedido` passa a chamar os dois, com o mesmo comportamento e os mesmos logs de hoje.
  - `app/api/profile/reset-password/route.ts`: assinatura passa a `POST(req: NextRequest)` (para ler o IP); usa o novo caminho quando o perfil for da equipe com domínio pronto.
  - `components/perfil/perfil-client.tsx`: o toast ganha o tipo `"info"` (cor neutra), usado quando a resposta for 429.
  - `tests/unit/recuperar-senha.test.ts`: sem mudança de regra pura. O teste continua valendo.
- Tabelas afetadas: nenhuma alteração de estrutura. Grava as mesmas linhas de auditoria do #435 (`audit_logs`, eventos `recuperar_senha_reserva` e `recuperar_senha_enviado`), agora também com `user_name` = "Pedido de redefinição pelo perfil".
- Rotas afetadas: `POST /api/profile/reset-password` (só autenticado, como hoje).
- APIs e integrações afetadas: Supabase Auth (`generateLink` em vez de `resetPasswordForEmail` para a equipe Enterprise), Resend.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Meu Perfil → botão "Redefinir senha". Usuário da equipe AGS recebe "Redefinir sua senha", de "AGS Finance" <naoresponda@agsfinance.app>, com o botão "Criar nova senha". O botão abre agsfinance.app/auth/confirm, depois "Continuar" e então a tela de nova senha da AGS (já existentes desde o #435).
- Mensagens na tela (toast):
  - envio feito: "E-mail de redefinição enviado para <e-mail>" (hoje sai "Email"; passa a "E-mail" nos dois caminhos, V3 e Enterprise);
  - pedido repetido em menos de 1 minuto, ou 5 envios na hora: "Já enviamos um e-mail há pouco. Confira sua caixa de entrada e o spam, ou tente de novo em alguns minutos." (status 429, toast neutro `info`, não vermelho);
  - qualquer falha (Resend recusou, usuário sem e-mail no auth, erro de banco, de link ou de consulta do domínio): "Não foi possível enviar o e-mail agora. Tente de novo em instantes." (status 500). Vale também para o caminho V3, que hoje devolve a mensagem crua do Supabase, em inglês.
- Estado vazio: não se aplica.
- Nota do porquê: não se aplica (botão existente).

## DEPENDENCIES
- Deve existir antes: PR #435 (no ar desde 25/11), com `/auth/confirm`, `/api/public/recuperar-senha/confirmar` e a tela `/auth/update-password` com a marca.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - para perfis que não são da equipe Enterprise com domínio pronto, o código segue exatamente o caminho atual;
  - se o domínio do master cair (status deixa de ser "ativo" ou sai da verificação do Resend), o usuário volta ao fluxo V3 automaticamente.
- LGPD e compliance: o e-mail continua indo só para o próprio titular logado, para o e-mail do `auth.users`. É o mesmo ponto já aberto com o Robson no #435 (remetente com o nome da AGS num domínio registrado pela V3, sem autorização escrita da AGS); este BRIEF amplia o uso do mesmo remetente para mais um botão, não cria ponto novo. Registrado em "Parecer de compliance".
- Segurança de acesso ao banco (anon, RLS, views, funções): sem alteração. A rota exige sessão (`auth.getUser()`), lê o perfil do próprio usuário e usa a service role só no servidor, como hoje. Nenhum dado de outro usuário é lido ou exposto; o `userId` vem da sessão, nunca do corpo.
- Abuso: o rate limit do #435 (primeira reserva em 60 s ganha, no máximo 5 envios por hora, teto de 10 reservas por usuário por hora) vale também aqui, porque os dois botões gravam as mesmas reservas por usuário. Um pedido pelo perfil e outro pelo "Esqueci a senha" no mesmo minuto mandam um e-mail só.
- Bloqueio por terceiro: o teto de 10 reservas por hora é por usuário e compartilhado com o "Esqueci a senha" anônimo. Quem repetir o "Esqueci a senha" com o e-mail de um usuário AGS faz o botão do perfil dele responder 429 por até 1 hora. É o mesmo comportamento aceito no #435 (saída: app.v3partners.com.br não usa esse teto) e fica aceito aqui.
- Falha de consulta do domínio: no "Esqueci a senha" anônimo segue como no #435 (erro vira fluxo V3). No botão do perfil, erro de consulta (banco ou Resend) **não** cai no V3: responde 500, para um usuário AGS nunca receber o e-mail da V3 por falha momentânea. Só "domínio não pronto" (status diferente de ativo ou não verificado) leva ao fluxo V3.
- Performance: a rota passa a fazer 4 a 5 consultas em vez de 1 chamada. Fica abaixo de 2 s; não roda em `after()` porque o usuário logado precisa da resposta real.
- Vercel timeout (60s): não se aplica.
- Outro: o link gerado por `generateLink` é de uso único e de vida curta, igual ao do #435. O e-mail do V3 (Supabase) deixa de sair para a equipe AGS, então um link antigo do V3 ainda válido continua funcionando até vencer.

## APPROACH
- Abordagem escolhida: reaproveitar o envio do #435 extraindo duas funções de `lib/recuperar-senha.ts`. A regra de rate limit, o template e a tela de confirmação já foram auditados e testados em produção; o botão do perfil passa a usá-los sem lógica nova.
- Alternativas descartadas:
  - Configurar o template de recuperação no painel do Supabase: o template é um só para todo o projeto, então todos os usuários receberiam a mesma marca.
  - Escolher a marca pelo host da requisição, como no "Esqueci a senha": o usuário logado já é conhecido, então a marca certa é a do Enterprise dele. Pelo host, um usuário AGS logado em app.v3partners.com.br continuaria recebendo o e-mail da V3.
  - Incluir neste BRIEF o "Reenviar e-mail" da tela Usuários (`/api/usuarios/reenviar-email`): ele troca a senha por uma senha fixa e a envia no corpo do e-mail. Levar a marca da AGS para esse e-mail exigiria antes trocar a senha fixa por um link, uma mudança de segurança que pede BRIEF próprio. Fica fora daqui.

## DESENHO TÉCNICO
```ts
// lib/recuperar-senha.ts
export async function dominioProntoDoMaster(db, masterId): Promise<string | null>
  // lê white_label_nome/full_name/white_label_dominio/status do master e devolve o domínio
  // em minúsculas se montarRemetente(...) não for null (ativo + verificado no Resend); senão null.
  // NÃO engole erro: falha de consulta lança.

export async function dominioComMarcaPronta(db, host)   // mantém assinatura e comportamento
  // try { enterprisePorDominio(db, host) → dominioProntoDoMaster(db, e.masterId) } catch { null }

export type ResultadoEnvio = "enviado" | "limite" | "falha";
export async function enviarLinkDaMarca(db, perfil, dominio, ip, origem: "anonimo" | "perfil"): Promise<ResultadoEnvio>
  // corpo atual de processarPedido a partir do teto de reservas:
  //  - teto por usuário/IP → "limite"
  //  - reserva (insert ... select id) → podeEnviar? senão "limite"
  //  - erro de infraestrutura (gravar/ler reservas, generateLink) → LANÇA, como hoje
  //  - usuário sem e-mail no auth → "falha"; Resend recusou → console.error com o id + "falha"
  //  - ok → grava "enviado" e devolve "enviado"
  //  - user_name na auditoria conforme origem ("Pedido anônimo..." ou "Pedido de redefinição pelo perfil")

// processarPedido(email, host, ip): igual ao de hoje, chamando as duas funções. As exceções
// continuam subindo até a rota pública, que já registra "[recuperar-senha] pedido não processado".

// app/api/profile/reset-password/route.ts — POST(req: NextRequest)
//  user = auth.getUser(); 401 sem e-mail
//  perfil = profiles(id, role, enterprise_id, full_name) do próprio user.id (service role)
//  masterId = perfil.role === "ENTERPRISE" ? (perfil.enterprise_id ?? perfil.id) : null
//  dominio = masterId && daEquipe(perfil, masterId) ? await dominioProntoDoMaster(db, masterId) : null
//  se dominio:
//    r = await enviarLinkDaMarca(db, perfil, dominio, getClientIp(req), "perfil")
//    "enviado" → 200 { ok, message: `E-mail de redefinição enviado para ${email}` }
//    "limite"  → 429 { error: "Já enviamos um e-mail há pouco. ..." }
//    "falha"   → 500 { error: "Não foi possível enviar o e-mail agora. ..." }
//    exceção (inclusive de dominioProntoDoMaster) → 500 com a mesma mensagem
//      (falha fechado, sem cair no V3, console.error só com o id)
//  senão: fluxo atual (resetPasswordForEmail); erro → 500 com a mensagem em português acima.
```
Reversão: reverter o PR. Não há migration.

## PLANO DE TESTE
- Build da Vercel e testes unitários (`tests/unit/recuperar-senha.test.ts`, `email-remetente`).
- Em produção, com o usuário de teste da AGS (07668ecf-…). O Hamilton faz o login, porque o agente não digita senha:
  - em agsfinance.app → Meu Perfil → "Redefinir senha": conferir no Resend o envio de "AGS Finance" <naoresponda@agsfinance.app> e que o link aponta para agsfinance.app/auth/confirm;
  - clicar de novo em menos de 1 minuto: aparece o aviso de limite e nenhum e-mail novo sai (conferir `audit_logs`: 2 reservas, 1 enviado).
- Perfil V3 (ADMIN de teste ou o próprio suporte@): o botão continua mandando o e-mail do Supabase e o toast de hoje.
- Não testável sem o usuário: o clique final no link e a criação da senha, que ficam com o Hamilton.

## ESTIMATE
S. Cerca de 40 minutos. Confiança alta (reaproveita código já no ar).

## PARECER DE COMPLIANCE
Ponto já aberto com o Robson desde o #434/#435 e ainda sem resposta: e-mails com o nome da AGS saindo de domínio registrado pela V3, sem autorização escrita da AGS e sem canal de resposta. Este BRIEF não cria dado pessoal novo nem destinatário novo (o e-mail vai só ao próprio titular logado); só estende o mesmo remetente a mais um botão. [VALIDAR COM ROBSON] continua pendente pelo mesmo motivo do #435.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 26/11/2026. BLOQUEADO, com 1 falha: o ponto [VALIDAR COM ROBSON] segue aberto, e o override do #435 não vale para este BRIEF, que amplia o uso do remetente da AGS ao botão do perfil e faz a marca seguir o usuário, inclusive fora do domínio da AGS. A parte técnica não teve falha. Todas as sugestões foram aplicadas nesta versão:
- os logs de erro do fluxo anônimo foram mantidos;
- "falha" foi definida e a assinatura alinhada;
- a rota passa a ser `POST(req)`;
- "E-mail" nos dois caminhos;
- toast neutro para o 429;
- mensagem em português no caminho V3;
- erro de consulta não cai no V3;
- risco de bloqueio por terceiro registrado.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO só por compliance (rodadas: 1)
- Override: aguardando "go mesmo assim" do Hamilton ou do João, citando a ampliação (botão do perfil e marca pelo usuário, inclusive fora de agsfinance.app)
- Go dado por: (pendente)
- Migration aplicada em produção: não se aplica
