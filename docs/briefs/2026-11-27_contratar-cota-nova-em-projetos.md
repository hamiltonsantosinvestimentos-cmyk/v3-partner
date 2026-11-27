# BRIEF: Contratar cota nova (quiz) em Consórcio › Projetos

> Data: 2026-11-27 | Autor: Claude (pedido do Hamilton) | Status: GO DADO (go mesmo assim)
> Prévia aprovada pelo Hamilton em 27/11/2026 ("pode fazer, lembrando que para enterprise, deve aparecer a marca e nome do enterprise"): https://claude.ai/artifact/KY5h6mnUWWiBtmQTsX8cxL

## SCOPE
Botão "Contratar cota nova" em Consórcio › Projetos abre um quiz de 5 passos com dados simples (segmento, valor da carta, parcela que cabe, prazo, lance, quando quer usar, nome/WhatsApp/e-mail do cliente e autorização de contato), com painel "Mercado agora" (Banco Central ao vivo + ABAC fixo com fonte e data). O pedido é gravado numa tabela nova, aparece numa lista com a tarja "CONTRATAÇÃO COTA NOVA", avisa ADMIN e GESTÃO no sino, o master Enterprise do usuário que enviou no sino, e envia e-mail para robson.lino@v3partners.com.br e hamilton@v3partners.com.br. Para login Enterprise, o quiz e a lista mostram a marca (logo e nome) do Enterprise no lugar da V3.

## IMPACT
- Arquivos afetados:
  - `supabase/migrations/20261127a_consorcio_contratacoes.sql` (novo) e `20261127a_consorcio_contratacoes.rollback.sql.txt` (novo)
  - `lib/consorcio/contratacoes.ts` (novo, regras puras: segmentos, prazos sugeridos, validação zod, matriz de acesso, recorte de campos por papel, estimativa de parcela, dados ABAC com fonte e data, textos com a marca)
  - `app/api/consorcio/contratacoes/route.ts` (novo: GET lista + mercado + marca, POST cria e avisa, PATCH status só interno)
  - `app/api/consorcio/contratacoes/[id]/contato/route.ts` (novo: revelar contato com log em audit_logs)
  - `components/consorcio/contratar-cota.tsx` (novo: quiz em modal + seção da lista)
  - `app/(platform)/consorcio/projetos/page.tsx` (botão no cabeçalho + seção acima das ofertas)
  - `tests/unit/contratacoes.test.ts` (novo)
- Tabelas afetadas: `consorcio_contratacoes` (nova). Leitura de `profiles`. Escrita em `notifications` (já existe, mesmo padrão das ofertas).
- Rotas afetadas: `/api/consorcio/contratacoes` (nova), tela `/consorcio/projetos`.
- APIs e integrações: Resend (e-mail, `EMAIL_FROM` sem fallback, como no #442); Banco Central SGS via `indicadoresMercado()` de `lib/mercado/fontes.ts` (já usado na aba Mercado, cache de 30 min); `issueV3Code("CS", null)` para o código (mesma série dos projetos de consórcio); cota de criação `reservarVagaOuNegar` (via `consorcio-contratacoes`), como em projetos.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Consórcio › Projetos, botão dourado "Contratar cota nova" no cabeçalho, ao lado de "Incluir Projeto". Seção "Contratação de cotas novas" logo abaixo do cabeçalho (acima de "Ofertas de cota contemplada"), com contadores Novas, Em cotação e Total e cards com tarja dourada "CONTRATAÇÃO COTA NOVA", a linha "Pedido de cota CS-…" (para não confundir com projeto da mesma série), segmento, status, nome do cliente, carta, parcela, prazo, lance, quando, quem enviou e data (dd/mm/aaaa hh:mm, fuso de São Paulo).
- Ordem da lista: grupos na ordem Nova, Em cotação, Proposta enviada, Contratada, Não seguiu; dentro do grupo, created_at desc. Função `ordenarContratacoes` na lib pura, com teste.
- Contato do cliente (WhatsApp e e-mail) no card: só para quem enviou e para a equipe interna (ADMIN/GESTAO/MESA_OPERACIONAL), sempre mascarado por padrão (WhatsApp `+55 (21) *****-7178`, e-mail `ma***@dominio.com`). O ícone de olho chama `POST /api/consorcio/contratacoes/[id]/contato`, que grava em `audit_logs` (action `REVEAL_CONTATO_CONTRATACAO`, entity `consorcio_contratacoes`, entity_id, user_id) com await antes de devolver o dado completo; se o log falhar, devolve 500 e o dado não sai. O master Enterprise que vê pedido de outro usuário da equipe não vê contato nem o ícone (a rota de revelação devolve 403).
- Quiz (modal, Esc fecha, Voltar/Continuar, botão travado até o passo estar válido):
  1. Segmento: Imóvel, Veículo leve, Veículo pesado, Moto, Serviços.
  2. Valor da carta (até R$ 10.000.000,00) e parcela que cabe no mês (não pode passar do valor da carta): máscara R$ 0,00 com valor por extenso abaixo; mensagem no campo quando passar do teto; estimativa de parcela = carta × (1 + 17,5% + 2%) / prazo, com o texto "É uma referência: a parcela real vem da administradora."
  3. Prazo (atalhos por segmento, rotulados "Prazos comuns", sem afirmar que é dado oficial) e lance (Sim/Não; se Sim, valor com máscara R$ e extenso, maior que zero e menor que a carta).
  4. Quando quer usar: O quanto antes / Em até 12 meses / Sem pressa, quer investir.
  5. Cliente: nome (mín. 3 letras), WhatsApp com DDI (+55 padrão, `PhoneIntlInput`), e-mail opcional, caixa obrigatória de autorização de contato, e resumo do pedido com carta, parcela e lance em R$ e por extenso (gerado do mesmo valor numérico). Enviar mostra "Pedido enviado: CS-…" e volta para a lista.
- Painel "Mercado agora" ao lado do quiz: Selic meta, IPCA 12 meses, INCC 12 meses (Banco Central, ao vivo, com mês de referência); taxa de administração média ≈ 17,5% e variação de vendas do segmento escolhido em 2026 (ABAC, fixo no código; fonte e período de referência escritos ao lado do número, ex. "ABAC, cotas vendidas jan–set/2026"). Se o Banco Central falhar, o painel mostra só a ABAC com "Indicadores do Banco Central indisponíveis agora."
- Marca Enterprise: para login ENTERPRISE (master ou usuário), o modal mostra logo e nome da marca no topo, o texto de sucesso diz "A {marca} já recebeu seu pedido…" e a autorização diz "O cliente autorizou a {marca} a entrar em contato com ele sobre consórcio." Sem marca cadastrada, usa `nomeDaMarca` (nome do master). Para os demais, "V3 Partners".
- Estado vazio: "Nenhum pedido de cota nova ainda. Use Contratar cota nova para enviar o primeiro." Carregando: spinner. Erro: "Não foi possível carregar os pedidos agora."
- Status (só equipe interna muda, num seletor no card): Nova, Em cotação, Proposta enviada, Contratada, Não seguiu. Nenhum é final: a equipe pode voltar qualquer status (corrige clique errado), por isso não há confirmação. Quem enviou recebe aviso no sino quando o status muda.
- Nota do porquê (tooltip) na autorização: "Precisamos da autorização para cotar e falar com o cliente."

## DEPENDENCIES
- Deve existir antes: `notifications`, `profiles.enterprise_id/white_label_*`, `issueV3Code`, `indicadoresMercado`, `EMAIL_FROM` e `RESEND_API_KEY` em produção (confirmados no #442).
- Migrations pendentes: esta (`20261127a`), com segundo go antes de aplicar em produção. O código trata a tabela ausente: GET devolve lista vazia com aviso no log e POST devolve 503 "Contratação indisponível no momento.", para o deploy poder sair antes da migration sem quebrar a tela.

## RISKS
- Breaking changes: nenhuma rota existente muda de contrato; só a página de Projetos ganha botão e seção.
- LGPD e compliance: grava nome, WhatsApp (E.164) e e-mail de um terceiro (o cliente) digitados pelo partner. Minimização: sem CPF/CNPJ, sem data de nascimento, sem renda. Autorização de contato obrigatória, gravada com data/hora e o texto exato exibido (`consentimento_em`, `consentimento_texto`). WhatsApp e e-mail do cliente não vão no e-mail aos sócios nem no texto do sino. O master Enterprise vê os pedidos da equipe sem WhatsApp e e-mail do cliente (só quem enviou e a equipe interna veem o contato, mascarado, com revelação registrada). A estimativa de parcela é rotulada como referência, não proposta. [VALIDAR COM ROBSON]: (a) texto da autorização com a marca do Enterprise quando quem cota e liga é a V3; (b) se a estimativa de parcela pela média de mercado pode aparecer para o partner; (c) prazo de guarda e descarte de nome, WhatsApp e e-mail do cliente em pedidos "Não seguiu", e se há anonimização depois (até a resposta, nada é apagado automaticamente); (d) se o nome do cliente pode ir no e-mail aos sócios e ser visto pelo master Enterprise da equipe.
- Segurança de acesso ao banco: tabela nova com RLS ligada e nenhuma policy; `revoke all` de `anon` e `authenticated`. Só a service role (rotas do servidor) lê e grava. Sem view, sem função, sem SECURITY DEFINER.
- EXCEÇÃO DECLARADA (item 6.5 do QA, mesmo padrão do #442): o recorte por papel (interno vê tudo; partner vê os seus; master vê os da equipe sem contato; contato só para quem enviou e interno) é decidido na rota com service role, não por policy. Mitigação: tabela fechada a todo cliente do banco; filtro na query por `idsDaEquipe` e de novo por linha (`podeVerContratacao`, com log só de ids); recorte de campos por papel em lista fechada com teste de paridade; contato só via rota de revelação com log. Precisa de aceite explícito do João ou do Hamilton no REGISTRO DE LIBERAÇÃO.
- Performance: GET com limite de 300 + todas as NOVA/EM_COTACAO; índices em `created_by` e `status`. Mercado com cache de 30 min já existente.
- Outro: e-mails fixos no código (Robson e Hamilton), como `lib/socios-notify.ts`; trocar exige deploy. Dados da ABAC envelhecem: ficam num objeto com `fonte` e `referencia` para atualizar.

## APPROACH
- Abordagem escolhida e por quê: tabela própria só com service role e recorte por papel numa lib pura testada, igual ao #442 (ofertas), que já passou pelo QA. Mercado reaproveita `indicadoresMercado()` da aba Mercado, sem nova integração.
- Alternativa descartada e por quê: gravar como `consorcio_projetos` com status especial (mistura pedido de cotação com projeto em andamento, exigiria CPF/administradora obrigatórios e a policy atual dá leitura a todo autenticado); usar `consorcio_leads` (não existe em produção); buscar dados da ABAC ao vivo (sem API pública estável, só PDF/blog).

## DESENHO TÉCNICO
Migration `20261127a_consorcio_contratacoes.sql`:
```sql
create table if not exists public.consorcio_contratacoes (
  id                     uuid primary key default gen_random_uuid(),
  code                   text unique,
  segmento               text not null check (segmento in ('IMOVEL','VEICULO','PESADO','MOTO','SERVICO')),
  valor_credito          numeric(14,2) not null check (valor_credito > 0 and valor_credito <= 10000000),
  parcela_maxima         numeric(14,2) not null check (parcela_maxima > 0),
  prazo_meses            integer not null check (prazo_meses between 6 and 240),
  tem_lance              boolean not null default false,
  lance_valor            numeric(14,2),
  quando                 text not null check (quando in ('IMEDIATO','ATE_12_MESES','SEM_PRESSA')),
  cliente_nome           text not null,
  cliente_whatsapp       text not null,
  cliente_email          text,
  consentimento_em       timestamptz not null,
  consentimento_texto    text not null,
  status                 text not null default 'NOVA' check (status in ('NOVA','EM_COTACAO','PROPOSTA_ENVIADA','CONTRATADA','NAO_SEGUIU')),
  status_atualizado_em   timestamptz,
  status_atualizado_por  uuid references public.profiles(id),
  created_by             uuid not null references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  constraint consorcio_contratacoes_parcela_ck check (parcela_maxima <= valor_credito),
  constraint consorcio_contratacoes_lance_ck check (
    (tem_lance and lance_valor is not null and lance_valor > 0 and lance_valor < valor_credito)
    or (not tem_lance and lance_valor is null)
  )
);
create index if not exists consorcio_contratacoes_created_by_idx on public.consorcio_contratacoes (created_by);
create index if not exists consorcio_contratacoes_status_idx on public.consorcio_contratacoes (status, created_at desc);
alter table public.consorcio_contratacoes enable row level security;
revoke all on public.consorcio_contratacoes from anon, authenticated;
comment on table public.consorcio_contratacoes is 'Pedidos de cota nova de consórcio (BRIEF 2026-11-27). Só service role; acesso por papel nas rotas.';
```
Reversão (`.rollback.sql.txt`): conferir `select count(*)` e exportar as linhas antes; `drop table if exists public.consorcio_contratacoes;`. As notificações já criadas ficam (texto sem dado de contato).

Rota `/api/consorcio/contratacoes`:
- GET: 401 sem login. `interno` = ADMIN/GESTAO/MESA_OPERACIONAL vê todos; os demais, `created_by in idsDaEquipe`. O GET nunca devolve WhatsApp nem e-mail completos: devolve só a versão mascarada e `pode_revelar` (true para interno e para quem enviou). Busca todas as NOVA e EM_COTACAO + as 300 mais recentes (created_at desc) das demais; depois `ordenarContratacoes`. Devolve `{ contratacoes, interno, marca, mercado }` (marca = `contextoEnterprise(...).marca` com fallback `nomeDaMarca`; mercado = BCB + ABAC). Excluídos (`deleted_at`) não saem.
- POST `/api/consorcio/contratacoes/[id]/contato`: 401 sem login; pedido inexistente ou com `deleted_at` preenchido = 404, sem gravar log e sem dado; 403 se não for interno nem quem enviou; grava `audit_logs` (action, entity, entity_id, user_id, user_name, ip_address) com await e confere o `error` devolvido, como em `app/api/admin/cadastros/documento/route.ts`; com erro, 500 sem o dado; senão devolve `{ whatsapp, email }`. Casos 404, 403 e falha do log no teste (lógica de decisão na lib pura).
- POST: zod (`lib/consorcio/contratacoes.ts`) com os mesmos limites do banco (carta > 0 e <= 10.000.000; parcela > 0 e <= carta; prazo 6 a 240; lance coerente com tem_lance), e-mail validado se vier, `consentimento: true` obrigatório. WhatsApp: `normalizePhone(x)` precisa dar `ok && !empty` (vazio ou inválido = 400 com `PHONE_ERROR_MSG`); grava `e164` (ex. +5521989937178); exibição por `formatPhoneIntl` (mascarada, ver UX). Texto da autorização montado no servidor com a marca do usuário. Cota de criação (`reservarVagaOuNegar`); se a emissão do código ou o insert falhar, chama `vaga.devolver()`. Código `CS`, insert. Avisos depois do insert, cada um em try/catch (falha de aviso não desfaz o pedido): sino para ADMIN e GESTAO ativos; sino para o master se o usuário tem `enterprise_id` e o master está ativo; e-mail para os dois endereços fixos com segmento, carta, parcela, prazo, lance, quando, nome do cliente, origem (`origemDaOferta` já existente: Equipe V3 / nome do Enterprise / Rede V3) e quem enviou, botão "Ver em Projetos" (`/consorcio/projetos#cotas-novas`). Textos com `escapeHtml` e sem travessão.
- PATCH: só interno, `{ id, status }`, grava `status_atualizado_em/por` e `updated_at`, sino para quem enviou.

## PLANO DE TESTE
- Unitário (`node:test`): matriz de acesso (interno, partner avulso, usuário Enterprise, master, outro master, sem created_by); permissão de revelar contato (interno e quem enviou sim; master de outro usuário não); recorte de campos por papel com teste de paridade (contato completo nunca sai na lista); máscara de WhatsApp e e-mail; validação (carta 0, carta acima de 10 milhões, parcela maior que a carta, prazo fora, lance com tem_lance false, lance igual à carta, tem_lance sem valor, WhatsApp vazio, WhatsApp inválido, sem autorização); WhatsApp gravado em E.164; estimativa de parcela; texto da autorização com e sem marca; rótulos e ordem de status (`ordenarContratacoes`).
- Prova de acesso no banco ANTES de aplicar em produção (transação desfeita, via SQL da service role no Supabase): `begin;` + a migration; `set local role anon; select * from consorcio_contratacoes;` (espera permission denied); `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<id do usuário de teste>","role":"authenticated"}', true);` repetindo select, insert, update e delete (permission denied em todos); `select has_table_privilege('anon','public.consorcio_contratacoes','select,insert,update,delete'), has_table_privilege('authenticated', ...)` = false, false; `rollback;`. Depois de aplicar: as 3 consultas de verificação da seção 6 (políticas abertas, views sem security_invoker, tabelas legíveis por anon) e registro de que a tabela nova não aparece em nenhuma.
- Produção: depois do deploy e da migration, curl sem sessão = 307/401. Teste logado do Hamilton com o usuário de teste do AGS Teste (master temporário): enviar 1 pedido marcado "TESTE", ver marca AGS no quiz, conferir sino (ADMIN/GESTÃO e master), e-mail chegando nos dois endereços, e depois apagar o pedido de teste (soft delete por SQL com registro).
- Não testável sem login: o visual do modal logado (fica com o Hamilton).

## ESTIMATE
M. Cerca de 3 a 4 horas. Confiança média-alta (padrão igual ao #442).

## PARECER DE COMPLIANCE
Pendente. [VALIDAR COM ROBSON] nos itens (a), (b), (c) e (d) de LGPD acima. Sem resposta, só segue com "go mesmo assim" do João ou do Hamilton aceitando a pendência. Precedente: o cadastro de projetos e propostas já grava dados de clientes digitados por partners, e o #442 recebeu "go mesmo assim" com pendência do Robson.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (7 falhas: 1.1 teto e coerência de valores; 1.4 formato e vazio do WhatsApp; 3.1/3.2 contato sem regra de exibição; 4.1 ordenação; 6.5 recorte só na rota sem exceção declarada; 6.8 prova de acesso no banco; compliance pendente). Corrigidas no texto nesta revisão: 1.1, 1.4, 3.1/3.2 (opção a: mascarado + revelação com log), 4.1, 6.8; 6.5 declarada como exceção (precisa de aceite); compliance com 4 perguntas ao Robson. Sugestões adotadas: updated_at no PATCH, devolver() da cota, status reversível sem confirmação, linha "Pedido de cota CS-…", extenso no resumo, período da ABAC visível.

Rodada 2 de 6: BLOQUEADO (3 falhas). Corrigida no texto: 3.2 (frase do GET de volta ao GET; rota de contato com 404 para pedido inexistente ou excluído, sem log e sem dado, e checagem do `error` do insert). Sugestões adotadas: user_name e ip_address no log; set_config na prova de acesso. Restam só as que dependem de decisão humana:
- 6.5: recorte por papel decidido na rota (exceção declarada em RISKS), precisa de aceite do João ou do Hamilton.
- Compliance: [VALIDAR COM ROBSON] (a) marca na autorização, (b) estimativa de parcela, (c) guarda e descarte, (d) nome do cliente no e-mail e para o master. Precisa da resposta do Robson ou de "go mesmo assim".
Todo o resto PASSOU (1.1, 1.4, 1.5, 3.1, 3.2, 3.3, 4.1, 5.1, 6.1, 6.2, 6.6, 6.8).

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 2), só por itens que dependem de decisão humana (6.5 e compliance).
- Override ("go mesmo assim"): sim. Falhas aceitas: (1) 6.5, recorte por papel decidido na rota com service role, tabela fechada a anon e authenticated; (2) compliance [VALIDAR COM ROBSON] itens (a) a (d), pendentes.
- Go dado por: Hamilton, em 2026-11-27 (registrado pelo hook em `.claude/brief-release/go-log.jsonl`): "go mesmo assim para o BRIEF da contratação de cota nova em Projetos, aceitando o filtro de acesso na rota e a pendência do Robson".
- Dados da ABAC conferidos na fonte em 27/11/2026: imóveis +37,1%, veículos leves +6,9%, motos +7,3%, pesados -9,2% e serviços +8,5% (jan–set/2026); taxa média próxima a 17,5% (matéria de mar/2026). A prévia mostrava pesados -7,2% (jan–jul); corrigido para o acumulado jan–set.
- Migration aplicada em produção: não (aguarda o segundo go, depois da prova de acesso em transação desfeita).
