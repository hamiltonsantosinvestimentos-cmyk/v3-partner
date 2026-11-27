# BRIEF: Kanban com modal e comentários em Consórcio › Projetos (cotas novas e cotas contempladas)

> Data: 2026-11-27 | Autor: Claude (pedido do Hamilton) | Status: GO DADO (go mesmo assim)
> Pedido: "MONTAR UM KANBAN NA ABA CONSORCIO/PROJETOS PARA MELHOR ACOMPANHAMENTO, PODENDO ABRIR NA ADMIN E GESTAO DA V3 E COMENTANDO E TAL COM MODAL DO PROJETO, TANTO NA COTAS CONTEMPLADAS QUANTO TAMBEM NA CONTRATAÇÃO COTA NOVA".
> Decisões do Hamilton (27/11/2026, AskUserQuestion): "V3 comenta, partner vê (Recomendado)" e "Etapas de acompanhamento (Recomendado)".

## SCOPE
Em Consórcio › Projetos, as seções "Contratação de cotas novas" (#443) e "Ofertas de cota contemplada" (#442) passam a ter visão Kanban (com alternância Kanban/Lista). ADMIN e GESTÃO arrastam os cards entre colunas e abrem um modal do item com detalhes, histórico de etapas e comentários. A V3 escolhe se cada comentário é visível ao partner ou nota interna. Quem enviou (e o master Enterprise da equipe) vê o Kanban sem arrastar, abre o modal, lê os comentários visíveis e responde. Ofertas ganham etapas próprias de acompanhamento; aceitar a oferta continua só na carta.

## IMPACT
- Arquivos afetados:
  - `supabase/migrations/20261127b_consorcio_kanban_comentarios.sql` (novo), `.rollback.sql.txt` (novo) e `_prova_acesso.sql.txt` (novo)
  - `lib/consorcio/kanban.ts` (novo, regras puras: colunas, quem move, quem comenta, visibilidade de comentário, validação, evento de mudança)
  - `lib/consorcio/ofertas-acompanhamento.ts` (inclui `etapa` na lista fechada dos dois papéis)
  - `lib/consorcio/contratacoes.ts` (só reexporta a regra de quem move; nenhum campo novo)
  - `app/api/consorcio/comentarios/route.ts` (novo: GET e POST de comentários de um item)
  - `app/api/consorcio/ofertas/[id]/etapa/route.ts` (novo: PATCH da etapa da oferta)
  - `app/api/consorcio/ofertas/acompanhamento/route.ts` (seleciona e devolve `etapa`)
  - `app/api/consorcio/contratacoes/route.ts` (PATCH passa a ser só ADMIN/GESTAO e grava o evento no histórico)
  - `components/consorcio/kanban-consorcio.tsx` (novo: quadro, cards, modal com comentários)
  - `components/consorcio/contratar-cota.tsx` (seção usa o quadro; alternância Kanban/Lista)
  - `app/(platform)/consorcio/projetos/page.tsx` (seção de ofertas usa o quadro)
  - `tests/unit/kanban-consorcio.test.ts` (novo)
- Tabelas afetadas: `consorcio_comentarios` (nova); `consorcio_ofertas` (3 colunas novas nullable com default: `etapa`, `etapa_atualizada_em`, `etapa_atualizada_por`). Escrita em `notifications`.
- Rotas afetadas: as listadas acima; tela `/consorcio/projetos`.
- APIs e integrações: nenhuma externa nova.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: Consórcio › Projetos. Em cada uma das duas seções, um seletor "Kanban | Lista" no cabeçalho (Kanban é o padrão; a escolha fica lembrada no navegador). O Kanban tem uma coluna por etapa, com contador no topo; rolagem horizontal dentro da seção no celular (a página não rola para o lado).
- Colunas:
  - Contratação de cota nova (já existem): Nova, Em cotação, Proposta enviada, Contratada, Não seguiu.
  - Ofertas de cota contemplada (novas, só acompanhamento): Nova, Em contato, Negociando, Documentação, Concluída, Perdida. O status da oferta (Em análise, Aceita, Recusada, Cancelada) continua como selo no card; "Aceitar" segue só em Cartas Contempladas.
- Card: a tarja dourada de cada tipo, código, cliente/interessado, valor em R$ com máscara BRL (ex. R$ 1.000.000,00, como nas listas atuais), quem enviou, data dd/mm/aaaa (São Paulo), contador de comentários. Ofertas: se o status e a etapa divergem (ex. oferta "Aceita" em "Perdida", "Cancelada" fora de Concluída/Perdida), o card mostra o aviso "Status da oferta: Aceita" em destaque.
- Ordem dos cards dentro de cada coluna (os dois quadros): created_at desc (mais recente em cima), desempate por código. Função pura `ordenarCardsDaColuna` em `lib/consorcio/kanban.ts`, com teste.
- Arrastar: só ADMIN e GESTÃO. Os demais veem o card sem alça de arrasto. No celular e no teclado, a mudança de etapa é pelo seletor "Etapa" dentro do modal (arrasto não é o único caminho). Nenhuma etapa é final: dá para voltar (corrige clique errado), sem confirmação.
- Modal do item (abre no clique do card, Esc fecha): detalhes do item com os mesmos campos e máscaras de hoje para cada papel (contato do cliente da cota nova continua mascarado com o ícone de olho e log; documento do interessado da oferta mascarado para o partner, sem documento para a V3, como no #442); seletor de etapa (só ADMIN/GESTÃO); um fio único em ordem cronológica (mais antigo em cima) com comentários e eventos de etapa juntos: o evento aparece em estilo discreto, uma linha só ("Etapa: Nova → Em cotação, por Fulano, 27/11/2026 15:40"); o comentário mostra autor, data e hora (dd/mm/aaaa hh:mm, São Paulo) e o selo "Nota interna" quando não é visível ao partner.
- Comentar: caixa de texto (até 2.000 caracteres, contador) com o aviso fixo abaixo "Não escreva CPF, telefone, e-mail ou renda do cliente no comentário." Para ADMIN/GESTÃO, a caixa "Visível para o partner" vem marcada e o botão diz "Comentar para o partner", com o selo "O partner verá este comentário" acima do botão; desmarcada, o botão vira "Salvar nota interna" e o selo some. Para quem enviou e para o master, todo comentário é visível à V3 e ao partner e o botão diz "Comentar". Tooltip na caixa: "Desmarque para deixar a nota só para a equipe V3." Limite de 30 comentários por minuto por usuário, contado no banco antes do insert (linhas de `consorcio_comentarios` do autor com created_at no último minuto, índice `(autor_id, created_at)`; memória da função não vale entre instâncias) (429 "Muitos comentários seguidos. Espere um pouco.").
- Avisos no sino: comentário visível da V3 avisa quem enviou o item (e o master, se o item é de usuário da equipe); resposta do partner avisa ADMIN e GESTÃO ativos; mudança de etapa da oferta avisa quem ofertou (a da cota nova já avisa, #443). Nota interna não avisa ninguém fora da V3.
- Estado vazio: coluna vazia mostra "Nada aqui"; quadro sem itens mostra o mesmo texto de hoje da seção. Modal sem comentários: "Nenhum comentário ainda."
- Erro: "Não foi possível carregar os comentários agora." / "Não foi possível mover agora. Tente de novo." (o card volta para a coluna anterior e o texto do erro fica numa faixa logo acima do quadro até o próximo movimento, não só em aviso passageiro).

## DEPENDENCIES
- Deve existir antes: #442 e #443 no ar (estão), `consorcio_contratacoes` aplicada (está).
- Migrations pendentes: esta (`20261127b`), com prova de acesso em transação desfeita e segundo go antes de aplicar. Sem ela, o Kanban da cota nova funciona (usa `status`), o das ofertas mostra todas em "Nova" sem arrastar, e os comentários mostram "Comentários indisponíveis no momento." (rota trata tabela/coluna ausente).

## RISKS
- Breaking changes: o PATCH de status da cota nova deixa de aceitar MESA_OPERACIONAL (passa a ser só ADMIN e GESTÃO, como pedido). Mesa Operacional continua vendo tudo. Colunas novas em `consorcio_ofertas` são nullable com default, sem mudar as existentes; a lista de ofertas ganha só o campo `etapa`.
- LGPD e compliance: comentário é texto livre e pode conter dado pessoal do cliente. Mitigação: comentários ficam numa tabela só de service role; partner vê só os visíveis dos itens que já pode ver; nota interna nunca sai para partner (filtro no servidor, testado); comentário não vai por e-mail (só aviso no sino com o código do item, sem o texto). Texto escapado na exibição (React) e limitado a 2.000 caracteres. Sem edição nem exclusão pela tela (registro fica). [VALIDAR COM ROBSON]: (a) se comentário com dado do cliente pode ser visto pelo master Enterprise da equipe; (b) prazo de guarda dos comentários junto com o item; (c) como atender pedido de exclusão ou correção (LGPD art. 18) de comentário com dado pessoal, já que não há edição nem exclusão pela tela (proposta até a resposta: procedimento por SQL com registro em audit_logs, feito pela V3 a pedido); (d) se a V3 pode escrever dado pessoal do cliente em texto livre visível ao partner e ao master (a tela já avisa para não escrever documento, telefone, e-mail ou renda).
- Segurança de acesso ao banco: `consorcio_comentarios` com RLS ligada, nenhuma policy, `revoke all` de anon e authenticated (só service role), como `consorcio_contratacoes`.
- `consorcio_ofertas` (achado do QA, rodada 1): a policy atual "admin pode atualizar ofertas" (20260810d, linhas 122 a 127) libera UPDATE de qualquer coluna para ADMIN, GESTAO e MESA_OPERACIONAL pela REST, o que deixaria gravar `etapa` fora da rota (sem evento, sem aviso, autor forjável). Saída adotada (a): a migration faz `drop policy if exists "admin pode atualizar ofertas" on public.consorcio_ofertas;`. Verificado por grep em app/, lib/ e components/ em 27/11/2026: nenhum código grava em consorcio_ofertas pela sessão do usuário; o POST de oferta e o aceite (`app/api/consorcio/ofertas/[id]/aceitar/route.ts`) usam service role. Com isso, nenhum UPDATE de consorcio_ofertas passa por RLS para authenticated. O rollback recria a policy com a definição exata de 20260810d. EXCEÇÃO DECLARADA (item 6.5, mesmo padrão de #442 e #443): o recorte por papel (quem vê o item, quem vê nota interna, quem move, quem comenta) é decidido nas rotas com service role, aplicado na query e de novo por linha, com teste de matriz. Fica amarrada ao BRIEF de RLS por dono de consorcio_ofertas prometido para 05/12/2026 (#442): estas rotas entram na mesma pendência. Precisa de aceite do João ou do Hamilton.
- Performance: comentários carregam só ao abrir o modal (1 item, limite 500). O quadro reaproveita as listas que já carregam (sem consulta nova); contador de comentários vem numa consulta agregada por ids visíveis.
- Outro: arrasto simultâneo de duas pessoas: vale o último; o histórico registra os dois.

## APPROACH
- Abordagem escolhida e por quê: uma tabela de comentários genérica por item (`alvo_tipo` + `alvo_id`) para os dois tipos, com eventos de etapa gravados no mesmo fio (histórico e conversa juntos, como pedido no "acompanhamento"). Quadro com arrasto HTML5 nativo, como os Kanbans de CRM e Prospecção do repo, sem biblioteca nova.
- Alternativa descartada e por quê: mudar o status real da oferta pelo arrasto (o Hamilton escolheu etapas, porque aceitar cancela as outras ofertas da carta); duas tabelas de comentários (duplica regra e teste); comentários em `notifications` (não tem dono do item nem visibilidade).

## DESENHO TÉCNICO
Migration `20261127b_consorcio_kanban_comentarios.sql`:
```sql
alter table public.consorcio_ofertas
  add column if not exists etapa text default 'NOVA',
  add column if not exists etapa_atualizada_em timestamptz,
  add column if not exists etapa_atualizada_por uuid references public.profiles(id);
do $$ begin
  alter table public.consorcio_ofertas add constraint consorcio_ofertas_etapa_ck
    check (etapa is null or etapa in ('NOVA','EM_CONTATO','NEGOCIANDO','DOCUMENTACAO','CONCLUIDA','PERDIDA'));
exception when duplicate_object then null; end $$;
-- Achado do QA (rodada 1): UPDATE direto pela REST deixa de existir; toda gravação passa pelas rotas (service role).
drop policy if exists "admin pode atualizar ofertas" on public.consorcio_ofertas;

create table if not exists public.consorcio_comentarios (
  id               uuid primary key default gen_random_uuid(),
  alvo_tipo        text not null check (alvo_tipo in ('CONTRATACAO','OFERTA')),
  alvo_id          uuid not null,
  autor_id         uuid not null references public.profiles(id),
  texto            text not null check (char_length(texto) between 1 and 2000),
  visivel_partner  boolean not null default true,
  evento           boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists consorcio_comentarios_alvo_idx on public.consorcio_comentarios (alvo_tipo, alvo_id, created_at);
create index if not exists consorcio_comentarios_autor_idx on public.consorcio_comentarios (autor_id, created_at desc);
alter table public.consorcio_comentarios enable row level security;
revoke all on public.consorcio_comentarios from anon, authenticated;
comment on table public.consorcio_comentarios is 'Comentários e histórico dos itens do Kanban de Consórcio › Projetos (BRIEF 2026-11-27). Só service role.';
```
Reversão (`.rollback.sql.txt`): recriar a policy exatamente como em 20260810d (`create policy "admin pode atualizar ofertas" on public.consorcio_ofertas for update using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['ADMIN','GESTAO','MESA_OPERACIONAL']::user_role[])));`); exportar `consorcio_comentarios`; `drop table if exists public.consorcio_comentarios;` `alter table public.consorcio_ofertas drop constraint if exists consorcio_ofertas_etapa_ck, drop column if exists etapa_atualizada_por, drop column if exists etapa_atualizada_em, drop column if exists etapa;` (código revertido antes).

Regras (lib pura `lib/consorcio/kanban.ts`):
- `etapa` nullable com default 'NOVA' (regra do CLAUDE.md: coluna nova em tabela existente é nullable); null é exibido como "Nova" e cai na coluna Nova (`etapaDaOferta`, com teste).
- `podeMover(papel)`: ADMIN ou GESTAO.
- `podeVerItem`: o mesmo de hoje (`podeVerContratacao` / `podeVerOferta`: interno vê tudo; demais, `created_by` em `idsDaEquipe`).
- `podeComentar(viewer, item)`: ADMIN/GESTAO sempre; quem enviou; o master da equipe de quem enviou. MESA_OPERACIONAL lê tudo (inclusive nota interna) e não comenta.
- `comentariosVisiveis(viewer, lista)`: interno vê todos; demais só `visivel_partner = true`.
- Comentário de não interno grava sempre `visivel_partner = true`; o campo enviado pelo cliente é ignorado.
- Evento de etapa: `evento = true`, texto montado no servidor ("Etapa: X → Y"), visível ao partner.

Rotas:
- `GET /api/consorcio/comentarios?tipo=CONTRATACAO|OFERTA&id=<uuid>`: 401 sem login; item inexistente ou excluído = 404; sem acesso ao item = 404 (não revela existência); devolve `{ comentarios: [{id, autor, texto, visivel_partner, evento, created_at}], pode_comentar, pode_nota_interna }`, filtrado por `comentariosVisiveis`, ordem created_at asc, limite 500. Nome do autor por `profiles.full_name` ("Usuário sem nome" se vazio).
- `POST /api/consorcio/comentarios`: `{tipo, id, texto, visivel_partner?}`; texto aparado, 1 a 2.000; 403 se não pode comentar; avisos no sino conforme a UX (só código do item e "novo comentário", sem o texto).
- `PATCH /api/consorcio/ofertas/[id]/etapa`: só ADMIN/GESTAO; etapa válida; grava `etapa`, `etapa_atualizada_em/por`; evento no fio; aviso a quem ofertou.
- `PATCH /api/consorcio/contratacoes`: igual ao #443, mas só ADMIN/GESTAO, e grava o evento no fio.
- Contador de comentários: GET de cada lista devolve `comentarios` (contagem visível ao viewer) por item.

## PLANO DE TESTE
- Unitário (`node:test`): `ordenarCardsDaColuna` (created_at desc, desempate por código); aviso de divergência status x etapa; limite de 30 comentários por minuto; matriz de quem move (ADMIN, GESTAO sim; MESA_OPERACIONAL, partner, master, Enterprise não); quem comenta (ADMIN, GESTAO, quem enviou, master da equipe sim; MESA_OPERACIONAL, colega, master de outra equipe, partner avulso não); visibilidade (nota interna nunca aparece para não interno; interno vê tudo); comentário de partner força visível; validação do texto (vazio, só espaços, 2.001 caracteres, 2.000 ok); etapas válidas e rótulos; texto do evento; paridade das listas com o campo `etapa`.
- Prova de acesso no banco ANTES de aplicar (transação desfeita, roteiro em `supabase/migrations/20261127b_consorcio_kanban_comentarios_prova_acesso.sql.txt`):
  - `begin;` + migration; `has_table_privilege` de anon e authenticated em `consorcio_comentarios` = false;
  - `set local role anon`: select e insert em `consorcio_comentarios` = 42501; select de `etapa` em `consorcio_ofertas` = 0 linhas ou 42501; `update consorcio_ofertas set etapa='PERDIDA'` = 0 linhas ou 42501;
  - `set local role authenticated` com claims de um partner comum: select/insert em `consorcio_comentarios` = 42501; select de `etapa` = 0 linhas; update de `etapa` = 0 linhas;
  - `set local role authenticated` com claims de um MESA_OPERACIONAL (e de um ADMIN): `update consorcio_ofertas set etapa='PERDIDA'` = 0 linhas (sem policy de UPDATE);
  - `rollback;`.
  Depois de aplicar: 0 policies e 0 grants em `consorcio_comentarios`, RLS ligada; `pg_policies` de `consorcio_ofertas` colado no BRIEF mostrando que não há mais policy de UPDATE; as 3 consultas da seção 6 (políticas abertas, views sem security_invoker, tabelas legíveis por anon).
- Produção: com o usuário de teste do AGS Teste, abrir o pedido de teste V3-CS-2026-11-0002 no modal, a V3 comenta (visível e nota interna), o partner vê só o visível e responde; arrastar como ADMIN. Ofertas: 0 em produção hoje, o quadro fica vazio.

## ESTIMATE
L. Cerca de 5 a 6 horas. Confiança média.

## PARECER DE COMPLIANCE
Pendente. [VALIDAR COM ROBSON] itens (a), (b), (c) e (d) de LGPD acima. Precedente: #442 e #443 seguiram com "go mesmo assim" e pendência do Robson.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (5 falhas). Corrigidas no texto: 4.1 (ordem dentro da coluna), 6.5 técnica (drop da policy de UPDATE de consorcio_ofertas, com rollback exato), 6.8 (prova cobre consorcio_ofertas, MESA_OPERACIONAL e ADMIN). Exceção 6.5 amarrada à RLS por dono de 05/12; compliance com perguntas (c) e (d). Sugestões adotadas: botão muda de rótulo e selo de pré-visualização, fio único, formato do card, aviso de divergência status x etapa, etapa not null, limite de 30 comentários/minuto, erro de arrasto fixo acima do quadro. Não adotada: exclusão lógica de comentário (depende da resposta (c) do Robson).

Rodada 2 de 6: BLOQUEADO (2 falhas, as duas só de aceite humano: exceção 6.5 e Robson (a) a (d)). Nenhuma falha técnica. Ajustes de texto feitos: parecer cita (a) a (d); `etapa` volta a nullable com default 'NOVA' e null exibido como Nova (IMPACT, RISKS e migration alinhados); limite de comentários contado no banco com índice (autor_id, created_at).

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 2), só por itens de aceite humano (exceção 6.5 e Robson (a) a (d)); nenhuma falha técnica na rodada 2.
- Override ("go mesmo assim"): sim. Falhas aceitas: (1) recorte por papel decidido nas rotas com service role, até a RLS por dono de 05/12/2026; (2) pendências (a) a (d) do Robson.
- Go dado por: Hamilton, em 2026-11-27 (hook, go-log.jsonl): "go mesmo assim para o BRIEF do Kanban de Consórcio Projetos, aceitando o filtro de acesso nas rotas até a RLS de 05/12 e as pendências (a) a (d) do Robson".
- Migration aplicada em produção: não (aguarda prova de acesso e segundo go).
