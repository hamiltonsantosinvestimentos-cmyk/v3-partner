# BRIEF: ADMIN configura marca e domínio do white label do Enterprise em nome do master

> Data: 2026-11-19 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO PELO QA (rodada 5, com adendo), aguardando go do adendo
> Salvar em `docs/briefs/2026-11-19_admin-configura-white-label-enterprise.md` e commitar junto com o código.

## CONTEXTO
- Primeiro cliente Enterprise com contrato assinado (informado pelo Hamilton em 19/11): master **Marciano Nunes do Nascimento** (profile `57375034…`, cadastro `a7d6734b…` APROVADO em 10/11, acesso ativo até 11/11/2027).
- Situação em 19/11/2026 (leitura no banco): `white_label_nome`, `white_label_logo_url` e `white_label_dominio` vazios, e 0 de 10 usuários.
- Hoje marca, domínio e usuários só podem ser configurados pelo próprio master no painel `/enterprise` (todas as rotas `app/api/enterprise/*` usam `exigirEnterprise({ somenteMaster: true })` e o id de quem está logado).
- Decisão do Hamilton (19/11, no chat): **a V3 configura por ele**.
- Marca recebida em 19/11 (pacote do designer + Manual de Uso da Marca v1.0): nome **AGS Finance**; logo a usar: `AGS_Finance_logo_negativa_sem-registro_1000px.png` (PNG transparente, letras brancas e ponto verde). Motivo: o logo do white label substitui o logo V3 em fundos navy (plataforma, login, e-mails, capa de PDF), e o manual manda usar a versão negativa em fundo escuro e a versão sem ® enquanto não houver registro vigente no INPI. Cópia em `Desktop\AGS_Finance_white_label\`.

## MUDANÇAS DA RODADA 1 PARA A 2
- **Usuários saíram do escopo** (opção (b) do QA): o cadastro de usuários pela V3 depende do parecer do Robson e vai para um BRIEF próprio. No modo ADMIN, a aba Usuários fica **escondida**, e `usuarios/route.ts` não muda. **(Superado pelo ADENDO de 20/11: a aba aparece só leitura.)** Com isso, a falha 1.4 (telefone) deixa de se aplicar a este BRIEF e fica registrada para o próximo.
- Auditoria com `logAuditStrict`, `user_id` do ADMIN, sem "user agent", e lista fechada de escritas logadas.
- Modal vermelho em Remover domínio e Remover logo.
- RLS de `profiles`: ver RISKS, item de segurança.
- Plano de teste de acesso completo.
- Sugestões do QA incorporadas: href do PDF, ACCESS no log, textos em terceira pessoa, faixa em Ouro V3, ordenação declarada, titular do domínio.

## ADENDO 20/11/2026: ADMIN vê a equipe do master (pedido do Hamilton)
Mensagem do Hamilton (20/11, no chat, durante o código): "lembrando que o admin tem que ver tudo e também o enterprise do master e os usuários cadastrados abaixo".
Mudança de escopo (só leitura):
- No modo ADMIN, a aba **Usuários** deixa de ser escondida e aparece **somente leitura**: lista (nome, e-mail, telefone, % de repasse, situação, data de criação), na ordem atual (`created_at` crescente), com o contador "{n} de 10". Sem formulário de novo usuário, sem editar %, sem bloquear/reativar. Texto no topo da aba: "Somente leitura no modo ADMIN. O cadastro de usuários pela V3 aguarda o parecer de compliance."
- `GET /api/enterprise/usuarios` passa a aceitar o modo ADMIN (`permitirAdmin: true`) e registra `ACCESS` em `audit_logs` (`logAudit` comum, `via_admin`), por ser leitura de dado pessoal de terceiros. `POST` e `PATCH` continuam **sem** modo ADMIN (403 com `?master`).
- Faixa do modo ADMIN: a mesma do UX (texto único).
- Compliance: não há dado novo exposto. O ADMIN já lê todos os perfis em `/usuarios` (`GET /api/usuarios`, só ADMIN); a aba mostra os mesmos campos, filtrados pela equipe do master. O [VALIDAR COM ROBSON] sobre **cadastro** pela V3 continua valendo e fora deste BRIEF.
- Telefone na lista: formatado como +55 (XX) XXXXX-XXXX quando possível; vazio = "Não informado".
- Teste: ADMIN com `?master` no `GET /api/enterprise/usuarios` = 200 com a lista da equipe e linha `ACCESS` no log; `POST`/`PATCH` com `?master` = 403; aba sem botões de ação.

## SCOPE
Permitir que um **ADMIN** abra o painel `/enterprise` de um master específico e configure **marca (nome + logo) e domínio** em nome dele, reaproveitando as telas e as rotas que já existem, com aviso visível de "modo ADMIN" e cada escrita registrada em `audit_logs` de forma obrigatória. Repasses: o ADMIN só **visualiza**. Usuários: **só leitura** no modo ADMIN (adendo de 20/11); cadastro e edição pela V3 ficam fora.

## IMPACT
- Arquivos afetados:
  - `lib/enterprise-server.ts`: `exigirEnterprise` ganha os parâmetros opcionais `req` e `permitirAdmin`. Se vier `?master=<uuid>` na URL **e** o perfil do logado (lido do banco com service role) tiver `role = 'ADMIN'`, carrega o contexto do master informado (precisa ter `role = 'ENTERPRISE'` e `enterprise_id IS NULL`, senão 404) e devolve `userId = masterId` mais `admin: { id, nome }`. Sem `?master`, o comportamento é exatamente o de hoje. `?master` enviado por quem não é ADMIN, ou para rota sem `permitirAdmin`: 403 (nunca ignora em silêncio). Sem sessão: 401.
  - `app/api/enterprise/marca/route.ts`: `GET` e `POST` com `permitirAdmin: true`. No modo ADMIN, o `POST` grava o log **antes** da escrita com `logAuditStrict` (se o log falhar, devolve 500 "Não foi possível registrar a alteração no log. Nada foi alterado." e não altera nada).
  - `app/api/enterprise/dominio/route.ts`: `GET`, `POST` e `DELETE` com `permitirAdmin: true`. No modo ADMIN, `POST` e `DELETE` gravam o log **antes** de chamar a Vercel e de alterar `profiles`, com `logAuditStrict` (mesma regra: log falhou, nada acontece).
  - `app/api/enterprise/repasses/route.ts` (`GET`) e `repasses/pdf/route.ts`: aceitam o modo ADMIN, só leitura. `PATCH` (marcar pago) continua `somenteMaster`, **sem** modo ADMIN (403 com `?master`).
  - `app/api/enterprise/usuarios/route.ts`: `GET` com `req` e `permitirAdmin: true` (só leitura; registra `ACCESS`); `POST` e `PATCH` com `req` e **sem** `permitirAdmin` (403 com `?master`).
  - `PATCH` de repasses: `req` **sem** `permitirAdmin` (403 com `?master`).
  - `GET /api/enterprise/dominio` (modo ADMIN): a sincronização automática de `white_label_dominio_status` e `white_label_dominio_atualizado_em` com a Vercel continua como hoje e **fica fora do log** (é atualização de status lida da Vercel, não alteração feita pelo ADMIN).
  - `app/(platform)/enterprise/page.tsx`: lê `searchParams.master`. Se o logado for ADMIN, monta o contexto do master e mostra a faixa de aviso. Se não for ADMIN, ignora o parâmetro e mostra só o próprio contexto (nunca o do master informado).
  - `components/enterprise/enterprise-client.tsx`: recebe `masterId?: string` e `masterNome?: string`. **Todas as URLs para `/api/enterprise/*` acrescentam `?master=<id>`**, inclusive o `href` do PDF de repasses. No modo ADMIN: mostra a aba Usuários **sem ações** (sem formulário de novo usuário, sem editar %, sem bloquear/reativar), esconde os botões de marcar pago na aba Repasses e troca os textos que falam com o master para terceira pessoa ("A equipe de {master}…"). Remover domínio e Remover logo passam a usar `confirmar(..., { perigo: true, titulo, botao })` **em qualquer modo** (master ou ADMIN).
  - `components/usuarios/users-client.tsx`: na linha de um usuário `ENTERPRISE` **master** (`enterprise_id` vazio), botão "Configurar white label" que abre `/enterprise?master=<id>`.
  - `tests/unit/enterprise-admin-modo.test.ts` (novo).
- Tabelas afetadas: nenhuma alterada (sem DDL). Escrita em `profiles` (só `white_label_nome`, `white_label_logo_url`, `white_label_dominio`, `white_label_dominio_status`, `white_label_dominio_atualizado_em` do master, os mesmos campos de hoje) e inserção em `audit_logs`.
- Rotas afetadas: `/enterprise` (parâmetro `?master=`), `GET/POST /api/enterprise/marca`, `GET/POST/DELETE /api/enterprise/dominio`, `GET /api/enterprise/repasses`, `GET /api/enterprise/repasses/pdf` e `GET /api/enterprise/usuarios` (aceitam `?master=` só para ADMIN); `POST`/`PATCH /api/enterprise/usuarios` e `PATCH /api/enterprise/repasses` recusam `?master` (403).
- APIs e integrações afetadas: Vercel (cadastro e remoção de domínio, igual hoje) e Storage bucket `white-label` (logo, igual hoje).

## AUDITORIA (lista fechada)
Toda escrita no modo ADMIN usa `logAuditStrict`, gravado antes da escrita:

| Ação | action | entity | entity_id | new_data |
|---|---|---|---|---|
| Salvar nome da marca e/ou logo | UPDATE | profiles | master | campos alterados + `via_admin` |
| Remover logo | UPDATE | profiles | master | `{ white_label_logo_url: null }` + `via_admin` |
| Cadastrar ou trocar domínio | UPDATE | profiles | master | `{ white_label_dominio, anterior }` + `via_admin` |
| Remover domínio | DELETE | profiles | master | `{ white_label_dominio: null, anterior }` + `via_admin` |
| Abrir o painel do master (page) | ACCESS | profiles | master | `{ via_admin }` (com `logAudit` comum: leitura não bloqueia) |
| Baixar o PDF de repasses do master | EXPORT | profiles | master | `{ mes, via_admin }` (com `logAudit` comum) |
| Ver usuários da equipe | ACCESS | profiles | master | `{ via_admin, total }` (com `logAudit` comum) |

- Se a escrita falhar depois do log (erro da Vercel ou do update), grava um segundo registro com `logAudit` comum, mesma ação, `new_data.resultado = "falhou"` e a mensagem de erro. O primeiro registro leva `new_data.resultado = "tentativa"`.

- `user_id` = id do **ADMIN**; `user_name` = nome do ADMIN. Assim, a busca por pessoa na tela Usuários atribui a ação ao ADMIN, nunca ao cliente.
- `via_admin` = `{ master_id, master_nome }`.
- `old_data` = valores anteriores dos mesmos campos.
- `ip_address` = `getClientIp(req)`. User agent **não** é gravado (a tabela não tem a coluna).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: menu **Usuários** (ADMIN) → linha do master Enterprise → botão **"Configurar white label"** (ícone de paleta, junto das ações da linha). Só aparece para master (`role ENTERPRISE` e sem `enterprise_id`).
- Ao abrir: o painel `/enterprise` com as abas **Marca, Domínio, Usuários (só leitura) e Repasses** e uma faixa fixa no topo em Ouro V3 (`#C9A84C` sobre `#162744`): **"Modo ADMIN: você está vendo o Enterprise de {master} e configurando marca e domínio. Cada alteração fica registrada no log com o seu nome."** e link "Voltar para Usuários".
- Aba Marca: nome da marca + upload do logo (PNG, JPG, WEBP ou SVG até 2 MB), como hoje. **Remover logo** abre modal vermelho: título "Remover logo", texto "Remover o logo de {marca}? A plataforma, os PDFs e os e-mails da equipe voltam a mostrar só o nome.", botão "Remover logo".
- Aba Domínio: campo do domínio + instruções de DNS (CNAME), como hoje. **Remover domínio** abre modal vermelho: título "Remover domínio", texto (modo ADMIN) "Remover o domínio de {master}? A equipe dele deixa de acessar por {dominio} e passa a usar app.v3partners.com.br." (modo master: "Remover o domínio? Sua equipe deixa de acessar por {dominio}…"), botão "Remover domínio". O modal só fecha pelos botões.
- Aba Repasses: só leitura no modo ADMIN, com o texto "Somente o master marca repasses como pagos." O PDF abre com o contexto do master.
- Ordenação (sem mudança, declarada): resumo por usuário em pendente decrescente e depois total decrescente; linhas de repasse em `created_at` decrescente.
- Erro de log: aviso na tela "Não foi possível registrar a alteração no log. Nada foi alterado. Tente de novo."
- Estado vazio: master sem marca mostra "Enterprise" no título e o formulário em branco; sem domínio, a aba mostra o estado vazio atual, e a plataforma segue em `app.v3partners.com.br` já com a marca; sem repasses, "Nenhum repasse ainda".
- Para o cliente: nada muda na tela dele, a não ser que marca e domínio aparecem preenchidos. O modal vermelho em Remover logo e Remover domínio vale também para ele.
- Nota do porquê (tooltip) no botão: "Preenche a marca e o domínio em nome do master. Use quando o cliente pedir que a V3 configure."

## DECISÃO DO DOMÍNIO (Hamilton, 19/11/2026: opção 1, "eu vou contratar aqui")
O Hamilton registra o `.com.br` no Registro.br. Depois, o ADMIN cadastra o domínio na aba Domínio e aponta o CNAME no Registro.br. Até lá, a marca vale em `app.v3partners.com.br`.
- **Titular do registro: a definir pelo Hamilton.** Se for o CPF/CNPJ do cliente, o registro só acontece **depois da resposta do Robson** à pergunta (3) do Parecer de compliance. Se for o CNPJ da V3, o domínio é da V3, e precisa ser transferido se a parceria acabar (combinar com o cliente).
- Opções avaliadas e descartadas: `.com` comprado na Vercel (ela não vende `.com.br`, e o domínio ficaria na conta da V3) e começar sem domínio (vale só até o registro sair).

## DEPENDENCIES
- Deve existir antes: tudo do PR #187 (colunas `white_label_*`, bucket `white-label`, `lib/vercel-dominios.ts`, env vars da Vercel em Production): existe e está LIVE. `lib/audit.ts` com `logAuditStrict` e entity `profiles`: existe. `confirmar(..., { perigo: true })` em `lib/aviso.ts`: existe.
- Migrations pendentes: nenhuma.
- Prazo: entrega em até 15 dias corridos da confirmação do pagamento da entrada (item 3.14.1 da Parceria v2.4). **Data do pagamento da entrada: a confirmar pelo Hamilton** antes do go.

## RISKS (nunca "nenhum")
- Breaking changes: `exigirEnterprise` é usado por todas as rotas Enterprise. Sem `?master`, o caminho fica idêntico ao de hoje (coberto por teste). Um erro na checagem de role abriria o painel de um master para outro usuário, por isso a regra é "só `role = 'ADMIN'` lido do banco com service role, nunca de metadata ou de parâmetro", com teste do caso Enterprise A → B. O modal vermelho também muda a experiência do master (passa a pedir confirmação para remover logo).
- LGPD e compliance: neste escopo, o ADMIN só altera marca e domínio (não são dados pessoais) e **vê os repasses** do master (nomes e e-mails dos usuários e valores) e a **lista de usuários da equipe** (nome, e-mail, telefone), com `ACCESS` no log, conforme o adendo. Repasses já são vistos pela V3 no fluxo de comissões. Cadastro de usuários fica fora até o parecer do Robson.
- Segurança de acesso ao banco (anon, RLS, views, funções): nenhuma mudança de RLS, policy, view, função ou grant; nada novo exposto ao `anon`. A rota usa service role no servidor depois de checar sessão e role. **Prova do 6.5: colada em PROVA DO BANCO (19/11), o banco já concede ao ADMIN select e update de qualquer perfil.** Texto original do pedido: não consegui ler `pg_policies` desta sessão (sem CLI nem conector de banco). O Hamilton roda no SQL Editor do Supabase e cola o resultado aqui:
  `select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename='profiles';`
  Precedente no código: `app/api/usuarios/[id]/route.ts` já deixa o ADMIN alterar e excluir qualquer perfil pela service role, depois de checar `role = 'ADMIN'` (linha 29). Se a RLS não conceder ao ADMIN o update de `profiles`, fica registrada a exceção para aceite do Hamilton ou do João: o modo ADMIN não amplia o que a tela Usuários já permite ao ADMIN hoje.
- Performance: uma leitura a mais de `profiles` por chamada no modo ADMIN. Desprezível.
- Outro: o domínio cadastrado no modo ADMIN entra no projeto da Vercel da V3 (igual hoje). O logo continua em bucket público (é a marca do cliente, não dado pessoal).

## APPROACH
- Abordagem escolhida: **modo ADMIN no painel que já existe** (`?master=<id>`), reaproveitando rotas e validações (logo até 2 MB, domínio único, status na Vercel). Pouco código, uma regra de acesso só, e a mesma tela que o cliente vê.
- Alternativa descartada 1: **tela nova de ADMIN** com formulários próprios. Duplica validações, e as duas versões iriam divergir.
- Alternativa descartada 2: **UPDATE manual no banco** para este cliente. Não cadastra o domínio na Vercel e não deixa rastro de auditoria.
- Alternativa descartada 3: **"entrar como" o master** (impersonar a sessão). Dá acesso a tudo dele e é difícil de auditar.

## DESENHO TÉCNICO
```ts
// lib/enterprise-server.ts
export async function exigirEnterprise(opts: { somenteMaster?: boolean; req?: NextRequest; permitirAdmin?: boolean } = {})
// 1. user = auth.getUser(); sem user -> 401
// 2. masterParam = opts.req?.nextUrl.searchParams.get("master")
// 3. se masterParam:
//      - !opts.permitirAdmin -> 403 "Ação disponível só para o master"
//      - perfil do logado (service role) role !== 'ADMIN' -> 403
//      - masterParam não é uuid -> 400
//      - alvo = profiles where id = masterParam; inexistente, role !== 'ENTERPRISE' ou enterprise_id não nulo -> 404 "Master Enterprise não encontrado"
//      - ctx = contextoEnterprise(db, alvo); return { ok, userId: alvo.id, nome: alvo.full_name, ctx, db, admin: { id: user.id, nome } }
// 4. sem masterParam: fluxo atual, admin = null
```
- Sem migration e sem SQL de reversão. Reversão = reverter o PR.
- Role: só `ADMIN`. `GESTAO`, `MESA_OPERACIONAL` e os demais não usam o modo.

## PLANO DE TESTE
- Unitário (`tests/unit/enterprise-admin-modo.test.ts`), regras de `exigirEnterprise`:
  1. ADMIN + master válido = ok, com `admin` preenchido.
  2. ADMIN + id de usuário filho (não master) = 404.
  3. ADMIN + uuid inexistente = 404; valor que não é uuid = 400.
  4. Sem sessão com `?master` = 401 (rotas e página).
  5. Master Enterprise A com `?master=B` = 403, sem nenhum dado de B na resposta.
  6. Usuário filho de Enterprise com `?master` = 403.
  7. PARTNER, GESTAO e MESA_OPERACIONAL com `?master` = 403.
  8. Master sem `?master` = fluxo atual (regressão).
  9. `POST` e `PATCH` de `/api/enterprise/usuarios` e `PATCH` de repasses com `?master` = 403.
  9b. `GET /api/enterprise/usuarios` com `?master` por ADMIN = 200 só com a equipe do master e linha `ACCESS` no log; por não ADMIN = 403.
  9c. Aba Usuários no modo ADMIN não renderiza formulário nem botões de ação; estado vazio "Nenhum usuário ainda (0 de 10)".
  10. Modo ADMIN com falha simulada do `logAuditStrict` = 500 e nenhuma alteração em `profiles` nem chamada à Vercel.
- Página: `/enterprise?master=B` aberto por quem não é ADMIN mostra só o próprio contexto (ou "Disponível apenas para Enterprise"), nunca o de B.
- Regressão: PDF de repasses no modo ADMIN abre com os dados do master; no modo master, igual a hoje.
- Manual em produção, depois do deploy, **com master de teste criado pela V3** (nunca no cliente real primeiro): ADMIN salva nome e logo, remove o logo (modal vermelho), confere a faixa e as linhas em `audit_logs` (user_id do ADMIN, `via_admin`); desativa e apaga o master de teste.
- Depois, configurar o cliente real com a marca e o logo enviados pelo Hamilton e conferir no login do master.
- Não testável localmente: cadastro do domínio na Vercel (depende do token de produção).

## ESTIMATE
M. Cerca de 2 a 3 horas com testes e verificação em produção. Confiança alta (rotas e telas já existem).

## PARECER DE COMPLIANCE
- Neste escopo (marca, domínio, leitura de repasses e leitura da lista de usuários da equipe com `ACCESS` no log, conforme o adendo), não há tratamento novo de dado pessoal: nome de marca, logo e domínio são dados do negócio do master; repasses já são acessados pela V3 no fluxo de comissões. Parecer aplicável: Robson, 10/11/2026 21:28 ([[project-enterprise-white-label]]): "LGPD responsabilidade da V3 a partir da entrada na plataforma; usuários = intermediação"; item 6.8 da Parceria v2.4.
- **Fora deste BRIEF, para o próximo, [VALIDAR COM ROBSON]:** (1) a V3 pode cadastrar os usuários do Enterprise a partir de uma lista enviada pelo master por WhatsApp/e-mail (base legal sugerida: execução de contrato, art. 7º V)? (2) texto do convite que diga quem criou o acesso (ex.: "{master} solicitou, e a equipe {marca} criou seu acesso"), por transparência (art. 6º VI); (3) se o domínio for registrado com o CPF/CNPJ do cliente, a V3 pode usar o documento dele para isso? O telefone dos usuários, nesse BRIEF, segue a falha 1.4 da rodada 1 (máscara +55 fixo, DDD validado, E.164 no servidor).

## PROVA DO BANCO (19/11/2026, consulta rodada pelo Hamilton no SQL Editor, colada no chat)
Políticas de `profiles` (RLS ligada: sim):
- `profiles_select_admin` | SELECT | {public} | USING: `get_user_role() = 'ADMIN'`
- `profiles_select_own` | SELECT | {public} | USING: `id = auth.uid()`
- `profiles_update_admin` | UPDATE | {public} | USING: `get_user_role() = 'ADMIN'`
- `profiles_update_own` | UPDATE | {public} | USING: `id = auth.uid()`
Conclusão para o 6.5: o banco já concede ao ADMIN leitura e update de qualquer perfil. O modo ADMIN não amplia o que o banco permite. Nenhuma política abre `profiles` a anon.
Achado fora do escopo (pré-existente): `profiles_update_own` não tem CHECK nem restrição de coluna aparente; em verificação separada (se o usuário consegue alterar o próprio `role`).

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (6 falhas: 1.4 telefone, 3.2 auditoria, 3.3 modal vermelho, 6.5 RLS de profiles, 6.8 testes de acesso, compliance em aberto). Correções nesta versão.

Rodada 2 de 6: BLOQUEADO (1 falha: 6.5, prova da RLS de `profiles` para ADMIN ainda não colada, e exceção não aceita). Todos os outros itens PASSARAM. Sugestões aplicadas depois da rodada: `req` em usuarios e no PATCH de repasses, sincronização do domínio fora do log, segundo registro em caso de falha, EXPORT do PDF, e-mail nos repasses, linha 29, registro do domínio com documento do cliente só depois do Robson.
Rodada 5 de 6: **LIBERADO PARA "GO"** (adendo integrado: aba Usuários só leitura e GET com modo ADMIN). Rodada 4: BLOQUEADO (adendo contradizia o corpo).

Rodada 3 de 6: **LIBERADO PARA "GO"** (zero falhas). Achado pré-existente `profiles_update_own` sem CHECK não bloqueia este BRIEF; vai para `docs/briefs/2026-11-20_rls-crm-insert-e-profiles-update-own.md` com prioridade máxima se a consulta confirmar a escalada.

Saída do 6.5 (rodada 2): (a) Hamilton cola o resultado de `pg_policies` mostrando SELECT e UPDATE de `profiles` para `get_user_role() = 'ADMIN'`, ou (b) João ou Hamilton registra o aceite da exceção 6.5 em "Override".

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 3)
- Override ("go mesmo assim"): não
- Go dado por: (pendente)
- Migration aplicada em produção: não se aplica (sem migration)

> Aguardando aprovação. Digite "go" para iniciar, "ajusta: <instrução>" para modificar, "cancela" para abortar.
