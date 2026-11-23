# BRIEF: Tema visual do Enterprise (cores, logos e ícone) conforme o manual de marca do cliente

> Data: 2026-11-21 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO pelo QA (rodada 4), aguardando go
> Salvar em `docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md` e commitar junto com o código.

## PEDIDO DO HAMILTON (21/11/2026, no chat)
- "quero que faça o layout do enterprise conforme a manual da marca C:\Users\atend\Downloads\AGS_Finance_Manual_de_Uso_da_Marca.pdf"
- Complemento: "mesmo layout da v3 (as abas), so que com a marca, cor e logo da AGS, nesse caso". Ou seja: **menu, abas, telas, textos e fluxos idênticos aos da V3**; muda só a pele (marca, cores, logo e ícone). Nenhum item de menu entra, sai ou muda de nome nesta entrega.
- Prévia visual publicada para aprovação: https://claude.ai/artifact/TuBDGF1mcT3pPEqrFfDVXq (plataforma logada com o menu real do Enterprise, login no domínio próprio, troca de cores).
- 21/11, decisão do Hamilton sobre a fonte: "continuar a fonte das letras da v3". **A fonte continua DM Sans para todos, inclusive o Enterprise.** A Poppins do manual da AGS não entra.
- Pendente do Hamilton: aceitar a proporção de cor (ver RISKS).

## O QUE O MANUAL DA AGS FINANCE EXIGE (v1.0, 18/11/2026)
- Cores: Azul Marinho AGS `#040968` (~60%), Branco `#FFFFFF` (~30%), Verde AGS `#00E000` (≤10%, só acento).
- Fonte: Poppins (Bold títulos, Medium subtítulos, Regular corpo, Light notas); reserva Arial.
- Logo: só arquivo oficial. Negativa em fundo azul/escuro; colorida em fundo claro; sem ® abaixo de 120 px na tela; mínimo 60 px; área de proteção = diâmetro do ponto verde.
- Ícone/avatar (favicon, apps): versão ícone sem ®, sobre o Azul Marinho; pacote em ICO/PNG.
- Proibido: logo negativa sobre verde, fundo sem contraste, distorcer, sombra, redigitar o logo em fonte.

## SITUAÇÃO HOJE (levantamento de 21/11, conferido pelo QA rodada 1)
- White label guarda só **nome** e **um logo** (`profiles.white_label_nome`, `white_label_logo_url`, bucket público `white-label`, criado sem `allowed_mime_types` e sem `file_size_limit`; limites só na API). O logo aparece no menu, no login do domínio próprio (`/api/public/white-label`), em e-mails (`lib/email.ts` → `aplicarMarca`) e em 4 PDFs.
- Cores da V3 escritas como classe arbitrária do Tailwind em `app/`, `components/` e `lib/` (contagem 21/11): `#C9A84C` 4.368, `#7A8FA8` 2.082, `#9BAFC5` 1.523, `#243A66` 1.255, `#F0ECE4` 1.126, `#09081A` 820, `#F5F1E8` 807, `#E8C97A` 657, `#162744` 595, `#111F35` 449, `#1B3050` 289, `#12112A` 238, `#122036` 192, `#E8EDF5` 173, `#0D1929` 131. Mais `rgba(201,168,76,...)` em estilos inline (39 arquivos). `<body>` com fundo fixo da V3; Toaster/modal `confirmar()` em `app/layout.tsx`; Dialog/Select/Dropdown do Radix em portal no `document.body`.
- Fonte DM Sans fixa em `app/layout.tsx`. Título da aba "V3 PARTNERS — Plataforma Financeira", `theme-color` `#C9A84C`, `app/favicon.ico`, apple-touch-icon e manifest da V3.
- E-mails e os 5 PDFs com marca têm **fundo escuro** (navy V3) e recebem a logo para fundo escuro.
- Logos da AGS disponíveis: **negativa sem ®** (1000 px) e **avatar azul** (512 px). **Falta a colorida oficial.**
- Log de auditoria em `app/api/enterprise/marca/route.ts` só existe no modo ADMIN (`logAntesDaEscritaAdmin` retorna sem gravar quando não é ADMIN).

## SCOPE
1. **Tema por Enterprise** guardado no master: cor principal, cor de acento, logo para fundo claro (guardado para uso futuro), ícone. O logo atual passa a ser chamado "logo para fundo escuro".
2. **Plataforma logada** (master e equipe): toda a paleta da V3 trocada pela do Enterprise, sem editar os arquivos de tela, por um **plugin PostCSS** que, no CSS já compilado, troca cada cor da V3 por `var(--wl-x, <cor V3>)`. Sem tema, a variável não existe e vale a cor de hoje.
3. **Fonte**: sem mudança (DM Sans, decisão do Hamilton 21/11).
4. **Título e ícone da aba** com a marca e o ícone do Enterprise na plataforma logada.
5. **Login do domínio próprio**: fundo na cor principal, logo para fundo escuro, botão na cor de acento, ícone da aba.
6. **Tela de marca** em `/enterprise` (e modo ADMIN `?master=`): campos novos, prévia, trava de contraste, auditoria em toda gravação.
7. Configurar a AGS Finance com os valores do manual (modo ADMIN, com log), depois do deploy.

Fora do escopo: **remetente dos e-mails de aviso com o nome da AGS** (pedido do Hamilton 21/11: "montar também com o nome da AGS, após criarmos o domínio"; hoje todos saem como `V3 Partners` pelo `EMAIL_FROM` de `lib/email.ts`; depende do domínio da AGS registrado e verificado no Resend; BRIEF próprio quando o domínio existir); **e-mails e PDFs** (seguem com fundo e cores da V3 e a logo para fundo escuro do Enterprise, como hoje; documentos de fundo claro com a logo colorida ficam no BRIEF `2026-11-19_identidade-enterprise-documentos-gerados.md`); contratos, mandato, NCNDA e cobranças em que a V3 é parte (seguem V3); `brand-guardian-gate` (não muda); PWA, manifest, apple-touch-icon e `theme-color` (seguem V3); SVGs já enviados ao bucket (ver RISKS).

## EXCEÇÃO AO CLAUDE.md (paleta da V3)
O CLAUDE.md proíbe cores fora da paleta V3 (e fontes fora de DM Sans, regra que esta entrega **não** toca: a fonte segue DM Sans). Esta entrega cria uma exceção limitada só para cores, que precisa de autorização explícita:
- (a) Cores de cliente Enterprise são **dado do tema** (banco), valem só quando o login é de um Enterprise com tema e **nunca** para usuário da V3.
- (b) **Nenhum hex de cliente fica fixo em componente.** Hex de cliente só aparece em testes e no registro da AGS no banco. O valor padrão de cada variável é a cor da V3.
- (c) Autorização: o **go do Hamilton ou do João neste BRIEF** vale como autorização da exceção. Como o Brandbook V2.0 foi aprovado pelos 3 sócios, o Hamilton pede a **ciência do João** e registra aqui (data e texto) antes do merge. Se algum sócio entender que a regra do Brandbook V2.0 exige o quórum dos 3, a decisão é registrada aqui antes do go.
- (d) O PR acrescenta ao CLAUDE.md, na seção de identidade visual, um parágrafo "Exceção: tema do Enterprise white label" com (a) e (b), para nenhum agente "corrigir" o tema achando que é violação.

## IMPACT
- **Migration** `supabase/migrations/20261121_white_label_tema.sql`:
  `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS white_label_tema jsonb;` + `COMMENT ON COLUMN`.
  Sem policy, grant, view, função ou mudança no bucket. A coluna nova nasce bloqueada para sessão comum pelo trigger `profiles_trava_colunas_sensiveis` (20261120a, confirmado pelo QA). Gravação só pela rota do servidor (service role).
  Rollback: `20261121_white_label_tema_rollback.sql.txt`. **Ordem do rollback: primeiro reverter o deploy do código, depois rodar o `DROP COLUMN`.**
  Formato (validado na API e de novo na leitura): `{ "cor_principal": "#040968", "cor_acento": "#00E000", "logo_claro_url": "...", "icone_url": "..." }`.
- `lib/enterprise-tema.ts` (novo): tipo `TemaEnterprise`; validador (hex `#RRGGBB`, URLs só do bucket `white-label` do nosso Supabase); tons derivados da cor principal e do acento (tabela abaixo); contraste WCAG; `cssVariaveis(tema)` → texto `:root{--wl-...}`. **O mesmo validador roda na gravação e na renderização** (tema inválido no banco = sem tema), porque um ADMIN com JWT pode gravar direto pela REST e a coluna não tem CHECK.
- `lib/enterprise.ts`: `EnterpriseContexto` ganha `tema: TemaEnterprise | null` **fora de `Marca`** (hoje `marca` é null quando o master não tem nome nem logo; o tema não pode depender disso). `enterprisePorDominio` devolve `tema` ao lado de `marca`. **O tema é lido num select separado**, com `try/catch`: erro (inclusive 42703, coluna inexistente) = `tema: null`, sem afetar nome e logo. Vale para `contextoEnterprise` e `enterprisePorDominio`.
- `postcss-tema-enterprise.cjs` (novo, raiz; `.cjs` para carregar com certeza no pipeline do Next 16/Turbopack) + `postcss.config.mjs` (plugin declarado por caminho, **depois** do `@tailwindcss/postcss`). Regras do plugin:
  - **Compara cor por valor, não por texto**: normaliza cada cor encontrada para sRGB (hex de 3, 6 e 8 dígitos sem diferenciar maiúsculas; `rgb()/rgba()` com vírgula ou espaço; `oklab()/lab()/oklch()` resolvidos) e compara com as cores da tabela abaixo. Isso cobre o CSS cru do `next dev` e o CSS minificado pelo Lightning CSS no `next build` (hex minúsculo, `rgba` virando hex de 8 dígitos, `color-mix` já calculado).
  - **Cor opaca** (6 dígitos ou equivalente, inclusive em `--tw-gradient-*` e nas variáveis do `@theme`): vira `var(--wl-<papel>, <literal original>)`. Não há perda de reserva: `var()` com padrão é suportado por todos os navegadores que a plataforma suporta.
  - **O plugin nunca cria regra, bloco ou declaração nova: só reescreve o valor de declarações que já existem, no lugar onde estão.** Assim não muda seletor, `@layer`, `@media` nem `@supports` pai, não gera seletor descendente na forma aninhada do `next dev` e não muda a cascata.
  - **Par `@supports (color: color-mix(in lab, red, red))` que o Tailwind 4.2.2 gera** (só para cor do `@theme` com opacidade, ex.: `bg-primary/20`; aninhado na regra no `next dev`, desaninhado no `next build`): dentro do `@supports` o valor é `color-mix(in oklab, var(--color-primary) N%, transparent)`, **sem literal da V3**; o tema chega porque `--color-primary` (e as demais variáveis do `@theme` no `:root`) vira `var(--wl-<papel>, <cor V3>)` pela regra de cor opaca. O plugin reconhece a reserva que acompanha o par por mesmo seletor e mesma propriedade, com o `@supports` irmão no mesmo pai; erro de detecção é inofensivo (a reserva viraria `color-mix` com `var()`, que funciona em todo navegador suportado).
  - **Reserva do Tailwind fora do `@supports`** (hex de 8 dígitos ou `rgba` que acompanha o par): **fica intacta**. Navegador sem `color-mix` vê a V3 de hoje.
  - **Cor com transparência sem par** (ex.: `rgba(...)` escrito em `globals.css` ou em classe arbitrária de sombra): reescrita no lugar para o mesmo `color-mix(...)`. O Tailwind 4 já tem como alvo Safari e iOS 16.4, Chrome 111 e Firefox 128 (configuração do `@tailwindcss/node`, exigência de `@property`), todos com `color-mix`; navegador mais antigo já renderiza a plataforma com defeito hoje. (O browserslist padrão do Next 16.2.1 ainda cita Firefox 111, mas o limite real é o do Tailwind 4.)
  - Erro no plugin = build falha (não sobe CSS pela metade).
  - **Provas no PR**: (a) fixtures com o CSS real de um `next build` (produção) e de um `next dev`, versionados em `tests/fixtures/tema-enterprise/`; (b) contagem de cada cor da tabela no CSS final de produção antes e depois do plugin: depois, o literal da V3 só pode aparecer (1) como padrão dentro de `var(--wl-...)` ou (2) na declaração de reserva fora de qualquer `@supports` de `color-mix`; o número de regras e de blocos `@supports`/`@layer` é igual antes e depois; (c) prova de que o plugin carrega no `next build` e no `next dev` (log do plugin com a contagem de trocas).
- `app/(platform)/layout.tsx`: com tema válido, emite `<style>` com `:root{--wl-...}` (sem mudar fonte). Como as variáveis ficam no `:root`, alcançam `<body>`, portais do Radix, Toaster e o modal `confirmar()`. `generateMetadata` (mesma busca do layout via `cache()` do React; nunca redireciona nem lança erro; sem tema, cai no título e ícone da V3): `title: { template: "%s · {marca}", default: "{marca}" }` para Enterprise e `{ template: "%s · V3 Partners", default: "V3 PARTNERS · Plataforma Financeira" }` para os demais; `icons: { icon: <ícone do Enterprise> }`.
- **Favicon**: `app/favicon.ico` passa para `public/favicon.ico` e `app/layout.tsx` declara `icons: { icon: "/favicon.ico" }` no `metadata`. Motivo: o Next sempre injeta o `app/favicon.ico` da convenção de arquivo antes dos ícones dos layouts filhos (`resolve-metadata.js`, `postProcessMetadata`), e a página sairia com dois ícones.
- **Títulos fixos com "V3 Partners"** em 17 páginas da plataforma passam a exportar só o nome da tela (o sufixo vem do `template` do layout): `admin-links`, `admin-marketplace`, `bolsa`, `bolsa/mesa`, `configuracoes`, `configuracoes/integracoes`, `docs/governanca`, `juridico/contratos`, `juridico/contratos/assinados`, `marketplace`, `marketplace/mesa-capitais`, `marketplace/vitrine`, `mercado`, `meus-ativos`, `meus-compradores`, `meus-links`, `perfil` (todas em `app/(platform)/.../page.tsx`). Para a V3 o título final continua "{tela} · V3 Partners".
- `components/layout/sidebar.tsx`, `topbar.tsx`, `platform-shell.tsx`: os `rgba(201,168,76,...)` inline do menu e do topo passam a `var(--wl-acento, ...)`. Caixa do logo no menu: com tema, largura livre até 150 px, fundo = cor principal (o manual pede a negativa sobre o Azul Marinho) e **padding interno igual ao diâmetro do ponto verde** (~16 px para a logo a 120 px), cumprindo a área de proteção. Itens, grupos e rótulos do menu não mudam.
- `app/api/enterprise/marca/route.ts`: aceita `cor_principal`, `cor_acento`, `logo_claro`, `icone`, `remover_logo_claro`, `remover_icone`, `remover_tema`. **Toda gravação grava `audit_logs` com `logAuditStrict` aguardado antes da escrita, um registro por gravação** (`action: "UPDATE"`, `entity: "profiles"`, `entity_id: masterId`, `user_id` = quem gravou). No modo ADMIN, o registro é o do `logAntesDaEscritaAdmin` que já existe (não duplica); para o master, é o novo. Conteúdo: com antes/depois de `white_label_nome`, `white_label_logo_url` e `white_label_tema`; o select de "antes" passa a incluir `white_label_tema`. Falha no log = gravação não acontece. O modo ADMIN mantém o log que já tem.
  Uploads novos, **lista única por campo**:
  - logo para fundo claro: PNG ou WEBP, até 2 MB (sem SVG);
  - ícone: PNG (64 a 1024 px) ou ICO (64 a 256 px; o cabeçalho do ICO só vai até 256), até 512 KB, **quadrado** (largura = altura, lidas do cabeçalho do arquivo; num ICO com várias imagens, **todas** as entradas precisam ser quadradas e estar entre 64 e 256 px);
  - tipo conferido pelos **bytes iniciais** (PNG `89 50 4E 47`, WEBP `RIFF....WEBP`, ICO `00 00 01 00`), não pelo `file.type` do navegador.
  O upload do logo atual (fundo escuro) não muda nesta entrega. Ao remover logo para fundo claro, ícone ou tema, o arquivo também é apagado do bucket (senão continuaria acessível pela URL pública).
- `app/api/public/white-label/route.ts`: devolve também cor principal, cor de acento e ícone (só dados públicos de marca).
- `app/(auth)/login/page.tsx`: aplica o tema devolvido (variáveis no `document.documentElement`, fundo, logo, botão) e **troca o `href` do `<link rel="icon">` que já vem do metadata raiz** (não acrescenta outro).
- `GET /api/enterprise/marca`: passa a devolver também `tema` (hoje só `marca` e `ehMaster`), para a tela de marca preencher os campos e a prévia.
- `components/enterprise/*` (aba Marca): campos novos + prévia.
- `CLAUDE.md`: parágrafo da exceção (ver seção acima).

### Tabela de cores: V3 → variável → valor AGS
| Cor V3 | Papel | Variável | AGS (derivado) |
|---|---|---|---|
| `#09081A` | fundo | `--wl-fundo` | `#020540` (principal escurecida) |
| `#12112A`, `#0D1929` | fundo alternativo | `--wl-fundo-2` | `#030650` |
| `#111F35`, `#122036` | base (menu, inputs) | `--wl-base` | `#050B5C` |
| `#162744` | cartão | `--wl-cartao` | `#0A1270` |
| `#1B3050` | cartão alternativo | `--wl-cartao-2` | `#0F187C` |
| `#243A66` | médio (hover, scrollbar) | `--wl-medio` | `#1A2490` |
| `#C9A84C` | acento | `--wl-acento` | `#00E000` (cor de acento) |
| `#E8C97A` | acento claro | `--wl-acento-2` | `#00E000` (mesma; o manual não tem verde claro) |
| `#F0ECE4`, `#F5F1E8`, `#E8EDF5` | texto principal | `--wl-texto` | `#FFFFFF` |
| `#7A8FA8` | texto secundário | `--wl-texto-2` | `#9AA3D9` |
| `#9BAFC5` | texto secundário claro | `--wl-texto-3` | `#C9CEF0` |
Cores com menos de 100 ocorrências (ex.: `#13223A`) continuam V3 e entram em `docs/tema-enterprise-pendencias.md`, gerado por script (`npm run tema:pendencias`, não pelo plugin, para o build não escrever arquivo) e commitado, para a 2ª etapa.

**Fórmula dos tons derivados** (`lib/enterprise-tema.ts`), em OKLCH a partir da cor principal P e do acento A, para qualquer Enterprise ter resultado previsível: fundo = P com L × 0,55; fundo-2 = L × 0,62; base = L × 0,72; cartão = L × 0,86; cartão-2 = L × 0,93; médio = L × 1,10 (máx. 0,45); acento e acento-2 = A; texto = branco; texto-2 = P com L 0,72 e croma × 0,35; texto-3 = P com L 0,86 e croma × 0,2. Os valores AGS da tabela acima são a referência visual da prévia; na implementação, a tabela é recalculada pela fórmula com P = `#040968` e A = `#00E000`, atualizada neste BRIEF e conferida por teste (o valor final é o da fórmula).

## UX: ONDE O USUÁRIO VÊ ISSO
- **Equipe e master da AGS, plataforma logada**: mesmo menu e mesmas telas da V3; dourado vira verde AGS; fundos navy viram os azuis da tabela; creme vira branco; fonte DM Sans, igual à V3; logo negativa no topo do menu; aba do navegador "AGS Finance" com o ícone azul. Modais, menus suspensos e avisos seguem o mesmo tema. Rodapé do menu continua "Powered by V3 Partners". Partners da V3 não veem diferença.
- **Login em domínio próprio**: fundo Azul Marinho, logo negativa, botão "Entrar" verde com texto azul, ícone da AGS na aba. Pode aparecer o visual da V3 por um instante antes do tema carregar (a tela busca a marca depois de abrir); a mudança de tema pode levar até 5 minutos para chegar ao login (cache da rota pública).
- **E-mails e PDFs**: sem mudança (logo negativa da AGS sobre o fundo escuro da V3, como hoje).
- **Aba "Marca" em `/enterprise`** (master e ADMIN em `?master=`), nova seção "Cores":
  - "Cor principal" e "Cor de acento": seletor de cor + campo HEX (`#RRGGBB`);
  - "Logo para fundo escuro" (o atual), "Logo para fundo claro (PNG ou WEBP)" e "Ícone da aba (PNG ou ICO, quadrado, 64 a 1024 px)", com prévia sobre o fundo certo;
  - prévia ao vivo (menu, botão, cartão);
  - trava de contraste WCAG AA (4,5:1) em: texto branco sobre a cor principal e sobre os tons cartão e médio; texto secundário sobre cartão; texto da cor principal sobre o acento; **acento como texto sobre fundo, base e cartão** (o dourado da V3 é usado como cor de rótulos, links e valores). Abaixo disso, aviso vermelho e Salvar travado: "Essas cores não têm contraste suficiente para leitura. Escolha um tom mais escuro para a cor principal ou mais claro para o acento.";
  - ações destrutivas com `confirmar()` de `lib/aviso.ts`, `{ perigo: true }` (modal vermelho que só fecha pelos botões), nunca `window.confirm`:
    - "Voltar ao visual da V3" (`remover_tema` apaga o jsonb inteiro: cores, ícone e logo para fundo claro; ficam o nome e o logo para fundo escuro): título "Voltar ao visual da V3", texto "As cores, o ícone da aba e o logo para fundo claro serão apagados, e a plataforma volta às cores da V3 para você e toda a sua equipe. O nome e o logo da marca continuam. Continuar?", botão "Apagar tema";
    - "Remover logo para fundo claro": título "Remover logo para fundo claro", texto "O logo para fundo claro sai da sua marca. Para usar de novo, será preciso enviar o arquivo outra vez. Continuar?", botão "Remover logo";
    - "Remover ícone": título "Remover ícone da aba", texto "A aba do navegador volta a mostrar o ícone da V3 para você e toda a sua equipe. Continuar?", botão "Remover ícone".
  - Mensagem ao salvar: "Visual atualizado. Sua equipe vê a mudança no próximo carregamento da página."

## DEPENDENCIES
- PR #414 (modo ADMIN em `/enterprise?master=`): no ar.
- Migration 20261120a (trigger de colunas de `profiles`): aplicada.
- Migration `20261121_white_label_tema.sql`: aplicar antes do deploy do código (o código também funciona sem ela: tema nulo).
- Prova de acesso (6.8) rodada em transação antes de aplicar (ver PLANO DE TESTE).
- **Logo colorida oficial da AGS**: só necessária para documentos de fundo claro (outro BRIEF). **Não** recolorir a negativa (o manual proíbe recriar a logo).

## RISKS (nunca "nenhum")
- **Cobertura**: estilos inline com cor da V3 fora do menu, topo e login (39 arquivos), SVGs com `fill` fixo e cores definidas em JS (gráficos) não passam pelo CSS e continuam V3. Cores fora da tabela também. Mitigação: lista em `docs/tema-enterprise-pendencias.md`; 2ª etapa.
- **Plugin PostCSS**: depende do formato do CSS que o Tailwind v4 gera (hex, `color-mix`, `--tw-gradient-*`). Mitigação: teste do plugin com amostras desses formatos e comparação de screenshot da V3 antes/depois (tem que ser idêntica).
- **Proporção do manual**: a plataforma é escura, então fica perto de 90% azul, contra ~60% azul e ~30% branco do manual. Precisa do aceite do Hamilton (e, se ele quiser, da AGS) sobre a prévia.
- **Contraste**: cliente pode escolher cores ilegíveis. Mitigação: trava WCAG AA na gravação, com os tons derivados.
- **Segurança de upload**: bucket público sem limite de tipo no banco; tipos novos conferidos pelos bytes e sem SVG. **SVGs já enviados** (logo atual) continuam como estão; o logo atual da AGS é PNG.
- **Fonte**: a AGS pede Poppins no manual e a plataforma segue com DM Sans (decisão do Hamilton). Se a AGS reclamar, a troca é um campo a mais no tema (BRIEF futuro).
- **Breaking change**: nenhum para quem não tem tema (variável ausente = cor de hoje). Coluna ausente não derruba nome e logo (select separado).
- **Login**: visual da V3 por um instante antes do tema (tela client). Aceito nesta entrega; resolver no servidor pelo host fica como melhoria.
- **Regras institucionais**: exceção ao CLAUDE.md (ver seção própria).

## APPROACH
- Escolhida: **plugin PostCSS sobre o CSS compilado** + variáveis no `:root` emitidas só para Enterprise com tema. Cobre todas as variantes do Tailwind (hover, group-hover, disabled, responsivo, `!important`, gradientes, opacidade), mantém a ordem e a especificidade originais, alcança portais e `<body>`, e não muda nada para a V3 (o padrão de cada variável é a cor atual). Genérico para qualquer Enterprise.
- Descartada 1: **gerador de regras por classe em `[data-wl-tema]`** (versão da rodada 1): regra fora de `@layer` ganha das utilities e quebra variantes com cor que não é da V3 no mesmo elemento; exigiria reimplementar o motor de variantes do Tailwind v4; não alcança portais.
- Descartada 2: **trocar as ~15 mil cores fixas por tokens no código**: o certo a longo prazo, mas toca centenas de arquivos de uma vez, com risco alto de regressão na V3.
- Descartada 3: **só logo e uma cor de destaque**: a AGS veria a plataforma dourada com a logo dela, contra o manual.
- Descartada 4: **CSS fixo da AGS**: resolve só um cliente.

## PLANO DE TESTE
- `tests/enterprise-tema.test.ts`: validador (hex, URL fora do bucket, tema inválido = null); contraste (`#FFFFFF` sobre `#040968` passa; `#FFFFFF` sobre `#00E000` reprova); tons derivados determinísticos.
- `tests/postcss-tema-enterprise.test.ts`: roda o plugin sobre os fixtures reais de `next build` (par desaninhado) e `next dev` (par aninhado na regra, dentro de `@layer utilities`); nenhuma cor da tabela sobra fora de `var(--wl-...)` ou da reserva; a reserva fora do `@supports` fica igual; dentro do `@supports` do Tailwind nenhum literal da V3 sobra, e o tema chega pelas variáveis do `@theme` reescritas no `:root`; o fixture do `next build` é a saída do `@tailwindcss/postcss` com `NODE_ENV=production` (o que entra no plugin), e a prova (b) é sobre o CSS final; nenhuma regra nova, nenhum seletor novo e a mesma árvore de `@layer`/`@media`/`@supports`; `!important` e `--tw-gradient-*` cobertos; cor fora da tabela intacta; maiúsculas/minúsculas e `rgb()` com espaço reconhecidos.
- Tons derivados: a fórmula com `#040968`/`#00E000` gera os valores da tabela.
- Upload: PNG renomeado para `.ico`, arquivo com `type` falso e ícone não quadrado → recusados; ICO e PNG válidos → aceitos.
- Visual (puppeteer, login de teste ENTERPRISE com o tema da AGS): menu, dashboard, Mesa de Crédito, CRM, modal de proposta, Academy, **modal `confirmar()`, Select e Dropdown abertos e um toast**; screenshots no PR.
- Mesmo roteiro com um PARTNER da V3 (incluindo telas com scrollbar e cartões de `globals.css`, cujas reservas `rgba` viram `color-mix`), **no build de produção** (`next build` + `next start`): screenshots idênticas às de antes do PR.
- HTML de uma página logada da AGS: um único `<link rel="icon">`, o da AGS; de um partner V3: um único, o da V3. Título da aba: "Configurações · AGS Finance" para a AGS e "Configurações · V3 Partners" para a V3.
- Remover ícone: arquivo some do bucket (URL antiga devolve 404).
- Login pelo domínio de teste: fundo, logo, ícone; **um único `<link rel="icon">`** no HTML.
- API: master salva tema (200 e `audit_logs` gravado); usuário da equipe tenta salvar (403); ADMIN em `?master=` salva (200, log).
- **Prova de acesso no banco, em `BEGIN ... ROLLBACK`, antes de aplicar em produção** (com `set local role` e `request.jwt.claims`):
  - (a) `anon`: `select white_label_tema from profiles` → nenhuma linha ou erro;
  - (b) usuário da equipe e partner comum: `update profiles set white_label_tema = ... where id = <master>` → 0 linhas ou 42501;
  - (c) o próprio master: mesmo update → 42501 (trigger);
  - (d) partner comum lendo o tema de outro master pela REST: o resultado é o que a política atual de SELECT de `profiles` já permite. A regra é que o tema é dado público de marca e não precisa de proteção extra. O resultado é registrado no PR;
  - (e) `select policyname, cmd, roles from pg_policies where schemaname='storage' and tablename='objects'` → nenhuma política de INSERT/UPDATE para `authenticated` ou `anon` no bucket `white-label` (resultado colado no PR).
- Depois do deploy: configurar a AGS pelo modo ADMIN e conferir com o login do Marciano (com ele ou com o Hamilton olhando).

## ESTIMATE
L. Cerca de 1 dia (plugin + layout + tela de marca + login + testes visuais). Confiança média: a cobertura só se confirma nas screenshots.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal novo: o tema guarda só cores e URLs de imagens de marca (dados públicos da empresa). O uso da marca da AGS na plataforma está coberto pelo contrato de Parceria v2.4 (white label, item 3.14), e o manual foi enviado pelo próprio cliente. Contratos seguem com a identidade da V3 (decisão do Hamilton 19/11).

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (21/11): BLOQUEADO, 10 falhas: (1) log prometido não existia → auditoria em toda gravação com `logAuditStrict`; (2) confirmação de ações destrutivas → `confirmar()` com perigo, títulos e botões; (3) tipos de upload contraditórios e SVG fraco → lista única por campo, sem SVG, magic number, quadrado por dimensões; (4) prova de acesso incompleta → (a)–(e) em transação; (5) portais e body fora do tema → variáveis no `:root`; (6) cascata do Tailwind v4 → plugin PostCSS no CSS compilado; (7) mapa de cores indefinido → tabela; (8) e-mails/PDFs são de fundo escuro → fora do escopo, sem mudança; (9) conflito com o CLAUDE.md → seção de exceção; (10) rollback e coluna ausente → select separado e ordem do rollback. Sugestões aplicadas: título e ícone por `generateMetadata`, PWA/theme-color seguem V3, aviso do instante V3 no login e do cache de 5 min, contraste nos tons derivados, revalidação na leitura, padding da área de proteção, comportamento do build, proporção como risco.
Mudança de escopo durante a rodada 2 (21/11): fonte removida do tema por decisão do Hamilton ("continuar a fonte das letras da v3").
Rodada 2 de 6 (21/11): BLOQUEADO, 5 falhas: (TEC.1) formato real do CSS de produção → comparação por valor, fixtures reais, contagem e prova de carga; (TEC.2) reserva para navegador antigo → declaração original mantida + par em `@supports`; (TEC.3) favicon duplicado → `public/favicon.ico` + `icons` no metadata raiz; (TEC.4) títulos fixos → `template` + 17 páginas listadas; (3.3) textos dos modais → mensagens completas. Sugestões aplicadas: tema fora de `Marca`, um registro de auditoria por gravação, pendências por script, ICO até 256, fórmula dos tons, arquivo apagado do bucket ao remover, ciência do João. (A sugestão sobre `<link>` da fonte não se aplica mais: fonte saiu do escopo.)
Rodada 3 de 6 (21/11): BLOQUEADO, 1 falha: (TEC.2 resíduo) par `@supports` que o Tailwind já gera → plugin só reescreve valores no lugar, nunca cria regra; declaração dentro do `@supports` do Tailwind reescrita, reserva intacta; prova (b) corrigida; fixtures das formas aninhada e desaninhada com `@layer`. Sugestões aplicadas: contraste do acento como texto, `href` do ícone trocado no login, GET da marca devolve `tema`, regra do ICO com várias imagens.
Rodada 4 de 6 (21/11): **LIBERADO**, zero falhas. Correções técnicas de texto aplicadas depois do veredito (sem mudar escopo): par `@supports` só para cores do `@theme` e sem literal V3 dentro, alvo completo de navegadores (limite do Tailwind 4), detecção da reserva, origem do fixture do build, screenshots de scrollbar/cartões. Antes do merge: ciência do João sobre a exceção ao CLAUDE.md e aceite do Hamilton sobre a proporção de cor.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO, rodada 4, 21/11/2026
- Go: Hamilton, 21/11/2026 (capturado pelo hook).
- Exceção ao CLAUDE.md: autorizada pelo Hamilton no chat em 22/11/2026 ("ta autorizado"); ciência do João dispensada por ele.
- Prova de acesso (22/11/2026, rodada pelo Hamilton no SQL Editor, em BEGIN ... ROLLBACK, com a coluna criada na transação):
  - (a) anon lendo profiles: 0 linhas visíveis.
  - (c) o próprio master (JWT authenticated) gravando white_label_tema: bloqueado, 42501 "Alteração não permitida neste campo do perfil." (trigger profiles_trava_colunas_sensiveis).
  - (b) partner comum gravando o tema de outro master: coberto por (c) (o trigger barra qualquer sessão não ADMIN, e a RLS de update é só do próprio perfil).
  - (d) leitura do tema por partner comum: segue a política de SELECT atual de profiles; tema é dado público de marca (cores e URLs públicas), sem proteção extra.
  - (e) políticas de storage.objects abertas a public: admin_full_storage (ALL), granted_read_storage (SELECT) e granted_write_storage (INSERT), as três restritas a bucket_id = 'v3-docs-publico'. Nenhuma política de escrita para anon/authenticated no bucket white-label.
- Migration aplicada em produção: 22/11/2026, pelo próprio Hamilton no SQL Editor ("Success. No rows returned"), com o SQL de `20261121_white_label_tema.sql` mostrado no chat antes. Ele aplicou e pediu para continuar; não houve mensagem começando com "go" para esta etapa (registro de honestidade).
