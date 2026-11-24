# BRIEF: Login do Enterprise já abre com a marca dele (sem piscar a V3)

> Data: 2026-11-24 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-24_login-enterprise-marca-no-servidor.md` e commitar junto com o código.

## SCOPE
Problema relatado pelo Hamilton em 24/11/2026: "agsfinance.app, esta abrindo, mas quando abre aparece o login e logo da v3, esta com delay".

A causa está em `app/(auth)/login/page.tsx`, que é um componente cliente. A página abre com o logo, o nome e as cores da V3 e só depois chama `/api/public/white-label` para descobrir o dono do domínio e então troca a marca. Enquanto essa chamada não volta, a pessoa vê a V3. A tela `/esqueci-senha` nem faz a chamada: mostra o logo e o rodapé da V3 em qualquer domínio.

Correção: o servidor descobre o dono do domínio, pelo cabeçalho `host`, antes de enviar a página. O HTML já sai com o logo, o nome, as cores (`<style>` com as variáveis `--wl-*`), o título da aba e o ícone do Enterprise, tanto em `/login` quanto em `/esqueci-senha`. A regra vale para qualquer Enterprise com domínio próprio, não só para a AGS. Nos domínios da V3 nada muda.

## IMPACT
- Arquivos afetados:
  - `app/(auth)/login/page.tsx`: vira um componente servidor que busca a marca pelo host e renderiza o formulário.
  - `app/(auth)/login/login-client.tsx` (novo): o formulário atual, movido sem mudança de lógica, que recebe `marca` por prop no lugar do `fetch`.
  - `app/(auth)/esqueci-senha/page.tsx` e `app/(auth)/esqueci-senha/esqueci-senha-client.tsx` (novo): o mesmo padrão. O logo e o rodapé passam a usar a marca, e as cores fixas em estilo inline (`#09081A`, `#0E2040`, `#7A8FA8`, dourados) viram `var(--wl-*, <cor V3>)`, como o login já faz. O padrão de cada variável é a cor V3, então nos domínios da V3 a tela fica idêntica (exceção de tema do CLAUDE.md, 21/11/2026).
  - No login movido, o brilho azul fixo `rgba(26,79,196,0.06)` (cor proibida pelo CLAUDE.md, anterior a este BRIEF) passa a usar `var(--wl-medio, #243A66)`.
  - `lib/enterprise-marca-host.ts` (novo): a função `marcaDoHost()`, só para servidor, com `import "server-only"` (o build falha se um componente cliente importar). O cliente service role é criado dentro da função. Ela lê `x-forwarded-host`/`host`, sai na hora em host da V3 (`ehHostV3`, sem consultar o banco), chama `enterprisePorDominio` e devolve `{ marca, temaCss, iconeUrl }`, que são os mesmos dados públicos que `/api/public/white-label` já devolve hoje.
- Tabelas afetadas: nenhuma alteração. É a mesma leitura de `profiles` que a rota pública já faz (nome da marca, logo, tema), com service role no servidor.
- Rotas afetadas: `/login` e `/esqueci-senha`, por causa de `generateMetadata` (título da aba e ícone).
- APIs e integrações afetadas: `/api/public/white-label` continua igual, porque ainda pode ter outros usos. Ela só deixa de ser chamada pelo login.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: ao abrir `https://agsfinance.app` (que redireciona para `/login`) ou `/esqueci-senha`, a pessoa vê desde o primeiro quadro:
  - o logo da AGS;
  - o nome "AGS Finance";
  - as cores da AGS;
  - o título da aba e o ícone da AGS;
  - o rodapé "AGS Finance · Powered by V3 Partners".
- Estado vazio: um Enterprise sem logo mostra o logo da V3 e o nome dele, como hoje. Em domínio da V3 a tela fica idêntica à atual.
- Sem UI? Há UI.
- Nota do porquê (tooltip): não se aplica.

## DEPENDENCIES
- Deve existir antes: `enterprisePorDominio`, `cssVariaveis` e o domínio `agsfinance.app` cadastrado em `profiles.white_label_dominio`. `enterprisePorDominio` não filtra por status, então basta o domínio estar gravado. Tudo isso já está em produção.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - As páginas deixam de ser estáticas e passam a ser renderizadas por requisição, porque leem `headers()`. Em host da V3 o custo é só a leitura do cabeçalho, sem banco.
  - O formulário de login (POST `/api/auth/login`, redirecionamento, mensagens de erro) é movido sem mudar a lógica.
- LGPD e compliance: só dados públicos de marca (nome comercial, logo, cores), os mesmos que a rota pública já expõe sem login. Nenhum dado pessoal.
- Segurança de acesso ao banco (anon, RLS, views, funções):
  - Sem DDL. A leitura usa a service role só no servidor (componente servidor), nunca no cliente.
  - O host vem do cabeçalho da requisição. Um host forjado só faz aparecer a marca pública de um Enterprise, que já é pública pela rota atual.
  - A consulta usa `ilike` com o host normalizado. O host passa pelo mesmo tratamento da rota pública (minúsculas, sem porta).
- Performance: em host de Enterprise, uma consulta a `profiles` e uma ao tema por carregamento do login, com o mesmo custo da chamada que o navegador já faz hoje. A chamada do navegador deixa de existir, então o total cai.
- Outro:
  - Se o banco falhar, `marcaDoHost` devolve `null` (`catch`) e a tela abre com a V3, como hoje. Prefiro isso a quebrar o login.
  - Fora do escopo:
    - a tela de troca de senha depois do link de recuperação e os e-mails de recuperação continuam com a marca V3;
    - o ícone e o nome de "adicionar à tela inicial" do celular (`apple-touch-icon`, `apple-mobile-web-app-title`, `manifest.json`, `theme-color` em `app/layout.tsx`) continuam V3;
    - o `ilike` de `enterprisePorDominio` (onde `_` vira curinga) fica para um BRIEF próprio, porque também afeta o layout da plataforma.

## APPROACH
- Abordagem escolhida: resolver a marca no servidor e mandar o HTML pronto. É o único jeito de não haver o primeiro quadro com a V3. Além disso, reaproveita as funções que a rota pública e o layout da plataforma (`app/(platform)/layout.tsx`) já usam.
- Alternativa descartada:
  - Esconder a tela até o `fetch` voltar (tela em branco ou carregando). Troca o pisca da V3 por um atraso e continua com o vaivém na rede.
  - Fazer cache no navegador (`localStorage`). Não resolve o primeiro acesso, que é justamente o do usuário novo da AGS.

## DESENHO TÉCNICO
Sem migration.
```ts
// lib/enterprise-marca-host.ts  (server-only)
export async function marcaDoHost(): Promise<{ marca: Marca | null; temaCss: string | null; iconeUrl: string | null }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (ehHostV3(host)) return { marca: null, temaCss: null, iconeUrl: null };
  const e = await enterprisePorDominio(svc, host).catch(() => null);
  return { marca: e?.marca ?? null, temaCss: e?.tema ? cssVariaveis(e.tema) : null, iconeUrl: e?.tema?.icone_url ?? null };
}

// app/(auth)/login/page.tsx  (server)
export async function generateMetadata() { const { marca, iconeUrl } = await marcaDoHost(); return marca ? { title: marca.nome, ...(iconeUrl ? { icons: { icon: iconeUrl } } : {}) } : {}; }
export default async function Page() {
  const { marca, temaCss } = await marcaDoHost();
  return <>{temaCss?.startsWith(":root{") && <style id="tema-enterprise">{temaCss}</style>}<LoginClient marca={marca} /></>;
}
```
`cache()` do React evita a consulta dupla entre `generateMetadata` e a página. O `temaCss` só entra se começar com `:root{`, a mesma checagem de hoje. As cores já são validadas como hex quando são gravadas.

Reversão: reverter o PR.

## PLANO DE TESTE
- Lint dos arquivos novos e alterados, e o build da Vercel.
- Em produção:
  - `curl https://agsfinance.app/login`: o HTML já contém "AGS Finance", a URL do logo da AGS e `--wl-principal`;
  - `curl https://app.v3partners.com.br/login`: o HTML sem nada de Enterprise, igual ao de hoje;
  - o mesmo par em `/esqueci-senha`;
  - login de verdade com o usuário teste da AGS por agsfinance.app, que precisa entrar e cair no Dashboard;
  - login de uma conta V3 em app.v3partners, que precisa continuar funcionando.
  - Estado vazio (Enterprise sem logo e sem tema): hoje não existe Enterprise com domínio nessa condição em produção. Fica coberto pelo código (`marca.logoUrl` nulo cai no logo V3, `temaCss` nulo não gera `<style>`), conferido na leitura do diff.

## ESTIMATE
S/M. Cerca de 40 minutos. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal: só a marca pública do Enterprise, que já é exposta sem login pela rota `/api/public/white-label`.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6, 24/11/2026. VEREDITO: LIBERADO PARA "GO". Zero bloqueantes.
Sugestões aplicadas nesta versão: (1) cores de /esqueci-senha agora entregues, com os estilos inline convertidos para `var(--wl-*, <cor V3>)`; (2) ícone e título de tela inicial do celular declarados fora do escopo; (3) `import "server-only"` e cliente service role criado dentro da função; (4) azul proibido do login trocado por `var(--wl-medio, #243A66)`; (5) `ilike` registrado para BRIEF próprio; (6) dependência corrigida (sem filtro de status); (7) estado vazio no plano de teste.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 1)
- Override: não
- Go dado por: pendente
- Migration aplicada em produção: não se aplica
