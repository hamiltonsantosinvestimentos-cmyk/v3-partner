# BRIEF: Link exclusivo de cadastro do plano V3 Enterprise (+ correções do formulário público)

> Data: 2026-11-09 | Autor: Claude (pedido do Hamilton) | Status: QA BLOQUEADO (rodada 4), 1 falha de compliance coberta por override
> Salvar em `docs/briefs/2026-11-09_cadastro-partner-enterprise.md` e commitar junto com o código.

## DECISÕES DO HAMILTON (09/11/2026, no chat, após a rodada 1 do QA)
1. CPF/CNPJ: corrigir o formulário público neste BRIEF (CNPJ alfanumérico, dígito verificador, aviso interno de duplicidade, sem bloquear o envio). Vale para todos os links que usam o formulário.
2. Telefone: o Enterprise, por enquanto, é **só para contraparte brasileira**. Sem DDI neste BRIEF.
3. Garantias: mostrar o bloco de garantias e a fidelidade quando o plano vem travado no link e é anual (Enterprise e V3 Access).
4. Preço confirmado: **R$ 49.896,96 ao ano** (o valor que já está no sistema: 12 x R$ 4.158,08). Comissão exibida: 55% (a mesma do sistema).
5. Garantia de retorno do Enterprise: o Partner PRO tem 1 acesso, e é o KPI desse acesso que vale para a garantia. O Enterprise tem 10 acessos, então o KPI de originação da garantia é **o KPI do Partner PRO multiplicado por 10**. Mensagens do Hamilton: "colocar garantia de retorno, considerando os 10 acessos e kpi de cada acesso" e "no caso do enterprise, são 10 acessos, o do pro é 1 acesso (que é considerado a garantia), no caso do enterprise é de 10 acessos, então tem que ser multiplicado por 10 acessos".

6. Meta da garantia do Enterprise: **somada dos 10 acessos** (mensagem do Hamilton: "meta somada dos 10 acessos").

## SCOPE
1. Link único de cadastro só do plano **V3 Enterprise**: `https://app.v3partners.com.br/cadastro-partner-enterprise`, com o plano travado (padrão de `/cadastro-partner-he`, `-gold`, `-diamante`, `-access`).
2. Correção de CPF/CNPJ no formulário público de cadastro de partner (máscara, validação de dígito, normalização no envio e na API, aviso interno de duplicidade (sem bloquear o envio), tipo do documento na cobrança Cora).
3. Bloco de garantias (fidelidade de 12 meses + garantia de retorno) no passo 1 quando o plano vem travado e é anual. Para o Enterprise, a garantia de retorno cita os 10 acessos e a meta somada (KPI do Partner PRO x 10).
4. Aviso de cobrança imediata na revisão, quando a forma escolhida é Pix/boleto à vista (sugestão do QA, rodada 1).

## IMPACT
- Arquivos afetados:
  - `app/cadastro-partner-enterprise/page.tsx` (novo, ~20 linhas): `<CadastroPartnerForm forcePlano="ENTERPRISE" />`, título e descrição próprios, `robots: noindex, nofollow`.
  - `lib/cadastro-partner/documento.ts` (novo, função pura sem I/O): `normalizarCnpj`, `mascaraCnpj` (progressiva, preserva letra e converte para maiúsculas durante a digitação; usa `formatCNPJ` de `lib/validators/cpf-cnpj.ts` quando o CNPJ está completo, sem segunda implementação) e `validarDocumentosCadastro(tipoPessoa, { cpf, cnpj, cpfSocio })` que devolve os documentos normalizados ou o erro por campo. Usa `isValidCPF` / `isValidCNPJ` de `lib/validators/cpf-cnpj.ts` (fonte única que já trata o CNPJ alfanumérico).
  - `components/cadastro-partner/cadastro-form.tsx`:
    - `fmtCNPJ` deixa de apagar letra (passa a usar `mascaraCnpj`).
    - Passo 3 só avança com CPF (PF) ou CNPJ e CPF do sócio (PJ) com dígito verificador válido. Mensagem de erro embaixo do campo: "CPF inválido. Confira os números." / "CNPJ inválido. Confira os caracteres.".
    - Envio: CNPJ vai normalizado (letras maiúsculas e dígitos, sem pontuação), nunca com `replace(/\D/g, "")`.
    - Passo 1 com plano travado anual e não trial: mostra o bloco de garantias (texto abaixo).
    - Passo de revisão com Pix/boleto à vista: aviso "Ao enviar, geramos agora a cobrança de {valor anual} por Pix ou boleto, com vencimento em 3 dias."
    - Texto genérico das garantias (link `-access` e `/cadastro-partner` público): troca o travessão de "Fidelidade de 12 meses — parceria" por dois-pontos.
  - `app/api/cadastro-partner/route.ts`:
    - Valida os documentos no servidor com `validarDocumentosCadastro` (400 se inválido; o 400 só diz que o dígito não confere, o que qualquer um calcula sozinho, e não revela nada sobre cadastro existente).
    - Grava `cnpj` normalizado (alfanumérico preservado).
    - Aviso de duplicidade, **sem resposta diferente para o candidato** (correção da rodada 2 do QA, enumeração de documento): depois de gravar, consulta `partner_registrations` (select de `id, status`) por outro registro com o mesmo documento e status `PENDENTE` ou `APROVADO` (PF: `tipo_pessoa = 'PF'` e `cpf`; PJ: `tipo_pessoa = 'PJ'` e `cnpj`). Achou: o alerta interno de novo cadastro (WhatsApp e e-mail ao Hamilton) ganha a linha "Atenção: este documento já tem cadastro {status} (id {8 primeiros caracteres}). Não aprovar em duplicidade." A resposta ao candidato, a gravação e a cobrança seguem exatamente iguais às de um cadastro novo, então a rota pública não revela se o documento já existe.
    - Cobrança Cora: o tipo do documento passa a vir do `tipo_pessoa` (PF = CPF, PJ = CNPJ), não da contagem de dígitos; `identity` vai normalizado (CNPJ com letra preservada).
  - `lib/socios-notify.ts`: `notifyNovoCadastroPartner` ganha o parâmetro opcional `duplicado?: { status: string; id: string }` e mostra a linha de atenção no e-mail e no WhatsApp internos.
  - `tests/unit/cadastro-documento.test.ts` (novo).
- Tabelas afetadas: nenhuma alterada (sem DDL). `partner_registrations` ganha uma **leitura** (deduplicação) e passa a receber `cnpj` alfanumérico quando for o caso (coluna texto; a constraint de `plano` já aceita `ENTERPRISE`, migration `20261022_gold_diamante_roles.sql`).
- Rotas afetadas: nova rota pública `/cadastro-partner-enterprise` (já liberada pelo prefixo `"/cadastro-partner"` em `PUBLIC_ROUTES` do `proxy.ts`, sem mudança no proxy). Comportamento novo em `POST /api/cadastro-partner`: 400 para documento inválido; duplicidade sem mudança na resposta, só aviso interno. Os links `/cadastro-partner`, `-access`, `-he`, `-gold`, `-diamante`, `-oferta` ganham a mesma validação.
- APIs e integrações afetadas: Cora (tipo e identidade do documento na cobrança). Resend e WhatsApp: só a linha de aviso de duplicidade no alerta interno ao Hamilton.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: o link `https://app.v3partners.com.br/cadastro-partner-enterprise`, enviado pela V3 ao interessado. Passo 1: "Plano V3 Enterprise", "Este link é exclusivo do plano V3 Enterprise.", card com R$ 49.896,96/ano ou 12x de R$ 4.158,08 sem juros no cartão, benefícios (inclui "White-label e co-branding completo"), **bloco de garantias** e escolha da forma de pagamento.
- Texto das garantias no Enterprise (sem travessão):
  - "**Fidelidade de 12 meses**: parceria de médio prazo, para dar tempo real de originação e resultado."
  - "**Garantia de retorno**: o Enterprise tem 10 acessos, então o KPI de originação é o do Partner PRO multiplicado por 10, somando a originação dos 10 acessos, conforme definido em contrato. Mantido esse KPI, se em 12 meses não houver retorno sobre o valor investido, devolvemos o seu investimento."
- No V3 Access (link `/cadastro-partner-access`, também anual com plano travado), o bloco aparece com o texto que o `/cadastro-partner` público já mostra hoje (sem a menção aos 10 acessos).
- Passo 3: erro embaixo do campo de CPF/CNPJ quando o dígito não confere; botão "Próximo" fica desabilitado até corrigir. CNPJ alfanumérico (ex.: `12.ABC.345/01DE-35`) é aceito e mantém as letras.
- Revisão: aviso da cobrança imediata quando a escolha é Pix/boleto.
- Envio com documento que já tem cadastro: para o candidato, nada muda (mesma tela de sucesso e pagamento). A equipe vê o aviso de duplicidade no alerta interno e não aprova o segundo cadastro.
- Estado vazio: não se aplica (formulário começa em branco).
- Do lado interno: o cadastro chega na fila de aprovação existente com o plano "V3 Enterprise", sem mudança.

## DEPENDENCIES
- Deve existir antes: `CadastroPartnerForm` com `forcePlano` (existe), plano `ENTERPRISE` em `PLANOS` (existe), `PLANO_VALOR.ENTERPRISE = 415808` (existe), `isValidCPF` / `isValidCNPJ` em `lib/validators/cpf-cnpj.ts` (existem, já tratam CNPJ alfanumérico), constraint de `plano` aceitando `ENTERPRISE` (existe).
- Migrations pendentes: nenhuma.
- Contrato: a cláusula da garantia de retorno (KPI de originação = KPI do Partner PRO x 10, meta somada da originação dos 10 acessos, prazo de 12 meses, devolução) **precisa estar no contrato do Enterprise**, e o KPI do Partner PRO precisa estar definido no contrato do PRO. Não encontrei essa cláusula nos geradores de contrato do repositório; a frase "definido em contrato" hoje só existe nas páginas e na apresentação. Ver RISKS.

## RISKS (nunca "nenhum")
- Promessa de devolução sem cláusula correspondente: a página promete devolver o investimento (R$ 49.896,96) sob condição de um KPI igual ao do Partner PRO multiplicado por 10, "conforme definido em contrato". O valor do KPI do PRO não existe no sistema nem no gerador de contrato. Se o contrato assinado não trouxer a cláusula com esse KPI (PRO x 10), a promessa da página fica sem critério objetivo.
- Meta somada (decisão 6): a garantia do Enterprise considera a originação **somada** dos 10 acessos contra 10 vezes a meta do PRO. Não é cada acesso cumprir sozinho a meta do PRO. A página diz isso explicitamente, e o contrato precisa repetir a mesma regra. Se o contrato disser outra coisa, a página e o contrato ficam em conflito. Mitigação: o texto não inventa número de KPI; a cláusula de contrato fica fora deste BRIEF e passa pelo `@contract-legal-guardian` e pelo quórum dos 3 sócios antes de o link ser divulgado. **Decisão para o João ou o Hamilton: divulgar o link só depois da cláusula pronta.** [VALIDAR COM ROBSON]: texto de garantia de devolução exibido em página pública de venda (oferta ao público, Código de Defesa do Consumidor/Código Civil).
- Breaking changes: sim, pequenos e intencionais. (a) Quem digitava CPF/CNPJ com dígito errado deixa de conseguir avançar em todos os links. (b) Cadastro repetido do mesmo documento continua entrando e gerando cobrança Cora (como hoje), agora com aviso de duplicidade para a equipe. Risco aceito: um segundo boleto aberto, que o candidato não paga e a equipe cancela; em troca, a rota pública não revela quem tem cadastro na V3. (c) A forma do `cnpj` gravado muda só para CNPJ alfanumérico (o numérico legado continua só com dígitos, igual a hoje).
- CNPJ alfanumérico na Cora: não confirmei se a API da Cora já aceita CNPJ com letra. Se recusar, `gerarCobrancaCora` já captura o erro: o cadastro é salvo sem cobrança e a equipe gera a cobrança manualmente (comportamento atual de falha da Cora). Não testável sem um CNPJ alfanumérico real.
- Enterprise continua aparecendo na lista do `/cadastro-partner` público. Com este BRIEF, os dois caminhos passam a mostrar garantias, mas no público a garantia é a genérica (sem os 10 acessos). Quem decide a remoção do Enterprise do público: João ou Hamilton, em outro BRIEF.
- Telefone: só formato brasileiro (decisão 2 acima). Contraparte estrangeira não consegue informar telefone com DDI.
- LGPD e compliance: nenhum dado pessoal novo é coletado nem exibido. A checagem de duplicidade roda no servidor e o resultado vai só para o alerta interno (Hamilton), nunca para quem enviou o formulário: a resposta da rota pública é a mesma com ou sem cadastro anterior, então não dá para descobrir por ela se um CPF ou CNPJ tem vínculo com a V3. A validação de dígito é local (sem consulta externa). A rota continua sem limite de chamadas e sem captcha (como hoje): alguém pode criar cadastros falsos com cobrança Cora em nome de terceiros. Esse risco é anterior a este BRIEF e fica para outro BRIEF.
- Cadastros antigos com máscara: a checagem de duplicidade usa igualdade, então só acha registros gravados no formato canônico. O formulário já grava só dígitos, mas `app/api/setup/partner-registrations` e `lib/v3-access.ts` também gravam na tabela. O plano de teste conta as linhas com máscara.
- Renovação na Cora (fora do escopo, anterior a este BRIEF): `app/api/cron/assinaturas-vencendo/route.ts` e `app/api/financeiro/assinaturas/route.ts` ainda usam `replace(/\D/g)` e decidem o tipo pela contagem de dígitos. Pelo fallback `cpf ?? cnpj`, a renovação de um cadastro PJ (Enterprise incluso) sai no CPF do sócio, não no CNPJ da empresa. Fica registrado para outro BRIEF.
- Segurança de acesso ao banco (anon, RLS, views, funções): nenhuma tabela, view, função, grant, política ou bucket novo. A leitura nova roda no `POST /api/cadastro-partner` com o service client que a rota já usa, no servidor. Nada novo vai ao navegador.
- Performance: +1 consulta por envio de cadastro (filtro por documento e status). Tabela pequena.
- Vercel timeout (60s): não se aplica (sem chamada ao Claude).
- Outro: a regra do tipo do documento na cobrança Cora muda para todos os planos anuais (antes contava dígitos; agora usa `tipo_pessoa`). Para documentos válidos o resultado é o mesmo.

## APPROACH
- Abordagem escolhida: página nova com `forcePlano="ENTERPRISE"` + correções no formulário e na API do cadastro, com a regra de documento numa função pura testável (`lib/cadastro-partner/documento.ts`) usada no navegador e no servidor.
- Alternativa descartada 1: `/cadastro-partner?plano=ENTERPRISE`. O parâmetro só pré-seleciona com `planosOferta` (linha 316 do formulário) e o candidato veria os outros planos.
- Alternativa descartada 2: link com token por cliente (uso único). Exige tabela e migration; o pedido é um link do plano, não um convite individual.
- Alternativa descartada 3: aceitar as falhas de CPF/CNPJ por override e corrigir depois. Descartada pelo Hamilton (decisão 1).
- Alternativa descartada 4: índice único no banco para o documento. Exige migration e falharia com os duplicados que já existem; a checagem na API resolve o caso novo sem DDL.

## DESENHO TÉCNICO
```ts
// lib/cadastro-partner/documento.ts (sem I/O)
export function normalizarCnpj(v: string): string            // [^0-9A-Za-z] removido, maiúsculas, até 14
export function mascaraCnpj(v: string): string               // progressiva: 12.ABC.345/01DE-35
export function validarDocumentosCadastro(
  tipo: "PF" | "PJ", d: { cpf?: string; cnpj?: string; cpfSocio?: string },
): { ok: true; cpf: string; cnpj?: string } | { ok: false; campo: "cpf" | "cnpj" | "cpf_socio"; erro: string }
// PF: cpf = isValidCPF -> só dígitos. PJ: cnpj = isValidCNPJ -> normalizarCnpj; cpf = cpf do sócio (isValidCPF).
```
API:
```ts
// antes do upload
const doc = validarDocumentosCadastro(tipoPessoa, { cpf, cnpj, cpfSocio }); if (!doc.ok) -> 400
// depois do insert (regId), sem mudar a resposta
const col = tipoPessoa === "PF" ? "cpf" : "cnpj"; const valor = tipoPessoa === "PF" ? doc.cpf : doc.cnpj;
const { data: dup } = await svc.from("partner_registrations").select("id, status")
   .eq("tipo_pessoa", tipoPessoa).eq(col, valor).in("status", ["PENDENTE", "APROVADO"]).neq("id", regId).limit(1);
// erro na consulta: segue sem o aviso (best-effort, como o próprio alerta)
notifyNovoCadastroPartner({ ..., duplicado: dup?.[0] ? { status: dup[0].status, id: dup[0].id.slice(0, 8) } : undefined })
```
Cora: `document: { identity: tipoPessoa === "PF" ? doc.cpf : doc.cnpj, type: tipoPessoa === "PF" ? "CPF" : "CNPJ" }`.
Garantias: no ramo `forcePlano`, renderizar o bloco quando `!p.mensal && !p.trial`; texto da garantia de retorno com os 10 acessos quando `p.id === "ENTERPRISE"`.
Sem migration, sem SQL de escrita. Roles: sem mudança.

## PLANO DE TESTE
- Unitário (`tests/unit/cadastro-documento.test.ts`): CPF válido/inválido/sequência repetida; CNPJ numérico válido; CNPJ alfanumérico válido preservando letras; CNPJ com dígito errado; máscara progressiva sem apagar letra; PJ sem CPF do sócio válido falha no campo `cpf_socio`.
- Typecheck (`tsc --noEmit`) sem erro nos arquivos do PR.
- Preview da Vercel do PR, sem login: `/cadastro-partner-enterprise` abre sem ir ao `/login`, mostra só o V3 Enterprise com R$ 49.896,96/ano e 12x de R$ 4.158,08, **mostra as garantias com o texto do KPI do PRO multiplicado por 10**, e a escolha Pix/boleto ou cartão. `/cadastro-partner-access` mostra as garantias genéricas. CPF/CNPJ com dígito errado não avança; CNPJ alfanumérico válido avança com as letras.
- Leitura em produção (só `select`): conferir que a consulta de duplicidade devolve resultado para um documento de cadastro existente, e contar linhas fora do formato canônico (`cpf ~ '[^0-9]' or cnpj ~ '[^0-9A-Z]'`). Se houver, registrar no PR (não corrijo dado neste BRIEF).
- Unitário também para a linha de atenção do alerta interno (aparece só com `duplicado`).
- Não envio cadastro de teste em produção (geraria cobrança Cora real de R$ 49.896,96 e registro na fila).
- Depois do deploy: repetir a conferência visual em produção.

## ESTIMATE
M. ~2 h. Confiança alta no código; a divulgação depende da cláusula de contrato (ver RISKS).

## PARECER DE COMPLIANCE
- CPF/CNPJ: a pendência da rodada 1 (CNPJ alfanumérico recusado) deixa de existir, porque este BRIEF corrige o formulário. Dado pessoal: nenhum novo.
- Duplicidade (rodada 2): a enumeração de documento pela rota pública foi eliminada no desenho (resposta idêntica; aviso só interno). Não há mais pergunta ao Robson sobre esse ponto.
- Garantia de retorno em página pública: [VALIDAR COM ROBSON]. Pergunta: "Podemos exibir na página pública do Enterprise a garantia de devolução do investimento condicionada a um KPI de originação igual ao do Partner PRO multiplicado por 10, somando a originação dos 10 acessos, definido em contrato?" Resposta: (pendente). Data: (pendente). Quem respondeu: (pendente).

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 2 de 6: BLOQUEADO (2 falhas: [3/LGPD] 409 permitia descobrir se um CPF/CNPJ tem cadastro na V3; [Compliance] garantia de devolução em página pública sem parecer do Robson e sem cláusula de contrato). A primeira foi corrigida nesta versão (resposta idêntica, aviso só interno). A segunda está no override do Hamilton (abaixo). Sugestões acatadas: `formatCNPJ` como base da máscara e maiúsculas ao digitar, travessão removido do texto genérico das garantias, contagem de documentos com máscara no plano de teste, renovação Cora registrada em RISKS, decisão 2 registrada como desvio aceito. Não acatadas neste BRIEF: selo "CNPJ alfanumérico" e telefone em E.164 (escopo; ficam para o BRIEF de DDI).

Rodada 3 de 6: BLOQUEADO (1 falha de consistência: IMPACT ainda citava 409 e SCOPE ainda dizia "KPI de cada acesso"). Corrigido nesta versão. A falha do Robson está coberta pelo override. Sugestões registradas para outros BRIEFs: selo de duplicidade na tela admin-cadastros (o alerta é best-effort) e limite de chamadas com captcha na rota de cadastro.

Rodada 1 de 6: BLOQUEADO (3 falhas: [1.3] CPF/CNPJ do formulário corrompe CNPJ alfanumérico, sem dígito e sem unicidade; [1.4] telefone sem DDI; UX descrevia garantias que a tela com plano travado não mostra). Corrigido nesta versão pelas decisões 1, 2 e 3 do Hamilton. Sugestões acatadas: preço confirmado antes do go (decisão 4), aviso de cobrança imediata, registro de quem decide a remoção do Enterprise do público.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 4). Única falha: [VALIDAR COM ROBSON] da garantia de retorno, coberta pelo override abaixo. Nenhuma outra falha em aberto.
- Override: **sim**. Hamilton, 09/11/2026, no chat: "go mesmo assim, registra o override do Robson". Pendência aceita: [VALIDAR COM ROBSON] sobre exibir em página pública a garantia de devolução do investimento condicionada ao KPI do Partner PRO multiplicado por 10, somado entre os 10 acessos. O código segue sem a resposta do Robson. A regra do gate diz que ele não substitui o parecer do Robson, então a pergunta continua em aberto para ele responder depois. Cláusula de contrato correspondente: ainda não existe (ver RISKS). Consequência aceita: com o deploy, a página do Enterprise (e o link `-access`, com a garantia genérica) fica no ar exibindo a garantia antes de a cláusula existir; `noindex` só tira das buscas.
- Desvio aceito do item 1.4 (DDI): decisão 2, Enterprise só para contraparte brasileira.
- Go dado por: Hamilton, 09/11/2026, "go mesmo assim" (registrado pelo hook com override, depois do registro do BRIEF com QA BLOQUEADO, rodadas: 4)
- Migration aplicada em produção: não se aplica

## RESULTADO DOS TESTES (09/11/2026)
- Unitário: `tests/unit/cadastro-documento.test.ts`, 8 testes passando (CPF, CNPJ numérico e alfanumérico, dígito errado, sequência repetida, máscara progressiva, linha de duplicidade do alerta).
- Leitura em produção (só `select`, sem imprimir documento): 64 cadastros (55 APROVADO, 2 PENDENTE, 7 REPROVADO); nenhum CPF ou CNPJ fora do formato canônico; a consulta de duplicidade acha o cadastro existente em PF e em PJ; 2 documentos já têm hoje mais de um cadastro PENDENTE/APROVADO (anterior a este BRIEF, sem correção de dado aqui).
