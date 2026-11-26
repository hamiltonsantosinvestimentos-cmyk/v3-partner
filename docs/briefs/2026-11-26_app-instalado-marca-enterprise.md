# BRIEF: App instalado no celular com o ícone, o nome e as cores do Enterprise no domínio dele

> Data: 2026-11-26 | Autor: Claude (pedido do Hamilton: "O ICONE QUANDO INSTALADO NO CELULAR FAZER COM AS CORES AGS, QUANDO FOR COM O LINK AGS") | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-26_app-instalado-marca-enterprise.md` e commitar junto com o código.

## SCOPE
Hoje quem abre agsfinance.app no celular e escolhe "Adicionar à tela inicial" ou "Instalar app" recebe o app da V3:
- o layout raiz aponta para o arquivo fixo `public/manifest.json`, com nome "V3 Partners", ícones `/icon-192.png` e `/icon-512.png`, barra `#C9A84C` e abertura `#09081A`;
- o `<meta name="theme-color">` do layout raiz é fixo;
- nas páginas internas, o ícone do iPhone (apple-touch-icon) é o da V3;
- o aviso "Instale o app V3 Partners" aparece também no domínio da AGS.

A mudança vale **só quando o endereço acessado é o domínio de um Enterprise**. A regra é pelo host, como o Hamilton pediu: "quando for com o link AGS". Nesse caso o app instalado sai com:
- o nome da marca ("AGS Finance");
- o ícone do Enterprise (`white_label_tema.icone_url`, o mesmo da aba do navegador), entregue nos tamanhos exatos que Android e iPhone pedem, sobre a cor principal da marca;
- a barra e a tela de abertura na cor principal (`#040968` na AGS);
- o aviso de instalação "Instale o app AGS Finance".

O inverso também vale: qualquer pessoa que abra agsfinance.app, **inclusive alguém da equipe interna da V3**, vê o aviso e instala o app da AGS. Em app.v3partners.com.br nada muda, nem para usuários da AGS: lá continua o app da V3.

## IMPACT
- Arquivos afetados:
  - `lib/manifest-marca.ts` (novo, puro e testável):
    - monta o manifesto V3 e o da marca;
    - normaliza nome, `short_name` e cores;
    - calcula a versão do ícone;
    - decide a forma canônica das URLs (`formaCanonicaIcone`, `formaCanonicaManifesto`).
  - `lib/manifest-marca-server.ts` (novo, `server-only`): `marcaDoAppPorHost(host)` devolve `{ nome, corPrincipal, corAcento, iconeUrl, versao } | null`. Usa `ehHostV3` e `enterprisePorDominio` (que já existem) e lê `white_label_nome` do master. O nome vem **só** de `white_label_nome`; se faltar, usa "Plataforma", nunca o `full_name` do master.
  - `app/api/public/manifest/route.ts` (novo): manifesto conforme o host.
  - `app/api/public/app-icone/route.tsx` (novo): ícone PNG no tamanho exato, gerado com `ImageResponse` (`next/og`).
  - `lib/enterprise-marca-host.ts`:
    - `metadataDaMarca` passa a incluir `manifest: "/api/public/manifest"` e `icons.apple` na URL canônica versionada do ícone de 180;
    - `marcaDoHost` passa a devolver também a `versao`;
    - nova função `viewportDaMarca(tema)`.
  - Páginas com marca pelo host ganham `generateViewport`: `app/(auth)/login/page.tsx`, `app/(auth)/esqueci-senha/page.tsx`, `app/auth/confirm/page.tsx`, `app/auth/update-password/page.tsx`.
  - `app/(platform)/layout.tsx`:
    - quando o host é de Enterprise, o `generateMetadata` passa a juntar `manifest`, `icons.apple` e `appleWebApp.title` da marca, e recoloca o `icon` da aba que hoje vem da sessão;
    - ganha `generateViewport`;
    - passa `marcaNome` às duas ocorrências de `PWAInstallPrompt`.
  - `components/pwa/pwa-install-prompt.tsx`: nova prop opcional `marcaNome`, usada no texto e no `aria-label`. Sem a prop, fica "V3 Partners".
  - `app/layout.tsx`:
    - tira do `<head>` o `<link rel="manifest">` e o `<meta name="theme-color">` escritos à mão; o manifest já sai por `metadata.manifest`;
    - ganha `export const viewport = { themeColor: "#C9A84C" }`;
    - sem essa troca, a tag fixa ganha da tag da marca.
  - `proxy.ts`: `/api/public/manifest` e `/api/public/app-icone` entram em `PUBLIC_ROUTES`.
  - `tests/unit/manifest-marca.test.ts` (novo).
- Tabelas afetadas: nenhuma. Só leitura de `profiles` (marca, tema e `white_label_nome` do master).
- Rotas afetadas:
  - as duas rotas públicas novas;
  - os metadados das 4 páginas públicas com marca e do layout da plataforma.
- APIs e integrações afetadas: nenhuma externa. O ícone vem do bucket público `white-label` do próprio Supabase, com URL já validada por `validarTema` (prefixo do bucket, sem `"'<>()`).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso:
  - **Android/Chrome:** abrir agsfinance.app e escolher "Instalar app" ou "Adicionar à tela inicial", ou tocar no aviso "Instale o app AGS Finance" no rodapé da plataforma. O ícone na tela inicial é o "ags." sobre azul-marinho, recortado pelo formato do aparelho (variante `maskable`, com o ícone a 80% e centralizado). O nome é "AGS Finance", e a barra e a abertura ficam azul-marinho.
  - **iPhone/Safari:** Compartilhar → "Adicionar à Tela de Início", com o ícone "ags." e o nome "AGS Finance".
  - **Barra do navegador no Android**, em agsfinance.app: na cor principal da marca.
- Estado vazio:
  - Enterprise com domínio próprio e sem ícone no tema: o ícone é a inicial do nome na cor de acento, sobre a cor principal;
  - sem tema nenhum: fundo `#09081A` e inicial em `#C9A84C`, as cores padrão da V3, com o nome da marca;
  - ícone em WEBP ou SVG (o upload de marca aceita os dois, e o gerador de imagem não lê WEBP de forma confiável): usa a inicial. Para ter o ícone de verdade no app, o Enterprise envia PNG ou JPG.
- Sem UI? Não. A mudança aparece na instalação e na tela inicial do celular.
- Nota do porquê: não se aplica.

## DEPENDENCIES
- Deve existir antes: domínio do Enterprise resolvido por `enterprisePorDominio` (no ar desde o #427 e o #429) e o ícone no tema. O ícone da AGS é PNG de 512×512.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes:
  - **App já instalado.** Quem já instalou o app por agsfinance.app continua com o ícone e o nome da V3. O iPhone nunca atualiza um atalho já criado. No Android, o app antigo guarda `/manifest.json`, que continua sendo o da V3, e por isso pode nunca se atualizar sozinho. **Nos dois sistemas é preciso remover o atalho e instalar de novo.** Isso vai no aviso ao Hamilton, para ele repassar à AGS.
  - **V3.** O manifesto da V3 continua o mesmo arquivo `/manifest.json`. A diferença é que as tags do `<head>` passam a sair pelos metadados do Next. O plano de teste confere em produção que app.v3partners.com.br mantém `/manifest.json`, `#C9A84C` e o apple-touch-icon da V3.
- LGPD e compliance:
  - não há dado pessoal; só nome, cores e ícone da marca, que já são públicos na tela de login de agsfinance.app desde o #429;
  - o nome do app vem só de `white_label_nome`, nunca do nome da pessoa física do master;
  - o ponto aberto com o Robson (domínio e e-mail) é outro assunto.
- Segurança de acesso ao banco (anon, RLS, views, funções):
  - as rotas novas são públicas e devolvem só nome, cores e ícone, que já estão em `/api/public/white-label`;
  - a service role é usada só no servidor, como em `marcaDoHost`, e nada é gravado;
  - um host forjado só leva à marca de outro domínio cadastrado, que já é pública.
- Abuso e custo:
  - a chave do cache da Vercel é a URL inteira. Por isso as rotas só aceitam a **forma canônica**:
    - **ícone, três estados** (função pura `formaCanonicaIcone`):
      - **canônica:** `t` exatamente 180, 192, 512 ou 512m, `v` com 8 caracteres hexadecimais, cada chave uma vez só e nenhum outro parâmetro;
      - **resolução:** exatamente `?t=512`, sem `v` e sem nenhum outro parâmetro. Consulta o banco uma vez e devolve 308 para `urlIcone("512", versaoAtual)`, ou para `/icon-512.png` em host da V3 ou sem Enterprise, com `Cache-Control: public, s-maxage=300` (uma chave de cache por host). É um destino terminal, sem laço;
      - **inválida** (todo o resto, inclusive chave repetida): 308 para `/api/public/app-icone?t=512` (caminho completo no `Location`), sem consultar o banco nem gerar imagem;
    - **ícone canônico com `v` diferente da versão atual:** consulta o banco uma vez e devolve 308 para a versão atual, sem gerar imagem, com `Cache-Control: public, s-maxage=300`;
    - no máximo 2 saltos (inválida → resolução → canônica), nunca um redirect para si mesmo;
    - **manifesto:** qualquer query devolve 308 para `/api/public/manifest` puro, sem consultar o banco.
  - Só a URL canônica gera imagem, e ela fica em cache. O custo de banco por pedido com `v` inventado é o mesmo de qualquer página pública que já resolve a marca pelo host, como a tela de login.
  - Cache:
    - ícone na versão atual: `public, max-age=86400, s-maxage=86400, immutable`. A versão muda quando a marca muda, então o cache longo não segura ícone velho;
    - manifesto: `public, max-age=300, s-maxage=300`.
- Ícone remoto fora do ar ou inválido:
  - a rota baixa o ícone **antes** de gerar a imagem, com `fetch` e timeout de 3 s;
  - aceita só status `ok`, `content-type` `image/png` ou `image/jpeg` e no máximo 1 MB;
  - passa os bytes como data URL ao `<img>`;
  - qualquer falha leva à inicial, e essa resposta de contingência sai com `Cache-Control: no-store`, para uma falha passageira não ficar presa no cache. Ela nunca devolve o ícone da V3.
  - Risco que fica: um iPhone que instale exatamente durante a falha guarda a inicial até reinstalar.
- Troca de marca:
  - a versão (`v`) são os 8 primeiros caracteres do sha256 de `icone_url|cor_principal|cor_acento|nome`;
  - quando o Enterprise troca o ícone ou a cor, a URL muda na hora, nas páginas e no manifesto;
  - defasagem máxima: 5 minutos (cache do manifesto). Apps já instalados seguem a regra de reinstalação acima.
- Fora do escopo, para ninguém achar que a marca do app ficou completa:
  - as notificações push do app instalado continuam com o título "V3 Partners" e `/logo.jpg` (`public/sw.js`);
  - `enterprisePorDominio` usa `ilike` sem escapar `%` e `_` do host, um problema que já existia antes deste BRIEF.
- Performance: o manifesto e o ícone só são buscados na instalação e de vez em quando pelo navegador.
- Vercel timeout (60s): não se aplica (download do ícone limitado a 3 s).
- Outro: `public/manifest.json` continua no repositório e em `/manifest.json`, para não quebrar apps da V3 já instalados.

## APPROACH
- Abordagem escolhida: o manifesto e o ícone são gerados por rota conforme o host, com URL canônica e versionada, e ligados pelos metadados do Next. A regra de host reaproveita `ehHostV3` e `enterprisePorDominio`. O ícone sai sempre nos tamanhos exatos (180, 192 e 512), com a imagem inteira (`contain`) sobre a cor principal, em duas variantes:
  - `any`: o ícone ocupa o quadro;
  - `maskable`: o ícone fica a 80% e centralizado, na zona segura do Android.
- Alternativas descartadas:
  - **Apontar o manifesto direto para `icone_url`:** o arquivo enviado pode não ter 192/512 px nem ser PNG, e o Android recusa ícone com tamanho declarado errado.
  - **Reescrever `/manifest.json` no `proxy.ts`:** o proxy hoje só cuida de autenticação, e o arquivo estático passaria a ter dois comportamentos escondidos.
  - **Marca pela sessão do usuário:** contraria o pedido ("quando for com o link AGS").

## DESENHO TÉCNICO
```ts
// lib/manifest-marca.ts (puro)
export const TAMANHOS = ["180", "192", "512", "512m"] as const;
export function versaoMarca(o: { iconeUrl: string | null; corPrincipal: string; corAcento: string; nome: string }): string
  // sha256("icone|principal|acento|nome") → 8 hex (node:crypto)
export const URL_RESOLUCAO = "/api/public/app-icone?t=512";
export function formaCanonicaIcone(q: URLSearchParams):
  | { estado: "canonica"; t: (typeof TAMANHOS)[number]; v: string }
  | { estado: "resolucao" }                       // exatamente ?t=512, sem mais nada
  | { estado: "invalida"; redirect: typeof URL_RESOLUCAO }
  // canônica: chaves exatamente {t, v}, cada uma 1 vez (getAll().length === 1), t ∈ TAMANHOS, v /^[0-9a-f]{8}$/
export function urlIcone(t: (typeof TAMANHOS)[number], v: string): string  // `/api/public/app-icone?t=${t}&v=${v}`
export function shortName(nome: string): string                       // até 12 caracteres, cortando na última palavra inteira
export function nomeSeguro(nome: unknown): string                     // trim, sem < > ", até 45; vazio → "Plataforma"
export function corSegura(c: unknown, padrao: string): string         // #RRGGBB ou padrao
export function manifestoV3(): object                                 // igual a public/manifest.json
export function manifestoDaMarca(m: { nome; corPrincipal; versao }): object
//  { id: "/", name, short_name, description: `Plataforma ${name}`, start_url: "/", scope: "/",
//    display: "standalone", orientation: "portrait-primary",
//    background_color: corPrincipal, theme_color: corPrincipal,
//    icons: [
//      { src: urlIcone("192", v),  sizes: "192x192", type: "image/png", purpose: "any" },
//      { src: urlIcone("512", v),  sizes: "512x512", type: "image/png", purpose: "any" },
//      { src: urlIcone("512m", v), sizes: "512x512", type: "image/png", purpose: "maskable" },
//    ] }
// Variante maskable dentro da forma canônica: TAMANHOS = ["180", "192", "512", "512m"].
// "512m" = 512 px com o ícone a 80%, centralizado (zona segura do Android).
// O apple-touch-icon usa urlIcone("180", v): imagem inteira sobre a cor principal; o iPhone arredonda os cantos.
```

```ts
// lib/manifest-marca-server.ts (server-only)
export async function marcaDoAppPorHost(host): Promise<{ nome; corPrincipal; corAcento; iconeUrl; versao } | null>
//  ehHostV3(host) → null; e = enterprisePorDominio(db, host) → null se não houver;
//  white_label_nome do master (select único); nomeSeguro; corSegura(tema?.cor_principal, "#09081A");
//  corSegura(tema?.cor_acento, "#C9A84C"); iconeUrl = tema?.icone_url ?? null; versao = versaoMarca(...)
//  Três estados: marca | null (host sem Enterprise, legítimo) | { erro: true } (falha de consulta).
//  Nas rotas, { erro } responde a V3 com Cache-Control no-store (nunca cacheia a V3 no host da marca
//  por falha passageira); só o null legítimo é cacheado. Nas páginas (marcaDoHost) erro = sem marca, como hoje.
//  Nota: ?t=192 sem v vira 512 depois da resolução (só URLs montadas fora do sistema caem aí).

// app/api/public/manifest/route.ts — GET
//  query não vazia → 308 /api/public/manifest (sem banco)
//  m = marcaDoAppPorHost(host); m ? manifestoDaMarca(m) : manifestoV3()
//  Content-Type application/manifest+json; Cache-Control public, max-age=300, s-maxage=300

// app/api/public/app-icone/route.tsx — GET
//  c = formaCanonicaIcone(searchParams)
//  c.estado === "invalida" → 308 URL_RESOLUCAO (sem banco)
//  m = marcaDoAppPorHost(host)
//  c.estado === "resolucao" → 308 (m ? urlIcone("512", m.versao) : "/icon-512.png"), s-maxage=300
//  !m → 307 /icon-512.png
//  c.v !== m.versao → 308 urlIcone(c.t, m.versao), Cache-Control public, s-maxage=300
//  bytes = baixarIcone(m.iconeUrl): fetch com AbortSignal.timeout(3000), ok, content-type png|jpeg,
//          content-length/bytes ≤ 1 MB → data URL; senão null
//  ImageResponse(size×size): fundo corPrincipal;
//    bytes ? <img src={dataUrl} style={{ width: escala, height: escala, objectFit: "contain" }} />
//          : <span style={{ color: corAcento, fontSize: size*0.5, fontWeight: 800 }}>{inicial}</span>
//    escala = t === "512m" ? 80% : 100%
//  Cache-Control: bytes ? "public, max-age=86400, s-maxage=86400, immutable" : "no-store"

// lib/enterprise-marca-host.ts
//  marcaDoHost passa a usar marcaDoAppPorHost para nome e versão (uma fonte só), para o
//  apple-touch-icon das páginas já sair na versão atual (sem 308 extra) e o nome do aviso ser o do app.
//  MarcaDoHost ganha versao: string | null
//  metadataDaMarca(marca, iconeUrl, versao): + manifest: "/api/public/manifest",
//    icons.apple: versao ? urlIcone("180", versao) : (apple atual)
//  viewportDaMarca(tema): { themeColor: corSegura(tema?.cor_principal, "#09081A") }

// app/(platform)/layout.tsx
//  generateMetadata: base da sessão (como hoje) + se marcaDoHost().marca:
//    manifest, icons: { icon: <ícone da sessão ou da marca do host>, apple: urlIcone("180", versao) },
//    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: nome }
//  generateViewport: marcaDoHost() → viewportDaMarca
//  <PWAInstallPrompt marcaNome={marcaHost?.nome} /> (as duas ocorrências)

// app/layout.tsx: remove <link rel="manifest"> e <meta name="theme-color"> do <head>;
//  export const viewport: Viewport = { themeColor: "#C9A84C" }
```
O nome usado nos metadados e no aviso (`marcaDoHost`) passa pela mesma regra de `white_label_nome`, com "Plataforma" como reserva. Reversão: reverter o PR. Não há migration.

## PLANO DE TESTE
- `tests/unit/manifest-marca.test.ts`:
  - `formaCanonicaIcone` aceita `t=180|192|512|512m` com `v` válido como "canonica";
  - `?t=512` puro é "resolucao";
  - `t=abc`, `t=9999`, `v` inválido, parâmetro extra, chave repetida e `?t=192` sem `v` são "invalida", com redirect para `URL_RESOLUCAO`;
  - o destino de "invalida" (`URL_RESOLUCAO`) é classificado como "resolucao", e o destino de "resolucao" (`urlIcone("512", v)`) como "canonica", ou seja, sem laço;
  - `versaoMarca` é estável para a mesma entrada e muda quando ícone ou cor mudam;
  - `shortName` corta na palavra inteira;
  - `nomeSeguro` cobre vazio, `<` e o limite de 45 caracteres;
  - `corSegura` recusa cor inválida;
  - `manifestoDaMarca` monta ícones com tamanhos, `purpose` e versão;
  - `manifestoV3` é igual ao conteúdo de `public/manifest.json`.
- A lógica das rotas fica nas funções puras testadas. As rotas só ligam as peças, e o comportamento ponta a ponta é conferido pelo curl em produção.
- Build da Vercel e o teste automático de telas (playwright).
- Em produção, sem login:
  - `curl https://agsfinance.app/api/public/manifest`: nome "AGS Finance", `theme_color #040968`, 3 ícones com `v`;
  - `curl -I` na URL canônica do ícone de 512: `image/png`, cache de 1 dia; baixar e olhar a imagem e a variante `512m`;
  - `curl -sIL --max-redirs 3 .../app-icone?t=abc`: termina em 200 `image/png`, passando por `?t=512` e pela versão atual;
  - `?t=512&v=00000000`: 308 para a versão atual;
  - em app.v3partners.com.br, `curl -sIL --max-redirs 3 .../app-icone?t=abc` termina em `/icon-512.png`;
  - `/api/public/manifest?x=1`: 308 para o manifesto puro;
  - HTML de agsfinance.app/login: `rel="manifest" href="/api/public/manifest"`, apple-touch-icon versionado e `theme-color #040968`;
  - HTML de app.v3partners.com.br/login: `/manifest.json`, `#C9A84C` e o apple-touch-icon da V3, sem mudança;
  - em app.v3partners.com.br, o ícone canônico redireciona para `/icon-512.png`.
- Com o Hamilton no celular: instalar por agsfinance.app (Android e/ou iPhone) e conferir ícone, nome e cor; na plataforma logada, conferir o aviso "Instale o app AGS Finance".
- Não testável sem quebrar produção: a falha real do bucket. Fica coberta pelo desenho (contingência com `no-store`).

## ESTIMATE
M. Cerca de 2h. Confiança alta para aparelhos que instalam depois do deploy. Quem já tinha o app instalado precisa reinstalar.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal. Só identidade visual da marca, que já é pública na tela de login do domínio dela, e o nome vem apenas de `white_label_nome`. Não cria remetente, contrato nem documento.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 26/11/2026: BLOQUEADO com 3 falhas, todas corrigidas nesta versão.
1. A premissa de cache estava errada: a chave do cache é a URL inteira. Agora as rotas só aceitam a forma canônica, com 308 sem consultar o banco.
2. A contingência do ícone não funcionaria e havia o problema do WEBP. Agora o ícone é baixado antes, com timeout, tipo e tamanho conferidos, e passado como data URL; WEBP e SVG viram a inicial.
3. A contingência e a troca de tema ficavam presas no cache. Agora a contingência sai com `no-store` e a URL leva uma versão derivada da marca, com defasagem máxima de 5 minutos.

Sugestões aplicadas:
- variante `maskable`, com o ícone em `contain`;
- padrão sem tema (`#09081A` e `#C9A84C`);
- reinstalação obrigatória nos dois sistemas;
- push e `ilike` declarados como fora do escopo;
- caso da equipe V3 no domínio da AGS;
- `short_name` cortado por palavra;
- nome só de `white_label_nome`;
- testes da forma canônica.

Rodada 2, 26/11/2026: BLOQUEADO, com 1 falha: o redirect da forma canônica entrava em laço, porque `?t=512` sem `v` não era canônico. Corrigido com três estados: canônica, resolução (`?t=512` puro, que é terminal e consulta o banco uma vez) e inválida (vai para a resolução, sem consultar o banco). Há teste de ausência de laço e curl com `-L --max-redirs 3`. Sugestões aplicadas: uma fonte só para nome e versão (`marcaDoHost` usa `marcaDoAppPorHost`), chave repetida recusada e caminho completo no `Location`.

Rodada 3, 26/11/2026: LIBERADO, zero bloqueantes. Sugestões aplicadas: terceiro estado `{ erro: true }` em `marcaDoAppPorHost` com `no-store` e nota sobre `?t=192` sem `v`.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 3)
- Override: não
- Go dado por: (pendente)
- Migration aplicada em produção: não se aplica
