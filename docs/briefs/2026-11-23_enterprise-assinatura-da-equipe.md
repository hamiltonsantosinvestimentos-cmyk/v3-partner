# BRIEF: Minha Assinatura no Enterprise (master define a cobrança de cada usuário; usuário vê a dele)

> Data: 2026-11-23 | Autor: Claude (pedido do Hamilton) | Status: QA rodada 2 sem falha técnica; aguardando Robson ou "go mesmo assim"

## PEDIDO E DECISÕES DO HAMILTON (23/11/2026, no chat)
- "sobre a minha assinatura, o master do enterprise, deve definir os valores se cobra ou nao, e qual o valor. e deve aparecer para o usuario."
- Decisão 1: **o master cobra por fora**. A plataforma só registra e mostra; o master marca o pagamento quando recebe. Nenhum dinheiro passa pela V3.
- Decisão 2: **o master escolhe a periodicidade por usuário**: mensal, trimestral ou anual.
- Decisão 3: **o master também vê a assinatura dele com a V3** (plano Enterprise), como os partners, e, à parte, o quadro da cobrança da equipe.

## SITUAÇÃO HOJE (levantamento no código, 23/11)
- Menu (`components/layout/sidebar.tsx:176`) mostra "Minha Assinatura" para ENTERPRISE, mas `app/(platform)/minha-assinatura/page.tsx:19` só aceita `PARTNER, PARTNER_PRO, GOLD, DIAMANTE, PARTNER_HE`: master e equipe caem em `/unauthorized`.
- A página lê, no servidor com o cliente de serviço, o contrato (`partner_contracts` por `user_id`) e as comissões (`commissions.partner_id = user.id`) do próprio usuário. O client (`components/minha-assinatura/minha-assinatura-client.tsx`) chama `/api/partner/sdr/addon-status`, `/api/cora/subscription` (GET e POST), `/api/infinitepay/checkout`, `/api/assinatura/solicitar-renovacao` e `/api/assinatura/solicitar-upgrade`.
- Não existe hoje nenhum registro de cobrança do master para os usuários dele.

## SCOPE
1. **Registro da cobrança** no perfil do usuário da equipe: coluna nova `profiles.enterprise_assinatura jsonb` (nullable), só em usuários com `enterprise_id` preenchido, no formato:
   `{ "cobra": boolean, "valor": number (reais, arredondado a 2 casas no servidor, > 0 quando cobra), "periodicidade": "MENSAL" | "TRIMESTRAL" | "ANUAL", "dia_vencimento": 1..28, "inicio": "AAAA-MM-DD", "pago_ate": "AAAA-MM-DD" | null }`.
   - **`pago_ate` = data do último vencimento quitado** (não o fim do período). `null` = nenhum vencimento quitado.
   - CHECK no banco, além da rota: `enterprise_assinatura is null or coalesce((enterprise_assinatura->>'cobra')::boolean, false) = false or (enterprise_assinatura->>'valor')::numeric > 0`.
   Sem registro (`null`) = "sem cobrança".
   - Escrita só pela rota nova (cliente de serviço, servidor). A coluna nasce bloqueada para escrita direta pelo trigger `profiles_trava_colunas_sensiveis` (lista fechada: só ADMIN e service role).
   - Leitura no banco: segue `profiles_select_own` (o usuário lê a própria linha) e `profiles_select_admin`. O master não lê a linha do usuário pela RLS; lê pela rota.
2. **Rota `GET/PATCH /api/enterprise/assinaturas`** (`exigirEnterprise({ somenteMaster: true })`; modo ADMIN só leitura, como as demais rotas do Enterprise):
   - GET: os usuários do master com o registro e a situação calculada.
   - PATCH `{ id, cobra, valor?, periodicidade?, dia_vencimento?, inicio? }`: define ou altera. **Mudar periodicidade, dia de vencimento ou início, ou religar (`cobra` de false para true), reinicia a série**: exige `inicio` (o master informa; padrão = hoje em America/Sao_Paulo) e zera `pago_ate`. Mudar só o valor não mexe na série. Desligar (`cobra=false`) mantém o registro e a situação passa a "Sem cobrança".
   - PATCH `{ id, registrar_pagamento: "AAAA-MM-DD" }` (o vencimento de referência mostrado na tela): se não há registro ou `cobra=false` → 400; se a data não é o vencimento em aberto calculado no servidor → 409 "Este vencimento já foi registrado ou mudou. Atualize a tela." (clique duplo ou dois envios não avançam dois períodos); senão `pago_ate` = essa data.
   - PATCH `{ id, desfazer_pagamento: "AAAA-MM-DD" }` (o `pago_ate` atual mostrado na tela): se não bate com o `pago_ate` gravado → 409; senão `pago_ate` volta ao vencimento anterior da série (ou `null`, se era o primeiro). Corrige um registro feito por engano.
   - O usuário precisa ser da equipe do master (`usuariosIds`), senão 404.
   - Validação no servidor: `valor` > 0 e ≤ 1.000.000,00 quando `cobra`, arredondado com `Math.round(v*100)/100`; periodicidade do enum; dia 1 a 28; `inicio` no formato AAAA-MM-DD conferido por regex e por componentes (ano, mês, dia), sem `new Date("AAAA-MM-DD")`.
   - Modo ADMIN: o GET registra ACCESS com `logLeituraAdmin`, como `app/api/enterprise/usuarios/route.ts`.
   - `logAuditStrict` aguardado **antes** de gravar (usuário, valor antigo e novo, quem, quando); se o log falhar, nada é gravado; se a gravação falhar depois do log, registro de falha.
3. **Situação** (funções puras em `lib/enterprise-assinatura.ts`, datas como texto AAAA-MM-DD, "hoje" calculado em `America/Sao_Paulo`; P = 1, 3 ou 12 meses):
   - sem registro ou `cobra = false`: "Sem cobrança";
   - **primeiro vencimento** D0 = a primeira data com dia `dia_vencimento` **igual ou posterior** a `inicio` (início no próprio dia do vencimento já vence nesse dia);
   - a série é D0, D0 + P meses, D0 + 2P meses... (sempre no `dia_vencimento`, que vai até 28, então todo mês tem o dia);
   - **vencimento em aberto** = D0 se `pago_ate` é nulo; senão `pago_ate` + P meses;
   - "Em dia" se hoje ≤ vencimento em aberto; "Vencida desde DD/MM/AAAA" se hoje > vencimento em aberto;
   - vencimento anterior (para desfazer) = `pago_ate` − P meses, ou `null` se `pago_ate` = D0.
   - A situação é só informativa: **não bloqueia o acesso do usuário** (bloquear é o botão Bloquear já existente em Enterprise › Usuários).
4. **Minha Assinatura liberada para ENTERPRISE** (`page.tsx` aceita o papel):
   - Master × equipe: decidido no servidor por `contextoEnterprise(...).ehMaster` (master tem `enterprise_id` nulo).
   - **Master**: a visão de partner de hoje (plano, contrato, comissões dele), **sem** as ações de pagamento à V3 por Cora, InfinitePay, renovação e upgrade, **sem** o card pago "Atendimento IA no WhatsApp" (e sem o fetch de `/api/partner/sdr/addon-status`) e **sem** o aviso de trial/renovação (o Enterprise é cobrado pelo contrato de Parceria, não por essas telas). Abaixo, o quadro **"Assinatura da equipe"**: cada usuário (ordem: ativos primeiro, depois nome `localeCompare("pt-BR")`) com Cobra? (sim/não), Valor (máscara BRL `R$ 1.234,56`, digitação com vírgula), Periodicidade (Mensal/Trimestral/Anual), Dia de vencimento (1 a 28), **Início da cobrança** (DD/MM/AAAA, padrão hoje; convertido para AAAA-MM-DD por componentes), Situação, Último vencimento pago (DD/MM/AAAA) e os botões **"Registrar pagamento"** e **"Desfazer último registro"**. As duas ações abrem o modal V3 do projeto (`confirmar` de `lib/aviso`, não `window.confirm`), que fecha só pelos botões: "Registrar o pagamento de R$ X de {nome}, referente ao vencimento de DD/MM/AAAA?" e "Desfazer o registro do vencimento de DD/MM/AAAA de {nome}? A situação volta a mostrar esse vencimento em aberto." Botão desabilitado enquanto envia; "Desfazer último registro" usa o modal de perigo (`perigo: true`) e fica desabilitado quando não há pagamento registrado. Mudar periodicidade, dia ou início mostra antes: "Isso reinicia a contagem dos vencimentos a partir do início informado. O último pagamento registrado deixa de aparecer aqui (o histórico fica guardado)." Texto de apoio: "A cobrança é feita por você, fora da plataforma. Aqui você registra o valor e marca quando recebeu."
   - **Usuário da equipe**: a página mostra só **"Sua assinatura com {marca}"**: com cobrança, Valor (BRL), Periodicidade, Próximo vencimento (DD/MM/AAAA) e Situação, e o texto "A cobrança é feita diretamente pela {marca}."; sem cobrança, "Sem cobrança: o seu acesso está incluído pela {marca}." Nenhuma ação de pagamento (Cora, InfinitePay etc.) e nenhuma informação do plano da V3.
   - A página entrega ao client da equipe só esses campos (cortados no servidor).
5. Fora do Enterprise nada muda.

## IMPACT
- Tabela `profiles`: +1 coluna `enterprise_assinatura jsonb` nullable. Migration `supabase/migrations/20261123c_enterprise_assinatura_equipe.sql` + `_rollback.sql.txt` (drop da coluna). Sem policy, GRANT, view ou função nova.
- Arquivos: `app/(platform)/minha-assinatura/page.tsx`, `components/minha-assinatura/minha-assinatura-client.tsx` (esconder ações para ENTERPRISE), `components/minha-assinatura/assinatura-equipe-enterprise.tsx` e `minha-assinatura-enterprise.tsx` (novos), `app/api/enterprise/assinaturas/route.ts` (novo), `lib/enterprise-assinatura.ts` (novo).
- As rotas `/api/cora/subscription`, `/api/infinitepay/checkout`, `/api/assinatura/solicitar-*` passam a recusar ENTERPRISE (403) com o helper `bloqueioEnterprise` já existente, para o master não abrir cobrança de partner pela V3 por engano.

## UX: ONDE O USUÁRIO VÊ ISSO
- Master AGS, menu **Minha Assinatura**: plano Enterprise e contrato; quadro "Assinatura da equipe" com o usuário de teste (hoje "Sem cobrança").
- Usuário da equipe AGS, menu **Minha Assinatura**: "Sua assinatura com AGS Finance" com o que o master definiu.
- Estados vazios: master sem usuários, "Você ainda não tem usuários. Cadastre em Enterprise › Usuários."; usuário sem registro, "Sem cobrança".

## DEPENDENCIES
- Migration com teste em transação desfeita e segundo go antes de aplicar. **Ordem: aplicar a migration antes do merge**, para o usuário nunca ver "Sem cobrança" quando o master já quis cobrar. O código ainda tolera a ausência da coluna: o usuário vê "Informação indisponível" e o PATCH devolve 503 "Indisponível até a atualização do banco.".

## RISKS
- Seção 6: coluna nova em `profiles`, coberta pelo trigger de colunas sensíveis e pelas políticas existentes (o usuário lê o próprio registro, o que é desejado: é a cobrança dele).
- Financeiro sem dinheiro: o registro de pagamento é declaração do master, não comprovação; o texto da tela deixa claro que a cobrança é por fora.
- Relação contratual Enterprise × usuário: a V3 só registra o que o master define; não emite cobrança. Pergunta ao Robson em PARECER.
- Regressão: master deixa de ver os botões de pagamento à V3 nessas telas (não se aplicam ao Enterprise).
- Performance: uma consulta a mais por página.

## APPROACH
- Escolhida: registro em `jsonb` no perfil do usuário + rota do master + situação calculada, sem tabela de pagamentos (o histórico fica no `audit_logs`).
- Descartada: tabela de cobranças com uma linha por vencimento (mais pesada; útil só se a plataforma emitisse cobranças, o que foi descartado na Decisão 1). Descartada: emitir Pix/boleto pela Cora da V3 (dinheiro do master passando pela V3).

## PLANO DE TESTE
- Migration em `begin ... rollback` (bloco com erro proposital, como nas anteriores): coluna e CHECK criados; (a) anon lê 0 linhas; (b) usuário da equipe lê o próprio registro e não o de outro; (c) master não lê o do usuário pela REST; (d) ADMIN lê; (e) UPDATE do master na linha do usuário → **0 linhas afetadas** (o USING de `profiles_update_own` filtra; o trigger nem roda); (f) **usuário da equipe faz UPDATE do próprio `enterprise_assinatura`** (ex.: mudar `pago_ate`) → 42501 pelo trigger; (g) partner V3 lê o registro do usuário da equipe → 0; CHECK recusa `cobra=true` com valor 0.
- Teste unitário das funções de vencimento: sem cobrança; mensal em dia e vencida; trimestral e anual (D0 e D0 + P); início no próprio dia do vencimento (vence no dia); início depois do dia (vence no mês seguinte); dia 28 em fevereiro; virada de ano; vencimento anterior para desfazer (inclusive voltar a null); "hoje" em America/Sao_Paulo às 23h30 de um dia (não vira o dia seguinte).
- Rota: registrar com vencimento errado → 409; registrar duas vezes o mesmo → segunda 409; registrar sem cobrança → 400; desfazer com data errada → 409; mudar periodicidade zera `pago_ate`.
- Rota: usuário de outro master → 404; valor 0 com `cobra` → 400; periodicidade inválida → 400; registrar pagamento avança `pago_ate` um período; log antes da gravação.
- Telas: master vê o quadro e salva com vírgula ("150,00"); usuário vê o que foi definido; partner V3 igual a hoje; `/api/cora/subscription` com ENTERPRISE → 403.

## ESTIMATE
M. 4 a 5 horas. Confiança média.

## PARECER DE COMPLIANCE
[VALIDAR COM ROBSON]: a plataforma da V3 passa a registrar e mostrar a cobrança que o cliente Enterprise faz dos usuários dele (valor, vencimento, pago/vencido), sem a V3 receber nada. Pergunta: há implicação contratual (Parceria v2.4) ou de LGPD em a V3 guardar esse registro? Bloqueia até a resposta ou "go mesmo assim".

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6 (23/11): BLOQUEADO, 5 falhas: (1) [1.5] início sem entrada → campo DD/MM/AAAA, padrão hoje, conversão por componentes; (2) [1.5] regra de vencimento ambígua → `pago_ate` = último vencimento quitado, D0 inclusivo, série com P meses, mudança de série zera, 400 sem cobrança; (3) [3.3] registrar sem desfazer → idempotente por data (409) + "Desfazer último registro", modal V3; (4) [6.8] teste (e) errado → 0 linhas, mais (f) usuário altera o próprio → 42501 e (g) partner V3 → 0; (5) Robson → pendente. Sugestões aplicadas: card do Atendimento IA e aviso de trial fora para ENTERPRISE, ehMaster por contextoEnterprise, arredondamento + CHECK no banco, migration antes do merge com "Informação indisponível", ACCESS no modo ADMIN. Não aplicada: último pagamento por quem, tirado do audit_logs (fica para depois).

Rodada 2 de 6 (23/11): BLOQUEADO, 1 falha só humana: [VALIDAR COM ROBSON]. Zero falhas técnicas. Sugestões aplicadas: modal de perigo e botão desabilitado no desfazer, aviso de que o último pagamento some ao reiniciar a série.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO na rodada 2 de 6 (23/11/2026), só pela dependência do Robson
- Falha aceita pelo Hamilton em 23/11/2026, texto capturado pelo gate: "go mesmo assim: aceito seguir sem o parecer do Robson sobre a V3 registrar e mostrar a cobrança que o Enterprise faz dos usuários dele, sem a V3 receber nada" ([VALIDAR COM ROBSON] aceito; o Robson continua devendo ser consultado).
- Go: "go mesmo assim" do Hamilton, 23/11/2026 (válido até 24/11 10:22 UTC)
- Migration aplicada em produção: não

## TESTE DA MIGRATION ANTES DE APLICAR (24/11/2026)
Rodado pelo Hamilton no SQL Editor de produção (`teste-migration-assinatura-equipe.sql`, bloco com erro proposital, tudo desfeito):
- Coluna e CHECK criados. CHECK com `cobra=true` e valor 0: recusado (23514).
- (a) anon lê profiles: 0. (b) usuário da equipe lê o próprio registro: 1; lê a linha do master: 0. (c) master lê a linha do usuário: 0. (d) ADMIN lê: 1.
- (e) master altera a linha do usuário: 0 linhas afetadas. (f) usuário muda o próprio `pago_ate`: bloqueado (42501). (g) partner V3 lê a linha do usuário: 0.
Tudo como esperado. Aplicação real: segundo go do Hamilton, antes do merge do PR #425.
