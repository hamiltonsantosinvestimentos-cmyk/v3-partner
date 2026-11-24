# BRIEF: Prévia do link do Enterprise com o logo dele (WhatsApp e redes)

> Data: 2026-11-24 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-24_previa-de-link-marca-enterprise.md` e commitar junto com o código.

## SCOPE
Pedido do Hamilton em 24/11/2026: "quando coloco o link https://agsfinance.app, aparece o logo da V3, tem como colocar da AGS?"

`https://agsfinance.app` redireciona para `/login`. Quem monta a prévia do link (WhatsApp, Telegram, iMessage, LinkedIn) lê as tags `og:*` da página. Na falta delas, usa `apple-touch-icon` e a descrição. Hoje `/login` não tem nenhuma tag `og:*`. O `apple-touch-icon` está fixo em `app/layout.tsx` (`/icon-192.png`, V3), e a descrição é a da V3 ("Plataforma de gestão para parceiros e operações financeiras V3 Partners"). Por isso a prévia sai com a V3.

Correção: quando o domínio for de um Enterprise, `/login` e `/esqueci-senha` passam a ter, no `generateMetadata` que já existe desde o PR #429:
- `og:title` e `og:site_name` com o nome da marca ("AGS Finance");
- `og:description` e `description`: "Acesse a plataforma {nome}.";
- `og:image` com o logo do Enterprise (`white_label_logo_url`, uma URL pública do bucket `white-label`), mais `twitter:card` "summary";
- `apple-touch-icon` com o ícone do tema, ou o logo quando não houver ícone.

Nos domínios da V3 nada muda.

## IMPACT
- Arquivos afetados:
  - `app/layout.tsx`: o `<link rel="apple-touch-icon">` e as metas manuais `apple-mobile-web-app-title`, `apple-mobile-web-app-capable` e `apple-mobile-web-app-status-bar-style` saem do `<head>` escrito à mão (o `appleWebApp` do `metadata` já gera as três) e passam para o objeto `metadata` (`icons.apple: "/icon-192.png"`; o `appleWebApp.title` já existe lá). Assim a página filha consegue sobrescrever. Para a V3 o HTML final fica equivalente.
  - `lib/enterprise-marca-host.ts`: nova função `metadataDaMarca(marca, iconeUrl)`, que monta o objeto `Metadata` do Next com title, description, icons, openGraph e twitter.
  - `app/(auth)/login/page.tsx` e `app/(auth)/esqueci-senha/page.tsx`: o `generateMetadata` passa a usar `metadataDaMarca`.
- Tabelas afetadas: nenhuma. São os mesmos dados públicos de marca que já são lidos (PR #429).
- Rotas afetadas: `/login` e `/esqueci-senha` (só as tags do `<head>`).
- APIs e integrações afetadas: nenhuma.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: ao colar `https://agsfinance.app` no WhatsApp ou em outro aplicativo, a prévia mostra o logo da AGS, o título "AGS Finance" e o texto "Acesse a plataforma AGS Finance." O mesmo vale para "Adicionar à tela de início" no iPhone, que passa a usar o ícone da AGS.
- Estado vazio: um Enterprise sem logo e sem ícone fica sem `og:image`, e o aplicativo mostra só o título e o texto, sem imagem da V3.
- Sem UI? Não há tela nova. O efeito aparece na prévia do link, fora da plataforma.
- Nota do porquê (tooltip): não se aplica.
- Aviso operacional: o WhatsApp guarda a prévia de cada link por um tempo. Um link já compartilhado pode continuar mostrando a V3 por alguns dias. Um link novo ou com variação (`https://agsfinance.app/login`) já sai certo.

## DEPENDENCIES
- Deve existir antes: `marcaDoHost` (PR #429, em produção) e o logo da AGS cadastrado (já existe).
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - Mover o `apple-touch-icon` e o `apple-mobile-web-app-title` para o `metadata`. Hoje o título já sai em duplicidade (pelo `appleWebApp` e pela tag manual), então depois da mudança sai uma vez só.
  - Na V3, o `<link rel="apple-touch-icon" href="/icon-192.png">` continua no HTML, gerado pelo Next.
  - O `manifest` e o `theme-color` continuam fixos da V3 (fora do escopo).
- LGPD e compliance: a marca pública do Enterprise (nome e logo), que já aparece na tela de login sem autenticação. Ressalva: quando o master não preencheu `white_label_nome`, `enterprisePorDominio` usa o `full_name` dele como nome da marca. Nesse caso o `og:title` mostraria o nome da pessoa. Isso não é exposição nova, porque o `<title>` do login já sai assim desde o PR #429, e o domínio próprio é configurado pelo próprio master ou pelo ADMIN junto com a marca. Para a AGS, `white_label_nome` = "AGS Finance".
- Segurança de acesso ao banco (anon, RLS, views, funções): sem alteração. Usa a mesma leitura, já feita no servidor pelo `marcaDoHost` (com `server-only`).
- Performance:
  - Nenhuma consulta nova: `marcaDoHost` usa `cache()` e já é chamada na mesma requisição.
  - O `app/layout.tsx` continua com `metadata` estático, sem `headers()`, então as páginas públicas da V3 (LPs) não passam a ser dinâmicas.
- Outro:
  - Logo quadrado ou pequeno: o `og:image` usa o arquivo como está, sem recorte. O formato "summary" (miniatura quadrada) é o que combina com um logo.
  - Fora do escopo: o nome e o ícone do aplicativo instalado pelo Android (manifest), o `theme-color` e o `/favicon.ico` pedido direto por alguns aplicativos.

## APPROACH
- Abordagem escolhida: metadados por domínio só nas páginas que o link alcança (`/login`, que é o destino do redirecionamento, e `/esqueci-senha`). Essas páginas já são dinâmicas e já resolvem a marca no servidor.
- Alternativa descartada:
  - Um `generateMetadata` com `headers()` no layout raiz. Faria todas as páginas da plataforma, inclusive as LPs públicas estáticas, serem renderizadas por requisição.
  - Reescrever `/icon-192.png` no proxy por domínio. Isso não resolve `og:image` nem o título.

## DESENHO TÉCNICO
```ts
// lib/enterprise-marca-host.ts
export function metadataDaMarca(marca: Marca | null, iconeUrl: string | null): Metadata {
  if (!marca) return {};
  const descricao = `Acesse a plataforma ${marca.nome}.`;
  const imagem = marca.logoUrl ?? iconeUrl;
  const apple = iconeUrl ?? marca.logoUrl;
  return {
    title: marca.nome, description: descricao,
    icons: { icon: iconeUrl ?? "/favicon.ico", ...(apple ? { apple } : { apple: "/icon-192.png" }) },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: marca.nome },
    openGraph: { title: marca.nome, siteName: marca.nome, description: descricao, type: "website", ...(imagem ? { images: [{ url: imagem, alt: marca.nome }] } : {}) },
    twitter: { card: "summary", title: marca.nome, description: descricao, ...(imagem ? { images: [imagem] } : {}) },
  };
}
```
Reversão: reverter o PR.

## PLANO DE TESTE
- Lint, o build da Vercel e o teste automático de telas.
- Em produção:
  - `curl https://agsfinance.app/login`: o HTML precisa ter `og:image` com a URL do logo da AGS, `og:title` "AGS Finance", `og:description`, `twitter:card` e `apple-touch-icon` com o ícone da AGS, e nenhuma ocorrência de `/icon-192.png`;
  - `curl https://app.v3partners.com.br/login`: precisa continuar com `apple-touch-icon` `/icon-192.png` e a descrição da V3, sem nenhuma tag `og:` de Enterprise;
  - `curl` numa LP pública da V3 (`/seja-partner`) para confirmar que o cabeçalho continua igual.
- Conferir que a URL do `og:image` no HTML é absoluta (`https://`), já que o layout raiz não define `metadataBase`.
- Conferir que o `<link rel="icon">` continua presente quando não há `icone_url` (cai em `/favicon.ico`).
- Pedir ao Hamilton que cole `https://agsfinance.app/login` no WhatsApp e confira a prévia. O link raiz pode estar em cache.

## ESTIMATE
S. Cerca de 20 minutos. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal: só a marca pública do Enterprise, que já é exibida sem login.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6, 24/11/2026. VEREDITO: LIBERADO PARA "GO". Zero bloqueantes.
Sugestões aplicadas: (1) ressalva de LGPD sobre o `full_name` como nome de marca de reserva; (2) `icons.icon` cai em `/favicon.ico` quando não há ícone do tema, para a página não perder o favicon; (3) teste de URL absoluta do `og:image`; (4) remoção das três metas Apple manuais duplicadas.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 1)
- Override: não
- Go dado por: pendente
- Migration aplicada em produção: não se aplica
