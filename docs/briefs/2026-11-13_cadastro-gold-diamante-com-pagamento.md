# BRIEF: Link de cadastro Gold/Diamante com pagamento (Cora)

> Data: 2026-11-13 | Autor: Claude (pedido do Hamilton) | Status: GO DADO (override, Robson pendente)
> Pedido literal: "sobre o partner gold e diamante, https://app.v3partners.com.br/cadastro-partner-oferta quero que coloque em um outro link com o api de pagamento"

## SCOPE
Criar um **segundo link público** de cadastro Gold/Diamante, `/cadastro-partner-oferta-pagamento`, igual ao `/cadastro-partner-oferta` (escolha Gold ou Diamante, aceita `?plano=gold|diamante`), mas que **cobra a 1ª mensalidade na hora pela API da Cora** (Pix + boleto, vencimento em 3 dias corridos, data de Brasília), sem os 30 dias grátis. O link atual `/cadastro-partner-oferta` (e `/cadastro-partner-gold` e `/cadastro-partner-diamante`) continua exatamente como está.

## DECISÕES DO HAMILTON (13/11/2026, respondidas no chat)
1. **Aprovação antes do pagamento:** permitida, **com aviso** no modal de aprovação ("1ª mensalidade ainda não paga"). O e-mail de boas-vindas só diz "paga" se `cora_invoice_status = 'PAID'`.
2. **Desconto de indicação (10% por 6 mensalidades a quem indicou):** **NÃO** vale para a adesão Gold/Diamante. O webhook passa a ignorar o desconto quando `reg.plano` é GOLD ou DIAMANTE.
3. **Comissão do closer (30%) sobre a 1ª mensalidade paga na adesão:** **SIM**, gera.
4. **Pagou e foi REPROVADO:** **estorno integral manual** pelo Financeiro via Pix; o modal de reprovação avisa o admin quando o cadastro está PAGO.

## IMPACT
- Arquivos afetados:
  - `lib/oferta-trial.ts`: novos helpers `vencimentoAdesao(base)` (data AAAA-MM-DD em America/Sao_Paulo). Formatação DD/MM/AAAA reaproveita `dataBR` existente.
  - `app/cadastro-partner-oferta-pagamento/page.tsx` (novo): `<CadastroPartnerForm planosOferta={["GOLD","DIAMANTE"]} ofertaPaga />`, com `metadata` sem "grátis" ("Cadastro V3 Gold ou Diamante: 1ª mensalidade por Pix ou boleto").
  - `components/cadastro-partner/cadastro-form.tsx`, nova prop `ofertaPaga`. Pontos que ela altera (todos, conferidos no código):
    - tela de sucesso: `planoTrial` (linha ~513) passa a ser `null` quando `ofertaPaga`, para cair na tela de cobrança com QR Pix/boleto;
    - `descricao` e `beneficios` dos planos GOLD/DIAMANTE (linhas ~100 a 129): sem "30 dias grátis, sem cartão" quando `ofertaPaga`;
    - cards dos planos (linhas ~747 e ~811): preço mensal "R$ 397,00/mês" / "R$ 897,00/mês" em vez do selo de trial;
    - subtítulo da etapa 1 (linha ~785): "Escolha o plano. A 1ª mensalidade é paga agora por Pix ou boleto; depois, mensal, sem fidelidade.";
    - seção Forma de pagamento (linha ~858): "1ª mensalidade agora: R$ 397,00 (Gold) ou R$ 897,00 (Diamante) por Pix ou boleto, vencimento em 3 dias";
    - Resumo do cadastro (linha ~1152): valor da mensalidade e "Pix ou boleto";
    - rótulo da tela de cobrança (linha ~575, hoje fixo "Primeira mensalidade (R$ 97/mês)"): passa a usar nome e valor do plano escolhido;
    - data de vencimento exibida: a que o servidor devolver (não recalcula no navegador);
    - envia `oferta_paga=1` no POST.
  - `app/api/cadastro-partner/route.ts`:
    - `ofertaPaga = trialOferta && formData.get("oferta_paga") === "1"`; gera cobrança Cora e e-mail quando `!trialOferta || ofertaPaga` (cartão continua fora);
    - vencimento calculado **uma vez** no servidor em America/Sao_Paulo (hoje + 3 dias, `AAAA-MM-DD`), enviado à Cora e devolvido na resposta (`vencimento`) para tela e e-mail em DD/MM/AAAA;
    - rótulo do plano e valor no e-mail derivados de um mapa único (`V3 Gold`, `V3 Diamante`, demais como hoje) e de `PLANO_VALOR` formatado em BRL (corrige o "R$ 97/mês" fixo do e-mail, que hoje só é certo para Partner HE);
    - nome do serviço na fatura Cora: "V3 Partners - 1a mensalidade V3 Gold" / "V3 Diamante" (sem travessão); demais planos mantêm o texto atual, só trocando o travessão por hífen;
    - resposta `trial: trialOferta && !ofertaPaga`.
  - `app/api/cadastro-partner/aprovar/route.ts`: `pagouAdesao = trialOferta && reg.cora_invoice_status === "PAID"`. E-mail: pago → "Sua 1ª mensalidade foi confirmada. Seu acesso vale até DD/MM/AAAA"; emitida e não paga → "Sua 1ª mensalidade (R$ X) vence em DD/MM/AAAA; o acesso depende do pagamento"; sem fatura (link grátis) → texto atual de 30 dias grátis. `trial_expires_at` continua +30 dias.
  - `components/admin-cadastros/admin-cadastros-client.tsx` (hoje "Aprovar e Criar Acesso" e "Reprovar" executam direto no painel de detalhe; só o Enterprise abre confirmação):
    - selo "Link pago" na lista, na cor do status: "Link pago · pendente" (ouro claro) ou "Link pago · pago" (badge de sucesso existente);
    - aviso fixo no painel de detalhe, acima dos botões, quando Gold/Diamante com fatura e não PAID: "1ª mensalidade ainda não paga (vence DD/MM/AAAA)";
    - **confirmação nova** com o `confirmar` V3 existente (`perigo: true`, sem `window.confirm`, fecha só por botão) em dois casos: Aprovar de cadastro Gold/Diamante com fatura não paga ("Aprovar sem pagamento? O partner terá 30 dias de acesso e a fatura de adesão continua aberta") e Reprovar de cadastro PAID ("Cadastro PAGO: ao reprovar, o Financeiro precisa estornar R$ X,XX via Pix ao candidato", com nome, documento mascarado, e-mail e telefone do candidato);
  - `app/api/cora/webhook/route.ts`, bloco `partner_registrations`:
    - desconto de indicação **não** é ativado quando `reg.plano` é GOLD/DIAMANTE;
    - comissão do closer: se `reg.plano` é GOLD/DIAMANTE e já existe `profiles` com o e-mail do cadastro (busca `ilike` com escape, igual a `aprovar/route.ts` linha ~221), chama `gerarComissaoCloserAssinatura({ partnerId, valorPago, pagamentoId: reg.id, dataPagamento })`, só se o cadastro não estiver REPROVADO.
  - `app/api/usuarios/[id]/route.ts` (PATCH, linha ~46, onde `closer_id` é gravado): **caminho principal da comissão do closer**. Ao gravar um `closer_id` não nulo em perfil GOLD/DIAMANTE, procura `partner_registrations` do mesmo e-mail (ilike com escape) com `cora_invoice_status = 'PAID'` e `status <> 'REPROVADO'` e chama `gerarComissaoCloserAssinatura({ partnerId, valorPago: cora_amount_cents/100, pagamentoId: reg.id, dataPagamento: cora_paid_at })`. Não registra pagamento, não mexe em `trial_expires_at` nem em `financeiro_records`. Webhook, aprovação e vínculo usam o mesmo `pagamentoId = reg.id`, e o índice único em `operation_ref` impede duplicar.
  - `app/api/cadastro-partner/aprovar/route.ts` (mesmo arquivo acima): se o cadastro já está PAID na aprovação, tenta a mesma chamada após criar o profile (só gera se já houver `closer_id`; na prática o vínculo em Usuários é o que dispara).
  - Datas exibidas (aprovação, painel, e-mail): vencimento da adesão = `created_at` do cadastro + 3 dias, calculado pelo **mesmo helper** do cadastro (`vencimentoAdesao(base)` em `lib/oferta-trial.ts`, America/Sao_Paulo), que é exatamente a data enviada à Cora; "vale até" = `trial_expires_at`. Regras separadas: (a) o vencimento `AAAA-MM-DD` vira DD/MM/AAAA **só por texto** (reaproveita `dataBR` de `lib/contrato-parceria-partner.ts`, que valida o formato e devolve null se vazio; sem conversor novo), **nunca** passando por `new Date()`, em todos os pontos (tela de sucesso, e-mail do cadastro, e-mail de aprovação, aviso do painel, confirmação); (b) `toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })` só para `trial_expires_at` (timestamp completo).
  - Tela de sucesso do link pago: em vez do "Aguardando confirmação de pagamento..." (o polling não funciona para anônimo), texto fixo "Assim que o pagamento cair, você recebe a confirmação por e-mail".
  - `lib/socios-notify.ts`: rótulo do alerta interno passa a receber o modo: "V3 Gold (30 dias grátis)" no link grátis, "V3 Gold (1ª mensalidade cobrada)" no link pago.
  - `lib/contrato-parceria-partner.ts` (linha ~84): "Mensalidade: R$ X, após 30 dias grátis" vira "Mensalidade: R$ X" + "após 30 dias grátis" só quando o cadastro de origem não tem fatura de adesão. Se o dado não chegar à função sem consulta extra, o texto passa a "Mensalidade: R$ X (30 dias grátis só no link da oferta grátis)".
- Tabelas afetadas: `partner_registrations` (colunas `cora_*` existentes), `profiles` (só leitura no webhook; `referral_discount_*` deixa de ser escrito para Gold/Diamante), `commissions` (insert pela função existente). **Sem migration, sem DDL, sem política nova.**
- Rotas afetadas: nova página `/cadastro-partner-oferta-pagamento`; tela `/admin-cadastros`; `POST /api/cadastro-partner`; `POST /api/cadastro-partner/aprovar`; `POST /api/cora/webhook`; `PATCH /api/usuarios/[id]`.
- APIs e integrações: Cora (`gerarCobrancaCora` existente), Resend (e-mail existente).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso (candidato): link `https://app.v3partners.com.br/cadastro-partner-oferta-pagamento` (e `?plano=gold` / `?plano=diamante`), enviado manualmente pelo time. Não entra na LP `/oferta`.
- Ponto de acesso (admin): `/admin-cadastros`, selo "Link pago · pendente/pago" na lista; aviso fixo acima dos botões no painel de detalhe; confirmação V3 ao Aprovar sem pagamento e ao Reprovar cadastro pago; notificação existente "Pagamento de Adesão Confirmado". Comissão do closer aparece em Comissões (AGUARDANDO_AUTORIZACAO) ao vincular o closer em Usuários.
- Tela de sucesso do candidato: QR Pix, copia-e-cola, boleto e vencimento em DD/MM/AAAA (componente existente).
- Estado vazio: sem plano escolhido, o botão de enviar continua bloqueado como hoje. Cora fora do ar: cadastro salvo sem fatura e a tela diz "A cobrança será enviada por e-mail em instantes"; o admin vê o cadastro sem selo de fatura.
- Nota do porquê: nenhum campo, consulta ou aceite novo; valor e vencimento visíveis antes e depois do envio.

## DEPENDENCIES
- Deve existir antes: papéis GOLD/DIAMANTE (PR #320), `gerarCobrancaCora` e webhook Cora, `PLANO_VALOR.GOLD/DIAMANTE`, `gerarComissaoCloserAssinatura` (PR #341). Todos LIVE.
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: o mesmo `POST /api/cadastro-partner` atende os dois links. Sem `oferta_paga=1`, Gold/Diamante segue sem cobrança. Rótulos de e-mail/fatura dos outros planos mudam só de forma (travessão → hífen, valor real no lugar do "R$ 97/mês" fixo).
- Aprovação antes do pagamento (decisão 1): o partner aprovado ganha 30 dias de acesso mesmo sem pagar, e no D-5 o cron emite a 2ª fatura com a de adesão ainda aberta (duas faturas). **Aceito pelo Hamilton.** Mitigação: aviso fixo no painel, confirmação nova ao Aprovar sem pagamento e texto do e-mail que não diz "paga".
- Cobrança em dobro no caminho feliz: não ocorre. A adesão fica em `partner_registrations`; o cron só olha `partner_subscriptions` e cria a 1ª mensalidade com vencimento = `trial_expires_at` (aprovação + 30 dias). Pago e aprovado dias depois: o partner ganha esses dias (a favor do cliente).
- Comissão do closer: gerada no momento em que o closer é vinculado em Usuários (ou no webhook/aprovação, se já houver closer). Se o closer for trocado depois, a comissão da adesão fica com o 1º closer vinculado. Nunca usa o "registrar pagamento manual" da aba Assinaturas, que duplicaria receita e mexeria em `trial_expires_at`.
- Estorno (decisão 4): manual, fora do sistema; risco de esquecimento mitigado pela confirmação nova ao Reprovar cadastro PAID.
- Polling da tela de sucesso: `/api/cora/cobranca/status` não é rota pública, então "Aguardando confirmação" não vira "Pagamento confirmado" para o candidato anônimo. Já acontece nos anuais; **fora do escopo**, o candidato recebe a confirmação por e-mail/aprovação.
- CNPJ alfanumérico na 2ª mensalidade (cron e `gerarProximaCobranca` normalizam com `\D`): pendência já catalogada (PR #212), não piora com este BRIEF.
- LGPD e compliance: mesmos dados e mesmo destinatário (Cora) do cadastro anual em produção. ⚠️ ROBSON: a condição contratual (1ª mensalidade na adesão em vez de após 30 dias grátis) precisa de conferência na minuta Gold/Diamante aprovada em 22/10 e parecer do Robson. **[VALIDAR COM ROBSON]**, ver Parecer.
- Segurança de acesso ao banco (anon, RLS, views, funções): nenhuma mudança. Escrita só em rota de servidor com service role já existente; `anon` não ganha nada.
- Performance: uma chamada à Cora por cadastro pago, igual aos anuais.

## APPROACH
- Abordagem escolhida: reaproveitar formulário e rota de cadastro com uma flag (`ofertaPaga` / `oferta_paga=1`), porque cobrança Cora, e-mail de pagamento, tela Pix/boleto e webhook de adesão já existem e funcionam nos anuais. Modo pago identificado na aprovação pela fatura (`cora_invoice_id`) e pelo status (`cora_invoice_status`), sem coluna nova.
- Alternativa descartada: papéis novos (GOLD_PAGO) ou coluna `modalidade` em `partner_registrations`: exige migration e espalhar o papel pelos 91 arquivos, sem ganho após a aprovação.
- Alternativa descartada 2: cartão recorrente (InfinitePay): manual, sem API.

## DESENHO TÉCNICO
- Sem SQL. Sem migration.
- Vencimento: helper `vencimentoAdesao(base = new Date())` em `lib/oferta-trial.ts`: `const venc = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(base.getTime() + 3 * 86400000))` → `AAAA-MM-DD` (no cadastro, `base` = agora; na aprovação/painel, `base` = `created_at`), passado a `gerarCobrancaCora` (que hoje usa `toISOString` em UTC) e devolvido na resposta.
- Valor: `PLANO_VALOR[plano]` em centavos (39700 / 89700), sem digitação.

## PLANO DE TESTE
- `next dev` local + puppeteer: `/cadastro-partner-oferta-pagamento?plano=gold` e `?plano=diamante`: nenhum "grátis" em nenhuma etapa (busca textual na página), valores certos, 375px sem overflow, console sem erro.
- Cadastro simulado entre 21h e 24h de Brasília (relógio do teste): tela, e-mail e data enviada à Cora mostram o mesmo dia.
- Regressão `/cadastro-partner-oferta`: textos de 30 dias grátis e tela de sucesso de trial (sem QR).
- Produção, depois do deploy, com cadastro de teste (e-mail da V3, CPF de teste do time, nunca partner real): tela de sucesso com QR e vencimento, e-mail recebido com "V3 Gold" e R$ 397,00, fatura Cora com nome certo; pagamento não será feito, a fatura é cancelada na Cora e o cadastro excluído. Webhook PAGO e comissão do closer não testáveis sem pagamento real: conferir no 1º cadastro pago real.
- Typecheck com exit=0 e status de produção conferido após o merge.

## ESTIMATE
M. 10 arquivos, sem migration. Esforço ~3 h. Confiança alta.

## PARECER DE COMPLIANCE
[VALIDAR COM ROBSON] Pergunta: "No link novo, o Gold/Diamante paga a 1ª mensalidade na adesão (sem os 30 dias grátis). A minuta Gold/Diamante aprovada em 22/10 cobre isso ou precisa de ajuste? E o estorno integral manual em caso de reprovação do cadastro está ok?" Resposta: pendente. Data/quem/texto: pendente.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1 de 6: BLOQUEADO (6 falhas). Tratamento nesta versão:
1. Textos "grátis" e tela de sucesso no link pago: listados um a um em IMPACT.
2. Valor/nome errados no e-mail, tela e fatura: corrigidos em IMPACT (mapa único + `PLANO_VALOR`, sem travessão).
3. Aprovação antes do pagamento: `cora_invoice_status = 'PAID'`, decisão 1 e risco aceito.
4. Webhook (indicação e closer): decisões 2 e 3, arquivos no IMPACT.
5. Compliance: [VALIDAR COM ROBSON] aberto; texto do contrato e estorno tratados.
6. Vencimento em fuso: calculado no servidor em America/Sao_Paulo.

Rodada 2 de 6: BLOQUEADO (4 falhas). Tratamento nesta versão:
1. Robson: segue aberto, só fecha com a resposta.
2. Comissão do closer: caminho principal no PATCH de Usuários (`app/api/usuarios/[id]/route.ts`), sem registrar pagamento nem mexer em `trial_expires_at`.
3. Modais inexistentes: aviso fixo no painel + confirmação V3 nova (Aprovar sem pagamento, Reprovar pago).
4. Datas: vencimento = `created_at` + 3 dias pelo mesmo helper do cadastro (America/Sao_Paulo); todas formatadas em DD/MM/AAAA no fuso de Brasília.

Rodada 3 de 6: BLOQUEADO (2 falhas): Robson pendente; formatação do vencimento AAAA-MM-DD via `new Date` voltaria um dia. Corrigido: vencimento formatado só por texto (`dataBRdeISO`), `toLocaleDateString` com fuso só para `trial_expires_at`. Sugestões aplicadas: closer ignora cadastro REPROVADO; rotas alinhadas; confirmação de estorno com dados do candidato.

Rodada 4 de 6: BLOQUEADO (1 falha): só o parecer do Robson. Técnico e governança de interface: tudo PASSOU. Sugestões aplicadas: reaproveitar `dataBR` existente; teste de cadastro entre 21h e 24h.

## REGISTRO DE LIBERAÇÃO
- QA: BLOQUEADO (rodadas: 4), única falha aberta: [VALIDAR COM ROBSON] parecer sobre cobrar a 1ª mensalidade na adesão e estorno manual
- Override ("go mesmo assim"): SIM. Falha aceita: [VALIDAR COM ROBSON] parecer pendente sobre cobrar a 1ª mensalidade na adesão e o estorno manual. Qualquer ajuste de minuta que o Robson pedir passa pelo @contract-legal-guardian e pelo quórum depois.
- Go dado por: Hamilton, "go mesmo assim" em 2026-11-13 (registrado pelo próprio Hamilton via `capture` em `.claude/brief-release/go-log.jsonl`, válido até 2026-11-14 03:47 UTC; a sessão foi aberta fora do repo e o hook não capturou sozinho)
- Migration aplicada em produção: não se aplica

## EXECUÇÃO (2026-11-13)
- Fora do BRIEF, no mesmo arquivo do webhook: o pagamento da adesão não volta mais o status de um cadastro já APROVADO ou REPROVADO para PAGO (com "aprova com aviso" isso passaria a acontecer). Só `cora_invoice_status`/`cora_paid_at` são gravados nesses casos.
- Teste local (next dev + puppeteer): `/cadastro-partner-oferta-pagamento` em 375px e 1280px sem overflow, sem erro de console, nenhuma ocorrência de "grátis"; `/cadastro-partner-oferta` segue com os 30 dias grátis. Helper de vencimento conferido às 21h05, 23h30, 00h10 e 12h de Brasília (sempre D+3 local; o cálculo antigo em UTC dava D+4 depois das 21h).
- Typecheck: sem erro no código; só erros de tipos velhos em `.next/` de outras branches.
- Não testado localmente (exige Cora real): envio do cadastro, tela de sucesso com QR, e-mails, webhook, comissão do closer. Fica para o teste em produção com cadastro de teste.
