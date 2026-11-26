# BRIEF: "Reenviar e-mail" da tela Usuários manda link com a marca para a equipe Enterprise

> Data: 2026-11-26 | Autor: Claude (pedido do Hamilton: "continuar com o white label") | Status: EM QA
> Salvar em `docs/briefs/2026-11-26_reenviar-acesso-enterprise-por-link.md` e commitar junto com o código.

## SCOPE
Hoje o botão "Reenviar e-mail" da tela Usuários, de uso exclusivo do ADMIN (`components/usuarios/users-client.tsx:267` → `POST /api/usuarios/reenviar-email`), faz três coisas:
1. troca a senha do usuário para a senha fixa `12345678`;
2. liga a troca obrigatória de senha no próximo acesso;
3. manda um e-mail da V3 ("Seus dados de acesso — V3 Partners") com essa senha escrita e o link para app.v3partners.com.br/login.

Para a equipe de um Enterprise isso tem dois problemas: o e-mail sai com a marca da V3 e a senha vai escrita no e-mail.

A mudança vale quando o alvo é da equipe de um Enterprise (role ENTERPRISE: o master ou alguém com `enterprise_id` = master) **e** o domínio do master está pronto (status "ativo" e verificado no Resend, mesma checagem do #435 e do #437). Nesse caso o botão **não troca a senha** e manda o e-mail "Redefinir sua senha" com a marca do Enterprise. O link é de uso único e leva a `https://<domínio>/auth/confirm` e depois à tela de nova senha da marca, ou seja, o mesmo envio do #435 e do #437.

Para os demais usuários (V3, e Enterprise sem domínio pronto) o comportamento atual continua **sem mudança**. Tirar a senha fixa da V3 inteira é outro assunto: também está em `/api/cadastro-partner/aprovar` e `lib/email.ts:751` e merece BRIEF próprio.

## IMPACT
- Arquivos afetados:
  - `app/api/usuarios/reenviar-email/route.ts`: decide entre o envio da marca e o fluxo atual, antes de qualquer troca de senha.
  - `lib/recuperar-senha-regras.ts`: nova função pura `caminhoReenvio` (com teste em `tests/unit/recuperar-senha.test.ts`).
  - `lib/recuperar-senha.ts`: `dominioProntoDoMaster` passa a devolver também o nome da marca; `enviarLinkDaMarca` ganha a origem `"admin"` (texto de auditoria "Reenvio de acesso pela V3 (ADMIN)") e grava em `new_data.por` o id do ADMIN que pediu.
  - `app/api/profile/reset-password/route.ts` (#437) e `dominioComMarcaPronta` em `lib/recuperar-senha.ts` (#435): passam a usar `.dominio` do novo retorno, sem outra mudança.
  - `components/usuarios/users-client.tsx`: o texto da confirmação e o aviso de resultado passam a depender do caso, sem a afirmação "redefinirá a senha para 12345678" quando não for verdade.
- Tabelas afetadas: nenhuma estrutura. Grava as mesmas linhas de `audit_logs` do #435 (`recuperar_senha_reserva` e `recuperar_senha_enviado`), agora com `por`.
- Rotas afetadas: `POST /api/usuarios/reenviar-email` (só ADMIN, como hoje).
- APIs e integrações afetadas: Supabase Auth (`generateLink` em vez de trocar a senha, para a equipe Enterprise) e Resend.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Usuários (ADMIN) → linha do usuário → botão "Reenviar e-mail".
- Confirmação antes de enviar (diálogo interno `confirmar`):
  - alvo com role ENTERPRISE: "Reenviar acesso para <e-mail>? Se o domínio da marca dele estiver ativo, ele recebe um link para criar a senha, com a marca do Enterprise, e a senha atual não muda. Se não estiver, a senha é redefinida para 12345678 e vai o e-mail da V3.";
  - demais papéis: o texto de hoje.
- Aviso depois do envio (`aviso`):
  - pelo link da marca: "Link para criar senha enviado para <e-mail>, com a marca <nome da marca>. A senha atual não mudou.";
  - pelo fluxo atual: "E-mail enviado com sucesso para <e-mail>!" (hoje);
  - limite (429): "Já foi enviado um link há pouco para este usuário. Aguarde alguns minutos.";
  - falha (500): "Não foi possível enviar o e-mail agora. Tente de novo em instantes.".
- Usuário da AGS: recebe "Redefinir sua senha" de "AGS Finance" <naoresponda@agsfinance.app>, botão "Criar nova senha", depois agsfinance.app/auth/confirm, "Continuar" e a tela de nova senha da AGS. Ao salvar, `/api/auth/change-password` desliga a troca obrigatória, se estiver ligada.
- Estado vazio: não se aplica.
- Nota do porquê: o próprio texto da confirmação explica o que acontece com a senha.

## DEPENDENCIES
- Deve existir antes: PRs #435 e #437, no ar.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - para usuário da equipe Enterprise com domínio pronto, o botão deixa de trocar a senha. Quem usava o botão para "derrubar" uma senha antiga não tem mais esse efeito nesses usuários; a senha antiga continua valendo até ele criar outra;
  - para bloquear o acesso existe "Desativar usuário", que não muda;
  - para os demais usuários, nada muda.
- Segurança: a mudança **reduz** a exposição, porque para esses usuários a senha deixa de ir escrita no e-mail e deixa de ser uma senha fixa conhecida. O link é de uso único e de vida curta.
- LGPD e compliance: o e-mail vai só ao titular, para o e-mail do `auth.users`. O remetente com o nome da AGS é o mesmo ponto aberto com o Robson no #434, #435 e #437 (domínio registrado pela V3, sem autorização escrita da AGS); este BRIEF estende o uso a mais um botão. [VALIDAR COM ROBSON], ver Parecer.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem alteração. A rota continua exigindo sessão com role ADMIN. O `userId` vem do corpo, como hoje, mas só o ADMIN chega nele. A service role fica só no servidor.
- Rate limit: o teto compartilhado do #435 vale aqui. O ADMIN que clicar duas vezes em menos de 1 minuto recebe 429. Se alguém tiver repetido o "Esqueci a senha" do usuário, o ADMIN também pode receber 429 por até 1 hora. Nesse caso a saída é o usuário entrar por app.v3partners.com.br/esqueci-senha (fluxo V3), registrada como aceita, igual no #435.
- Teto por IP: o pedido do ADMIN vai sem IP (`null`), para que o ADMIN que reenvie a vários usuários do escritório não esbarre no teto de 20 por IP dos pedidos anônimos. O teto por usuário (10 reservas por hora, 1 envio a cada 60 s, 5 por hora) continua valendo, e por isso o texto do 429 fala "para este usuário".
- Confirmação sem saber o caminho: a tela não sabe de antemão se o domínio do Enterprise está pronto. Por isso, para role ENTERPRISE, a confirmação explica os dois casos e usa o estilo de perigo, com o botão "Reenviar acesso". O aviso depois do envio diz qual caminho foi seguido. Mostrar o estado do domínio na lista foi descartado por exigir mais uma consulta por linha.
- Erro de consulta (perfil do alvo ou domínio): responde 500 e **não** cai no fluxo antigo, para não mandar a senha fixa e o e-mail da V3 a um usuário da AGS por uma falha momentânea.
- Performance: mais 4 a 5 consultas numa ação manual. Desprezível.
- Vercel timeout (60s): não se aplica.
- Outro: a decisão acontece **antes** da troca de senha, para que nenhum caminho troque a senha e depois mande o link.

## APPROACH
- Abordagem escolhida: reaproveitar `dominioProntoDoMaster` e `enviarLinkDaMarca` (do #437) na rota do ADMIN. Para a equipe Enterprise, o "reenviar" vira o envio de um link de criação de senha. O template, o rate limit e as telas já estão auditados e em produção.
- Alternativas descartadas:
  - Só trocar o visual do e-mail atual para a marca da AGS: a senha fixa continuaria indo escrita no e-mail, agora com o nome da AGS.
  - Gerar uma senha temporária aleatória, como faz o convite de `/api/enterprise/usuarios`: continua mandando senha por e-mail e derruba a senha atual sem necessidade.
  - Tirar a senha fixa de todos os usuários da V3 neste mesmo PR: mexe no cadastro de partners e em `lib/email.ts`, fora do white label. Fica para BRIEF próprio.
  - Dar ao master Enterprise um botão "Reenviar acesso" na aba /enterprise: é útil, mas cria uma ação nova para outro papel. Fica para depois, se o Hamilton quiser.

## DESENHO TÉCNICO
```ts
// lib/recuperar-senha.ts
// OrigemPedido = "anonimo" | "perfil" | "admin"
// NOME_AUDITORIA.admin = "Reenvio de acesso pela V3 (ADMIN)"
// enviarLinkDaMarca(db, perfil, dominio, ip, origem, extra?: { por?: string })
//   new_data das duas linhas = { evento, ...(extra?.por ? { por: extra.por } : {}) }

//   a linha "enviado" passa a conferir o error do insert e faz console.error (com o id) se falhar.
// dominioProntoDoMaster passa a devolver { dominio, nome } | null, em que nome =
//   white_label_nome || full_name do master || "do Enterprise". O #435 e o #437 usam só .dominio.

// lib/recuperar-senha-regras.ts (pura, testável)
// caminhoReenvio(leitura: { erro: boolean; perfil: { id; role; enterprise_id } | null })
//   : { tipo: "erro" } | { tipo: "marca"; masterId } | { tipo: "antigo" }
//   erro → "erro"; perfil ENTERPRISE e daEquipe(perfil, enterprise_id ?? id) → "marca"; senão "antigo"

// app/api/usuarios/reenviar-email/route.ts — depois de validar ADMIN e o userId, ANTES do PUT da senha,
// TUDO dentro de um try:
//   { data, error } = profiles(id, role, enterprise_id, full_name).eq("id", userId).maybeSingle()
//   c = caminhoReenvio({ erro: !!error, perfil: data })
//   c.tipo === "erro" → 500, sem trocar senha
//   c.tipo === "marca":
//     alvo = await dominioProntoDoMaster(svc, c.masterId)       // lança em erro → catch → 500
//     if (alvo) {
//       r = await enviarLinkDaMarca(svc, perfil, alvo.dominio, null, "admin", { por: user.id })
//         // IP null: o ADMIN não entra no teto por IP dos pedidos anônimos; o teto por usuário vale.
//         // O IP do ADMIN fica registrado em new_data.ip_admin (extra: { por, ipAdmin }).
//       "enviado" → 200 { ok, modo: "link_marca", marca: alvo.nome, emailEnviado }
//       "limite"  → 429 { error: "Já foi enviado um link há pouco para este usuário. Aguarde alguns minutos." }
//       "falha"   → 500 { error: "Não foi possível enviar o e-mail agora. Tente de novo em instantes." }
//     }
//     domínio não pronto → segue para o fluxo antigo
//   catch → 500 com a mesma mensagem (console.error só com o id); nunca segue para a senha fixa
// Só "perfil inexistente", "papel diferente de ENTERPRISE" ou "domínio não pronto" seguem para o
// fluxo atual sem mudança, que passa a devolver também modo: "senha_temporaria".

// components/usuarios/users-client.tsx
//   confirmação: texto por papel (UX acima); para role ENTERPRISE usa
//     confirmar(texto, { perigo: true, botao: "Reenviar acesso" }), porque um dos caminhos troca a senha
//   resultado: data.modo === "link_marca" → aviso do link; 429/500 → data.error; senão o aviso de hoje
```
Reversão: reverter o PR. Não há migration.

## PLANO DE TESTE
- Testes unitários (`npm run test:unit` nos arquivos de recuperação e remetente) e o build da Vercel. Teste novo de `caminhoReenvio`:
  - erro na leitura do perfil dá "erro", que a rota responde com 500 e sem PUT de senha;
  - perfil nulo dá "antigo";
  - papel PARTNER dá "antigo";
  - master ENTERPRISE dá "marca" com o próprio id;
  - membro da equipe dá "marca" com o id do master.
- Em produção, o Hamilton (ADMIN) usa a tela Usuários. O agente não faz login:
  - "Reenviar e-mail" no usuário de teste da AGS (07668ecf-…): aparece o aviso "Link para criar senha enviado...". O agente confere no Resend que saiu de "AGS Finance" com o link de agsfinance.app/auth/confirm, e no `audit_logs` que há uma linha "enviado" com `por` = o ADMIN. Que a senha **não** mudou é conferido pelo Hamilton: a senha antiga do usuário de teste continua entrando até ele criar outra;
  - clicar de novo logo em seguida: 429 com o aviso de limite;
  - num usuário V3 de teste: o comportamento de hoje (não testar em partner real);
  - regressão do #435 e do #437: um pedido em agsfinance.app/esqueci-senha e um "Redefinir senha" do perfil continuam saindo pela marca (conferir no Resend que o link é https://agsfinance.app/auth/confirm);
  - na revisão do código do PR, conferir que o PUT da senha só existe depois do bloco `try` da decisão.
- Não testável pelo agente: o clique no link e a criação da senha, que ficam com o Hamilton.

## ESTIMATE
S. Cerca de 40 minutos. Confiança alta.

## PARECER DE COMPLIANCE
É o mesmo ponto aberto com o Robson desde o #434, o #435 e o #437, ainda sem resposta: e-mail com o nome da AGS saindo de domínio registrado pela V3, sem autorização escrita da AGS e sem canal de resposta. Este BRIEF não cria dado pessoal novo nem destinatário novo, e deixa de mandar senha por e-mail a esses usuários. [VALIDAR COM ROBSON] continua pendente.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 26/11/2026: BLOQUEADO, com 2 falhas.
1. Compliance: o ponto com o Robson continua aberto.
2. Falha fechado: um erro na leitura do perfil do alvo cairia na senha fixa.

A falha 2 foi corrigida nesta versão. A leitura agora fica dentro do `try`, usa `maybeSingle` e responde 500 em caso de erro, com a decisão na função pura `caminhoReenvio` e teste unitário.

Sugestões aplicadas:
- IP `null` para o ADMIN;
- nome da marca vindo do master, com reserva "do Enterprise";
- confirmação no estilo de perigo para role ENTERPRISE;
- log quando a gravação "enviado" falhar.

O travessão no assunto do e-mail da V3 fica para o BRIEF da senha fixa.

Rodada 2, 26/11/2026: BLOQUEADO só por compliance (o mesmo ponto do Robson). Parte técnica em ordem. Sugestões aplicadas: arquivos do #435/#437 listados no impacto, IP do ADMIN gravado em `new_data.ip_admin`, regressão do #435/#437 e conferência do PUT no plano de teste.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO só por compliance (rodadas: 2)
- Override: aguardando "go mesmo assim" do Hamilton (registrado como override dele, explicitamente) ou do João
- Go dado por: (pendente)
- Migration aplicada em produção: não se aplica
