# BRIEF: Enterprise sem o vídeo de boas-vindas da V3

> Data: 2026-11-24 | Autor: Claude (pedido do Hamilton) | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-24_enterprise-sem-video-boas-vindas-v3.md` e commitar junto com o código.

## SCOPE
Pedido do Hamilton em 24/11/2026: "quero que tire o video de boas vindas da AGS". O modal "vídeo do fundador" (`FounderVideoModal`) abre no Dashboard no primeiro acesso de qualquer usuário. Ele mostra o vídeo dos sócios da V3 e as frases "Até 60% de comissão", "20+ linhas de crédito" e "Suporte dedicado". Isso fere o white label e mostra condições da rede V3 que não valem para a equipe do Enterprise.

O modal deixa de aparecer para **todo** usuário de Enterprise: o master e a equipe têm o mesmo papel ENTERPRISE (o master com `enterprise_id` nulo, a equipe com `enterprise_id` = master; ver PR #424). A regra vale para a AGS e para qualquer Enterprise que for cadastrado depois. Nada muda para os demais papéis.

## IMPACT
- Arquivos afetados:
  - `app/(platform)/dashboard/page.tsx`: a página passa a prop nova `esconderVideoV3 = ehEnterprise(role)` ao `DashboardClient`. O helper `ehEnterprise` já existe em `lib/enterprise-bloqueio.ts` e é usado no menu enxuto (PR #424). O select do perfil não muda.
  - `components/dashboard/dashboard-client.tsx`: a prop opcional `esconderVideoV3` (padrão `false`) faz o componente deixar de renderizar `<FounderVideoModal>` quando é `true`.
- Tabelas afetadas: nenhuma. O papel já é lido hoje pela página.
- Rotas afetadas: `/dashboard` (renderização).
- APIs e integrações afetadas: nenhuma. A rota `/api/settings/platform`, que fornece a URL do vídeo, continua igual para os outros usuários.

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: em `/dashboard`, no primeiro acesso, o modal escuro com o vídeo e a faixa dourada deixa de abrir para usuários de Enterprise. O Dashboard aparece direto.
- Estado vazio: não se aplica, porque só sai um modal.
- Sem UI? Há UI: a ausência do modal.
- Nota do porquê (tooltip): não se aplica, porque não há campo, consulta nem aceite novo.

## DEPENDENCIES
- Deve existir antes: o modelo Enterprise (`role ENTERPRISE` e `profiles.enterprise_id`), que já está em produção.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: a prop é opcional e o padrão é `false`. Os outros papéis mantêm o comportamento atual. Também é preciso conferir o modo de desenvolvimento do Dashboard, que renderiza `DashboardClient` sem perfil real. Ele não recebe a prop e fica como está.
- LGPD e compliance: nenhum dado pessoal novo é lido nem exibido. Só o papel do próprio usuário, que a página já lê, vira um booleano no servidor.
- Segurança de acesso ao banco (anon, RLS, views, funções): sem DDL e sem consulta nova. Se o papel não puder ser lido, ele cai no padrão `PARTNER` que a página já usa, e o modal continua aparecendo. A falha é visível e não expõe nada.
- Performance: nenhuma consulta nova.
- Outro: quem já viu o vídeo tem `founder-video-seen` no navegador, o que não muda nada. Quem é Enterprise e ainda não viu não verá mais.

## APPROACH
- Abordagem escolhida: decidir no servidor com o helper `ehEnterprise(role)` de `lib/enterprise-bloqueio.ts` e passar um booleano para o componente cliente. É a mesma regra do menu enxuto (PR #424), cobre master e equipe e não depende de nome de cliente.
- Alternativa descartada: buscar o contexto no próprio modal com uma chamada `fetch` nova. Ela foi descartada porque o modal piscaria antes da resposta chegar e porque criaria uma rota a mais. Também foi descartada a troca do vídeo por um vídeo da AGS: ninguém pediu e ainda não existe esse vídeo.

## DESENHO TÉCNICO
Sem migration.
```ts
// page.tsx
import { ehEnterprise } from "@/lib/enterprise-bloqueio";
<DashboardClient ... esconderVideoV3={ehEnterprise(role)} />

// dashboard-client.tsx
esconderVideoV3?: boolean   // padrão false
{!esconderVideoV3 && <FounderVideoModal partnerName={userName} />}
```
Reversão: reverter o PR.

## PLANO DE TESTE
- Lint e typecheck dos dois arquivos.
- Em produção, depois do deploy:
  - o usuário teste da AGS (v3partnersbrasil@gmail.com), em aba anônima e sem `founder-video-seen`, não vê o modal;
  - uma conta de partner fora de Enterprise, em aba anônima, continua vendo o modal.
- Master Enterprise: testar em modo ADMIN não serve (o ADMIN não é Enterprise). Fica provado pela mesma regra `ehEnterprise(role)`, que é o papel do master e da equipe; se o Hamilton tiver acesso à conta do Marciano, conferir em aba anônima.

## ESTIMATE
S. Cerca de 15 minutos. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal: a mudança só esconde um vídeo institucional e não lê nem expõe dado de pessoa.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6, 24/11/2026. VEREDITO: LIBERADO PARA "GO". Zero bloqueantes.
Sugestões aplicadas nesta versão: (1) premissa corrigida, master e equipe têm o mesmo papel ENTERPRISE; (2) reaproveita o helper `ehEnterprise` de `lib/enterprise-bloqueio.ts`, com a prop chamada `esconderVideoV3` para não sombrear a função; (3) plano de teste do master detalhado.
Registrado fora do escopo: o modal ainda tem texto sem acento ("Ate 60% de comissao", "Comecar agora") para quem continua vendo; ajuste de copy num PR futuro.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 1)
- Override: não
- Go dado por: pendente
- Migration aplicada em produção: não se aplica
