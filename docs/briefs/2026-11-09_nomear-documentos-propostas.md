# BRIEF: Nome automático dos documentos anexados às propostas (Mesa de Crédito e Mesa Operacional)

> Data: 2026-11-09 | Autor: Claude (pedido do Hamilton) | Status: GO COM OVERRIDE (QA BLOQUEADO na rodada 6, falha aceita: parecer do Robson), única falha: parecer do Robson
> Salvar em `docs/briefs/2026-11-09_nomear-documentos-propostas.md` e commitar junto com o código.

## PEDIDO
Hamilton, 09/11/2026: "sobre os documentos anexados, tem como analisar o documento e o sistema mesmo renomear os arquivos com os dados de cada um". Escopo e padrão definidos por ele: "das propostas da mesa de crédito/mesa operacional", padrão `Tipo - Nome`, e "quando for faturamento por exemplo colocar: faturamento 2026, ou 2025, DRE 2026 ou 2025 e por aí adiante".

## SCOPE
Cada arquivo anexado a uma proposta de crédito (`credit_desk_proposals.documents`) passa a ter um **nome de exibição** gerado pela leitura do próprio documento com IA, no padrão:

- `Tipo Período - Titular.ext` quando o documento tem período de referência. Ex.: `Faturamento 2026 - Empresa XYZ Ltda.pdf`, `DRE 2025 - Empresa XYZ Ltda.pdf`, `Extrato Bancário 2026 - Joao da Silva.pdf`, `Imposto de Renda 2025 - Joao da Silva.pdf`.
- `Tipo - Titular.ext` quando não tem. Ex.: `CNH - Joao da Silva.jpg`, `Cartão CNPJ - Empresa XYZ Ltda.pdf`, `Matrícula - Joao da Silva.pdf`.
- Período: o ano de referência do documento. Se o documento cobre meses de dois anos (ex.: faturamento de out/2025 a mar/2026), `2025-2026`.
- Sem leitura confiável (foto ilegível, tipo não reconhecido, arquivo grande demais ou formato não suportado): **mantém o nome original**.

O arquivo no storage **não é movido nem renomeado**. O nome novo aparece na aba Documentos do modal, no novo botão de baixar de cada arquivo e no ZIP. O botão "Abrir" continua abrindo o arquivo no navegador, como hoje.

Vale **só para arquivos novos**, enviados a partir da entrada no ar (decisão do Hamilton, 09/11/2026: "não quero que leia os antigos, somente os novos que entrarem no sistema"). Corte: constante `NOMEAR_A_PARTIR_DE` em `lib/documentos/nomear-proposta.ts`, preenchida no PR com a data e hora (UTC) do deploy; só entram itens com `uploaded_at >= NOMEAR_A_PARTIR_DE`. Leitura em produção (09/11/2026): os 2.651 arquivos existentes têm `uploaded_at` preenchido, então **nenhum** deles é lido, nem pelo upload novo na mesma proposta nem pelo cron. Arquivo sem `uploaded_at` (não existe hoje) também não é lido. Os nomes dos antigos ficam como estão.

Fora do escopo: anexos do link de captação antigo gravados em `metadata.documentos` (sem `storage_path`) e a resposta da API de parceiros (`/api/v1/propostas/{id}/documentos`), que continua devolvendo o nome original.

## IMPACT
- Arquivos afetados:
  - `supabase/migrations/20261109_credit_document_names.sql` (novo) + `20261109_credit_document_names_rollback.sql.txt` (novo).
  - `lib/documentos/nome-arquivo.ts` (novo, funções puras sem I/O): `montarNomeBase({ tipo, periodo, titular }, nomeOriginal)` (padrão acima, remove caracteres proibidos em nome de arquivo `\ / : * ? " < > |`, limita a 120 caracteres, preserva a extensão original), `nomesDeExibicao(arquivos, mapaNomes)` (aplica o desempate, ver "Ordem e desempate"), `TIPOS_DOCUMENTO` (lista fechada de tipos, abaixo).
  - `lib/documentos/ler-para-nome.ts` (novo): baixa o arquivo com o service client do bucket certo (reaproveita a regra `resolveBucket` de `documents/route.ts`, movida para `lib/documentos/bucket.ts` e importada pelas duas), manda **só a primeira página** do PDF (corte com `pdf-lib`, já no projeto; pedido do Hamilton em 09/11/2026: a primeira página já identifica o documento) e, só quando essa leitura volta com `confianca < 0.7` e o PDF tem mais páginas, faz **uma** segunda leitura com as 3 primeiras páginas (no máximo 2 chamadas por arquivo, as duas contam como uma tentativa); manda o conteúdo **inline (base64 na mensagem)** para o Claude, sem usar a Files API (nada fica armazenado na Anthropic como arquivo), e devolve `{ tipo, periodo, titular, confianca }` em JSON. Modelo: `claude-haiku-5-5` (Claude Haiku 5.5), o de menor custo disponível (decisão do Hamilton, 09/11/2026: "usar o custo mais baixo possível"), com `output_config: { effort: "low" }`, pensamento desligado (`thinking: { type: "disabled" }`, aceito em effort `low`), resposta em JSON por `output_config.format` (sem `temperature`, que o modelo recusa) e `max_tokens` 300. É um modelo novo no projeto (o Haiku 4.5 aparece em 31 pontos de 29 arquivos em `app/`, `lib/` e `components/`, contagem de 09/11/2026): se o teste real mostrar nomes errados, volta para `claude-haiku-4-5-20251001` com BRIEF atualizado.
  - `lib/documentos/nomear-proposta.ts` (novo): `nomearDocumentosPendentes({ proposalId?, limite, prazoMs })`, que lê os itens de `documents` pendentes (ver "Seleção de pendentes"), chama a leitura e grava o resultado.
  - `lib/documentos/bucket.ts` (novo): `resolveBucket` extraído de `documents/route.ts` sem mudar a regra.
  - `app/api/credit-proposals/documents/route.ts`: POST chama `after(() => nomearDocumentosPendentes({ proposalId }))` depois de responder; GET junta o nome de exibição de cada arquivo (`nome_exibicao`, já desempatado) e devolve **duas URLs**: `url` (a de hoje, sem `download`, para o botão "Abrir" continuar abrindo no navegador) e `download_url` (signed URL com `download: nomeExibicao`, para o novo botão de baixar). As URLs são geradas em lote (`createSignedUrls`, uma chamada para as de abrir) e a de baixar é gerada só no clique, por `GET /api/credit-proposals/documents/download?proposal_id=&storage_path=` (mesma checagem de acesso do GET), para abrir a aba não fazer uma chamada ao Storage por arquivo; DELETE apaga a linha correspondente.
  - `app/api/credit-proposals/documents/register/route.ts`: mesmo `after()` do POST.
  - `app/api/credit-proposals/documents/zip/route.ts`: aplica `nomesDeExibicao` aos itens de `documents` (mesma ordem e mesmo desempate do modal); o `uniqueZipName` atual fica só como rede para colisão com os anexos de `metadata.documentos`.
  - `app/api/cron/nomear-documentos/route.ts` (novo): `CRON_SECRET` igual aos outros crons, `maxDuration = 300`, até 150 arquivos por execução, para antes de 250 s.
  - `vercel.json`: cron `/api/cron/nomear-documentos` às 05:30 (UTC), diário.
  - `components/mesa-credito/proposta-detail-modal.tsx`: a lista de arquivos da aba Documentos mostra o nome de exibição; tooltip com o nome original, o tipo detectado e a data da leitura; novo ícone de baixar (`Download`) ao lado do "Abrir". Nas linhas alteradas, as cores fora da paleta (`text-blue-400`, `emerald`) passam para ouro (`text-primary`) e muted.
  - `tests/unit/nome-arquivo.test.ts` (novo).
- Tabelas afetadas: **nova** `public.credit_document_names` (DDL abaixo). `credit_desk_proposals` **não é alterada nem reescrita**: a lista `documents` continua igual, só é lida.
- Rotas afetadas: `GET/POST/DELETE /api/credit-proposals/documents`, `POST /api/credit-proposals/documents/register`, `GET /api/credit-proposals/documents/zip`, nova `GET /api/cron/nomear-documentos` (só cron), nova `GET /api/credit-proposals/documents/download` (arquivo `app/api/credit-proposals/documents/download/route.ts`, gera a URL de baixar com o nome novo, mesma checagem de acesso do GET).
- APIs e integrações afetadas: Anthropic (leitura do documento), Supabase Storage (download do arquivo para leitura, signed URL com nome de download).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Mesa de Crédito (níveis 1, 2 e 3) ou Mesa Operacional → abrir a proposta → aba **Documentos** → em cada item do checklist, a lista de arquivos anexados mostra o nome novo (ex.: `Faturamento 2026 - Empresa XYZ Ltda.pdf`). Passar o mouse mostra "Nome original: {nome enviado}. Lido como {tipo} em {data}.", com {data} em DD/MM/AAAA calculado de `updated_at` no fuso `America/Sao_Paulo` (leitura feita à noite não aparece com o dia seguinte). O link "Abrir" continua abrindo o arquivo no navegador (igual a hoje). O novo ícone de baixar, ao lado, salva o arquivo com o nome novo. O botão "Baixar tudo (.zip)" usa os nomes novos.
- Mesmo modal para partner, equipe e mesa (componente `proposta-detail-modal.tsx`, usado em `credit-desk-client`, `nivel1-client`, `mesa-op-client`, `crm-client` e outros). Quem já vê o arquivo hoje vê o nome novo; ninguém passa a ver arquivo que não via.
- Arquivo recém-anexado: aparece primeiro com o nome original e ganha o nome novo depois da leitura (segundos, ao reabrir ou recarregar a aba). Anexos que chegam pela API de parceiros (`/api/v1`), pelo chat ou pelo link público de upload ganham o nome no cron do dia seguinte.
- Estado vazio: proposta sem anexo não muda. Arquivo sem leitura confiável continua com o nome original, sem aviso de erro.
- Sem UI? Não se aplica.

## DEPENDENCIES
- Deve existir antes: bucket `credit-documents`, lista `documents` com `storage_path` (existe em todos os 2.651 itens lidos em produção), `ANTHROPIC_API_KEY`, `CRON_SECRET`, `pdf-lib`, `after` do `next/server` (já usado em 8 rotas).
- Migrations pendentes: `20261109_credit_document_names.sql` (este BRIEF). Aplicação em produção com segundo go, depois de mostrar o SQL.

## RISKS (nunca "nenhum")
- Nome errado: a IA pode classificar mal (ex.: chamar um balancete de DRE) ou errar o ano. Mitigação: lista fechada de tipos, exige `confianca >= 0.7` para trocar o nome, nunca inventa titular (sem titular legível o nome fica `Tipo Período.ext`), o nome original fica guardado e aparece no tooltip. Não existe correção manual neste BRIEF (ver alternativas).
- LGPD: a primeira página do documento é enviada à Anthropic para leitura (as 3 primeiras só quando a primeira não basta para identificar; imagem vai inteira, por ser uma página só). Mesmo tratamento que a plataforma já faz hoje com documentos de proposta em `/api/credit-proposals/ocr-batch`, `/api/ocr-validar` e `lib/leitura-cadastro.ts`. A nova tabela guarda tipo, período e **nome do titular** (dado pessoal que já está nos documentos e na proposta), não guarda CPF, CNPJ nem o conteúdo do documento. O nome do arquivo não leva CPF nem CNPJ (o nome aparece em downloads, e-mails e logs). Retenção: a linha some junto com a proposta (`on delete cascade`) e com o arquivo (DELETE da rota). [VALIDAR COM ROBSON]: estender a leitura por IA, hoje feita sob demanda (botão de OCR), para os documentos anexados a partir da entrada no ar, automaticamente; os já existentes não são lidos.
- Segurança de acesso ao banco (anon, RLS, views, funções): tabela nova com RLS habilitada e **sem nenhuma política**; `revoke all` de `anon` e `authenticated`. Só o service role lê e grava, nas rotas do servidor que já checam o acesso à proposta: GET e ZIP com `READ_ROLES` (ADMIN, GESTAO, MESA_OPERACIONAL, FINANCEIRO) ou `ehDaEquipe`; POST, register e DELETE com `ADMIN_ROLES` ou `ehDaEquipe`. Sem view, sem função, sem grant novo, sem bucket novo.
- **Imposição no banco (6.5):** como não há política para `authenticated`, o banco nega qualquer leitura com sessão de usuário. A regra de quem lê fica só na rota, por desenho, e o teste 6.8 prova a negação no banco.
- Breaking changes: não. `documents` não muda; quem não tem linha na tabela nova continua vendo o nome original.
- Concorrência: a leitura nunca reescreve `credit_desk_proposals.documents` (motivo de a tabela ser separada: as rotas de upload fazem ler-e-gravar na lista inteira, e uma segunda gravação poderia apagar um anexo novo). Duas leituras do mesmo arquivo ao mesmo tempo (after + cron): ver "Gravação" no desenho técnico; a tabela guarda só o nome **base**, sem sufixo de desempate, então duas gravações simultâneas na mesma proposta não geram conflito de nome.
- Arquivo apagado durante a leitura: antes de gravar, a rotina relê `documents` da proposta e só grava se o `storage_path` ainda estiver lá. O cron também apaga linhas cujo `storage_path` não está mais em `documents` (limpeza de órfãos), para não ficar nome de titular sem arquivo.
- Imposto de Renda: o período é o **exercício** (ano da entrega, como a Receita usa: "IRPF 2025" = exercício 2025, ano-calendário 2024). O prompt diz isso explicitamente. Ano errado no nome pode enganar o analista; o tooltip mostra o tipo detectado para conferência.
- Nome errado permanente: não há correção manual neste BRIEF. Um nome lido com confiança 0,7 fica até outro BRIEF trazer a correção; o nome original e o tipo detectado ficam no tooltip.
- Custo (Haiku 5.5: US$ 0,10 por milhão de tokens de entrada e US$ 0,50 por milhão de saída, até 100 mil tokens por chamada): caso comum, só a primeira página, ~2 a 4 mil tokens de entrada e ~200 de saída, cerca de US$ 0,0003 a 0,0005 por arquivo; pior caso (segunda leitura com 3 páginas), até ~US$ 0,002. Estimativa: sem custo de histórico (antigos não são lidos) e cerca de US$ 0,15 a 0,25/mês para ~460 arquivos novos por mês, a confirmar com o `usage` do teste real. Descartado o Batch API (50% a menos): economizaria centavos por mês e atrasaria o nome do upload em até 24 h. Teto: no máximo 150 arquivos por execução do cron.
- Vercel timeout (60s): a leitura roda fora da resposta (`after`) e no cron (`maxDuration = 300`, para antes de 250 s). O upload não fica mais lento. Se a leitura no `after` não terminar, o cron pega depois.
- Outro: arquivo maior que 20 MB, `.docx` (1 arquivo hoje) ou PDF protegido por senha: status `ignorado`, nome original. Falha da Anthropic: status `erro`, `tentativas + 1`; o cron tenta de novo até 3 vezes. Se a primeira leitura voltou com confiança baixa e a segunda (3 páginas) falhar, grava o resultado da primeira como `sem_leitura` (nome original mantido, sem nova tentativa), porque o arquivo foi lido e só não foi identificado. PDF de uma página só não tem segunda leitura (a primeira já é o arquivo inteiro). Se o corte com `pdf-lib` falhar por outro motivo que não senha (PDF corrompido ou fora do padrão), o arquivo vai inteiro só se tiver até 3 páginas e até 5 MB; acima disso, `ignorado`.
- Outro: o corte `NOMEAR_A_PARTIR_DE` precisa ser preenchido no PR com a hora do deploy; se ficar com data antiga, o cron leria arquivos antigos. Mitigação: teste unitário que falha se a constante for anterior a 09/11/2026, e conferência no primeiro run do cron (nenhuma linha com arquivo de `uploaded_at` anterior ao corte). O risco inverso também existe: corte depois do deploy deixaria os primeiros arquivos novos sem nome, em silêncio. Mitigação: o valor final da constante vai escrito no PR e é conferido contra a hora do deploy.

## APPROACH
- Abordagem escolhida: tabela própria `credit_document_names` (chave = `storage_path`) + leitura automática depois do upload (`after`) e cron diário, nome aplicado na exibição, no download (signed URL com `download`) e no ZIP.
- Alternativa descartada 1: gravar o nome dentro de `credit_desk_proposals.documents`. Descartada: a lista é reescrita inteira por pelo menos 4 rotas (upload, register, API v1, chat); uma leitura que reescreve a lista em paralelo com um upload pode apagar o anexo novo.
- Alternativa descartada 2: renomear/mover o arquivo no storage. Descartada: quebra `storage_path` gravado nas propostas e links já enviados.
- Alternativa descartada 3: colocar CPF/CNPJ no nome. Descartada: espalha dado pessoal em downloads, e-mails e logs.
- Alternativa descartada 4: reaproveitar o resultado do OCR em lote (`ocr-batch`). Descartada: roda só sob demanda e compara campos com o cadastro, não classifica tipo nem período.
- Alternativa descartada 5: correção manual do nome pela equipe. Fica para outro BRIEF se a taxa de erro justificar.

## DESENHO TÉCNICO
Migration:
```sql
create table public.credit_document_names (
  storage_path  text primary key,
  proposal_id   uuid not null references public.credit_desk_proposals(id) on delete cascade,
  nome_exibicao text check (nome_exibicao is null or char_length(nome_exibicao) <= 120), -- nome BASE (sem desempate); null = mantém o original
  tipo          text,
  periodo       text check (periodo is null or periodo ~ '^[0-9]{4}(-[0-9]{4})?$'),  -- "2026" ou "2025-2026"
  titular       text check (titular is null or char_length(titular) <= 100),
  confianca     numeric(3,2) check (confianca is null or (confianca >= 0 and confianca <= 1)),
  status        text not null check (status in ('ok', 'sem_leitura', 'ignorado', 'erro')),
  tentativas    int  not null default 1,
  modelo        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index credit_document_names_proposal_idx on public.credit_document_names (proposal_id);
alter table public.credit_document_names enable row level security;
revoke all on public.credit_document_names from anon, authenticated;
comment on table public.credit_document_names is
  'Nome de exibição dos anexos de credit_desk_proposals.documents, gerado por leitura com IA (BRIEF 2026-11-09). Só service role.';
```
Rollback (`.sql.txt`): `drop table if exists public.credit_document_names;`

Tipos (lista fechada, o modelo escolhe um): CNH, RG, CPF, Certidão de Casamento, Certidão de Nascimento, Comprovante de Residência, Comprovante de Renda, Holerite, Imposto de Renda, Recibo do Imposto de Renda, Extrato Bancário, Cartão CNPJ, Contrato Social, Alteração Contratual, Faturamento, DRE, Balanço Patrimonial, Balancete, Certidão Negativa, Matrícula, IPTU, Escritura, Laudo de Avaliação, Contrato, Procuração, Outro. `Outro` com confiança alta vira `Documento - Titular.ext`.

Resposta do modelo (JSON): `{ "tipo": "...", "periodo": "2026" | "2025-2026" | null, "titular": "..." | null, "confianca": 0.0-1.0 }`. Regras do prompt: nunca inventar; titular como está no documento, com maiúsculas e minúsculas normais; período só quando o documento declara a competência/ano de referência.

Seleção de pendentes: itens de `documents` com `uploaded_at >= NOMEAR_A_PARTIR_DE` (filtro aplicado nos dois caminhos, upload e cron, dentro de `nomearDocumentosPendentes`; comparação como data, `Date.parse`, nunca como texto) cujo `storage_path` não tem linha, ou tem `status = 'erro'` e `tentativas < 3`. No `after()` do upload, só a proposta do upload, qualquer status da proposta. No cron, qualquer status da proposta (pega anexos novos que chegaram pela API de parceiros, pelo chat ou pelo link público, e novas tentativas de `erro`). Ordem: proposta mais recente primeiro.

Gravação: a tabela guarda o **nome base** (sem sufixo de desempate). Primeira leitura: `insert ... on conflict (storage_path) do nothing`. Nova tentativa de uma linha em erro: `update ... set ..., tentativas = tentativas + 1, updated_at = now() where storage_path = $1 and status = 'erro'`. Antes de gravar, relê `documents` e só grava se o `storage_path` ainda existe.

Ordem e desempate (4.1): o desempate é calculado **na exibição**, nunca gravado, sempre pela mesma função `nomesDeExibicao`, usada no GET, no ZIP e no tooltip. Ordem fixa: `uploaded_at` ascendente, depois `storage_path` ascendente. O primeiro arquivo com um nome base fica com o nome limpo; os seguintes recebem ` (2)`, ` (3)`. A comparação ignora maiúsculas/minúsculas e acentos. A lista exibida no modal segue a mesma ordem (`uploaded_at`, depois `storage_path`). Assim o mesmo arquivo tem o mesmo nome no modal, no download e no ZIP, e o nome não muda entre aberturas (só muda se um arquivo mais antigo com o mesmo nome base for apagado).

## PLANO DE TESTE
- Unitário (`tests/unit/nome-arquivo.test.ts`): padrão com e sem período, período de dois anos, sem titular, caracteres proibidos, limite de 120, extensão preservada (inclusive maiúscula), desempate ` (2)` estável pela ordem `uploaded_at`/`storage_path` (mesmo resultado com a lista embaralhada), desempate ignorando acento e caixa, confiança baixa mantém o original, tipo fora da lista vira `Outro`, item com `uploaded_at` anterior ao corte (ou sem `uploaded_at`) não entra nos pendentes, `NOMEAR_A_PARTIR_DE` não é anterior a 09/11/2026, comparação do corte correta com `uploaded_at` em outro fuso (ex.: `-03:00`).
- Typecheck sem erro nos arquivos do PR.
- **Teste de acesso 6.8, antes do segundo go da migration:** `docs/briefs/anexos/2026-11-09_teste-acesso-nomear-documentos.sql` aplica a migration dentro de uma transação desfeita (`begin; ... rollback;`), confere RLS ligada e zero políticas, e tenta `select` e `insert` como `anon` e `select`, `insert` e `update` como `authenticated` com o JWT de um partner comum. Esperado: tudo negado. O resultado é colado neste BRIEF antes de pedir o segundo go.
- **Teste das rotas (6.8):** com um partner de outra equipe, `GET /api/credit-proposals/documents?proposal_id={proposta alheia}` e o ZIP devolvem 403 e nenhum `nome_exibicao`. Feito no preview do PR com uma conta de teste partner; se não houver conta de teste, registrar como não testado e conferir pela leitura do código (a checagem de acesso é anterior à junção dos nomes).
- Download com acento (`Cartão CNPJ`, `Balanço Patrimonial`): conferir no preview, no Chrome e no Edge, se o nome baixado preserva os acentos. Se não preservar, usar a versão sem acento só no nome do download.
- Migration: mostrar o SQL, aplicar só com o segundo go, conferir em produção que a tabela existe com RLS ligada e sem política (`select` em `pg_policies` e `pg_tables`).
- Leitura real em produção (depois da migration): rodar `nomearDocumentosPendentes` numa proposta escolhida pelo Hamilton, com faturamento, DRE e documento pessoal, e conferir os nomes no modal antes de ligar o cron. Registrar neste BRIEF os tokens de cada leitura (`usage`) e quantos arquivos precisaram da segunda leitura de 3 páginas; estimativa: US$ 0,0003 a 0,0005 por arquivo lido só na primeira página (Haiku 5.5, US$ 0,10 por milhão de tokens de entrada). Conferir também a qualidade dos nomes; se o Haiku 5.5 errar tipo ou ano, voltar ao Haiku 4.5 (BRIEF atualizado).
- Cron: chamar a rota com o `CRON_SECRET` uma vez (limite baixo, ex. 10) e conferir as linhas gravadas.

## ESTIMATE
M/L. ~4 h. Confiança média: a qualidade da classificação só se confirma com documentos reais.

## PARECER DE COMPLIANCE
- Leitura automática por IA dos anexos de proposta: [VALIDAR COM ROBSON]. Pergunta: "Podemos ler automaticamente com IA (Anthropic) os documentos anexados às propostas para gerar o nome do arquivo? (a) Vai só a primeira página de cada documento (as 3 primeiras só quando a primeira não basta), inline na mensagem, sem a Files API, então nada fica armazenado na Anthropic como arquivo. (b) Lê só os anexos novos, enviados depois que a função entrar no ar; nenhum dos 2.651 arquivos já existentes é lido. (c) Guarda numa tabela interna o tipo, o ano e o nome do titular (sem CPF/CNPJ), apagados junto com a proposta ou o arquivo. Hoje a leitura por IA já existe, mas só quando a equipe aciona o OCR." Resposta: (pendente). Data: (pendente). Quem respondeu: (pendente).
- Nome do titular na tabela nova: dado que já existe na proposta e nos documentos; sem CPF/CNPJ; apagado com a proposta (`on delete cascade`) ou com o arquivo (DELETE da rota e limpeza de órfãos no cron).

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (3 falhas: [Compliance] parecer do Robson pendente; [6.8] faltava a prova de acesso em transação desfeita e o teste das rotas; [4.1] ordem e desempate não declarados). Corrigidas nesta versão: 6.8 (anexo de teste + teste das rotas no plano) e 4.1 (desempate só na exibição, ordem `uploaded_at`/`storage_path`). A do Robson segue pendente, com a pergunta ampliada pelos pontos (a), (b) e (c) do QA. Sugestões acatadas: duas URLs (Abrir continua abrindo; novo botão de baixar), `resolveBucket` reaproveitado, update separado para nova tentativa, checagem e limpeza de órfãos, IR pelo exercício, tooltip com tipo e data, cores da paleta nas linhas alteradas, linha de fora do escopo para `metadata.documentos` e API v1. Novo nesta versão: histórico só de propostas ativas (~1.092 arquivos).
Rodada 2 de 6: BLOQUEADO (3 falhas: [Compliance] Robson pendente, com a linha de LGPD ainda citando os 2.651; [4.1] IMPACT dizia que o ZIP usava o desempate antigo; [1.5] data do tooltip sem formato). Corrigidas nesta versão: LGPD alinhado ao recorte, ZIP aplica `nomesDeExibicao` (o `uniqueZipName` fica só para `metadata.documentos`), data em DD/MM/AAAA no fuso America/Sao_Paulo. Sugestões acatadas: recorte descrito como "não canceladas nem reprovadas" (COMPLETED entra) também na pergunta ao Robson, nomes mantidos se a proposta for cancelada depois, teste de acesso com `insufficient_privilege` e id real de proposta, teste de acentos no download. Lembrete do QA: rodar o teste de acesso fora do horário de pico (lock breve em `credit_desk_proposals` pela FK).
Rodada 3 de 6: BLOQUEADO (1 falha: [Compliance] parecer do Robson pendente). Nenhuma outra falha. Sugestões acatadas: URLs de abrir em lote e URL de baixar gerada só no clique; frase do SCOPE corrigida.
Mudança depois da rodada 3 (pedido do Hamilton, 09/11/2026): leitura só da primeira página, com segunda leitura de 3 páginas apenas quando a confiança fica abaixo de 0,7. Ajustados IMPACT, RISKS (LGPD), PLANO DE TESTE e a pergunta ao Robson.
Rodada 4 de 6: BLOQUEADO (1 falha: [Compliance] parecer do Robson pendente). A mudança da primeira página passou sem falha nova. Sugestões acatadas: custo refeito para a primeira página (pior caso com a segunda leitura), segunda leitura que falha grava `sem_leitura` com o resultado da primeira, PDF de uma página e falha de corte do `pdf-lib` descritos.
Mudança depois da rodada 4 (decisão do Hamilton, 09/11/2026): só arquivos novos, a partir do deploy (corte `NOMEAR_A_PARTIR_DE` por `uploaded_at`); nenhum dos 2.651 existentes é lido. Ajustados SCOPE, RISKS (LGPD, custo, corte), seleção de pendentes, PLANO DE TESTE e a pergunta ao Robson.
Rodada 5 de 6: BLOQUEADO (1 falha: [Compliance] parecer do Robson pendente). Mudança dos arquivos novos sem falha nova; `uploaded_at` é sempre definido no servidor nas 5 rotas que gravam em `documents`. Sugestões acatadas: "status da proposta" explícito, corte comparado como data com teste de fuso, valor final da constante no PR conferido contra o deploy.
Mudança depois da rodada 5 (decisão do Hamilton, 09/11/2026, "usar o custo mais baixo possível"): modelo trocado de Haiku 4.5 para Haiku 5.5 (`claude-haiku-5-5`), effort `low`, pensamento desligado. Ajustados IMPACT, custo e PLANO DE TESTE.
Rodada 6 de 6: BLOQUEADO (1 falha: [Compliance] parecer do Robson pendente). Troca para o Haiku 5.5 sem falha nova; a pergunta ao Robson cita a Anthropic, não o modelo, e continua correta. Parâmetros conferidos na referência da API (skill claude-api, cache de 06/10/2026): Haiku 5.5 a US$ 0,10/0,50 por milhão até 100 mil tokens, `thinking: disabled` aceito com effort `high` ou abaixo, `temperature` com valor não padrão recusado. O teste real registra `usage` e `model` devolvidos. Teto de 6 rodadas atingido: devolvido ao Hamilton com a falha.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO na rodada 6 de 6 (única falha: [Compliance] parecer do Robson pendente).
- Override: sim. Falha aceita pelo Hamilton com "go mesmo assim" em 09/11/2026, 22:00 UTC: seguir sem o parecer do Robson sobre a leitura automática por IA dos anexos novos. A pergunta segue no campo PARECER DE COMPLIANCE para ser respondida depois; se o Robson negar, a leitura é desligada (remover o `after()` e o cron) e a tabela apagada pelo rollback.
- Go dado por: Hamilton, "go mesmo assim", 09/11/2026 22:00 UTC (registrado pelo hook, válido até 10/11/2026 06:00 UTC).
- Migration aplicada em produção: **sim**, em 09/11/2026, pelo Hamilton no SQL Editor do Supabase ("Success. No rows returned"), com o SQL mostrado no chat e o teste de acesso já aprovado, mas **sem a mensagem de segundo go** antes de rodar (registrado como aconteceu). Conferência só de leitura depois de aplicada: tabela existe com as 12 colunas e 0 linhas (service role); `anon` recebe `42501 permission denied for table credit_document_names`.
- Teste de acesso 6.8 (anexo em transação desfeita): **PASSOU**, rodado pelo Hamilton no SQL Editor do Supabase em 09/11/2026 (nada gravado). Resultado:
  ```
  anon insert              | esperado: negado  | resultado: negado
  anon select              | esperado: negado  | resultado: negado
  partner insert           | esperado: negado  | resultado: negado
  partner select           | esperado: negado  | resultado: negado
  partner update           | esperado: negado  | resultado: negado
  policies na tabela       | esperado: 0       | resultado: 0
  RLS ligada               | esperado: true    | resultado: true
  ```

## EXECUÇÃO (09/11/2026)
- Migration: `supabase/migrations/20261109a_credit_document_names.sql` + rollback `20261109a_credit_document_names_rollback.sql.txt` (SQL igual ao do DESENHO TÉCNICO, com o `comment on table`). Aplicada em 09/11/2026 (ver REGISTRO DE LIBERAÇÃO).
- Código: `lib/documentos/{bucket,nome-arquivo,ler-para-nome,nomear-proposta}.ts`; rotas `documents` (POST com `after()`, GET com URLs em lote e nomes, DELETE apaga a linha), `documents/register` (`after()`), `documents/zip` (nomes de exibição), nova `documents/download`, novo cron `cron/nomear-documentos` (05:30 UTC, `?limite=N` para o teste); `vercel.json`; modal com nome novo, tooltip, botão de baixar e cores da paleta nas linhas alteradas.
- `NOMEAR_A_PARTIR_DE = "2026-11-09T22:00:00.000Z"` (hora do go). Arquivos enviados entre o go e o deploy também são lidos (pelo cron), o que continua dentro de "só novos"; nenhum dos 2.651 anteriores entra.
- Ajustes de implementação em relação ao desenho: imagem acima de 5 MB fica `ignorado` (limite de imagem da API); PDF que o `pdf-lib` não abre vai inteiro só até 5 MB, sem contar páginas (o `pdf-lib` não abre o arquivo para contar); `stop_reason` `refusal` ou `max_tokens` grava `sem_leitura`.
- Testes: `tests/unit/nome-arquivo.test.ts` 9/9 passando. Typecheck sem erro fora de `.next/` (os erros de `.next/types/validator.ts` são de outras branches, já conhecidos).
- Pendentes antes de ligar: teste de acesso 6.8, segundo go e aplicação da migration, teste das rotas com partner de outra equipe no preview, download com acento no Chrome e no Edge, leitura real numa proposta escolhida pelo Hamilton (com `usage` registrado), cron com `?limite=10`.
