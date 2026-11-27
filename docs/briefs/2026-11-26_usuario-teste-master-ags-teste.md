# BRIEF: Usuário de teste vira master temporário do Enterprise "AGS Teste"

> Data: 2026-11-26 | Autor: Claude (pedido do Hamilton: "QUERO QUE O TESTE COLOQUE O USUARIO COMO MASTER, PARA VALIDAR O QUE APARECE NAS ABAS" e "COLOCA O AGS TESTE COMO MASTER TEMPORARIO") | Status: LIBERADO
> Salvar em `docs/briefs/2026-11-26_usuario-teste-master-ags-teste.md` e commitar junto com a próxima mudança de código, ou num PR só de docs.

## SCOPE
O Hamilton quer ver, logado, o que o master de um Enterprise vê nas abas. Cada Enterprise tem um único master (`role = ENTERPRISE` e `enterprise_id` nulo), e o master da AGS é o cliente real Marciano (57375034-…). Por isso **não se mexe no Marciano**.

O que muda: o usuário de teste "Teste AGS V3" (07668ecf-b524-4495-8bf2-ef18bb23db51), hoje membro da equipe AGS, passa a ser **master temporário de um Enterprise separado chamado "AGS Teste"**, com o mesmo logo, ícone e cores da AGS, sem domínio próprio. Terminado o teste, os dados voltam exatamente ao estado de hoje.

É uma operação **só de dados**: sem código, sem migration e sem DDL.
- **Ida:** 2 cópias de arquivo no bucket `white-label`, 1 `update` em uma linha de `profiles` e 1 registro de auditoria.
- **Volta:** 1 `update`, a remoção dos arquivos da pasta e 1 registro de auditoria.

## IMPACT
- Arquivos afetados: nenhum arquivo do código. O script de execução fica no scratchpad e é apagado depois.
- Tabelas afetadas:
  - `profiles`, uma linha (07668ecf-…). Na ida mudam `enterprise_id`, `white_label_nome`, `white_label_logo_url`, `white_label_tema` e `trial_expires_at`. Na volta, as 13 colunas do snapshot S são restauradas (ver DESENHO TÉCNICO);
  - `audit_logs`: 2 registros, um na ida e outro na volta.
- Storage: bucket `white-label`, cópia de 2 arquivos da pasta do Marciano para a pasta do usuário de teste:
  - `57375034-…/logo-1795402047585.png` → `07668ecf-…/logo-ags-teste.png`;
  - `57375034-…/icone-1795402149797.png` → `07668ecf-…/icone-ags-teste.png`.
  Os originais não são tocados. Na reversão, todos os arquivos da pasta `07668ecf-…/` são removidos (a pasta estava vazia antes do teste).
- Rotas afetadas: nenhuma alteração.
- APIs e integrações afetadas: Supabase (service role, só pelo script).

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso: o Hamilton entra com o usuário de teste em **app.v3partners.com.br** (o agente não faz login nem digita senha). Ele vê o menu do master, inclusive a aba **"Enterprise"** (usuários, marca, domínio, comissões), com o logo e as cores da AGS e o nome "AGS Teste".
- Login por agsfinance.app: o domínio é do Marciano. Pela regra que já existe (`app/(platform)/layout.tsx:131-138`), quem não é da equipe dele é mandado para app.v3partners.com.br/dashboard. Isso é esperado e serve até de teste dessa regra.
- O que o Marciano vê durante o teste: a lista de usuários na aba Enterprise dele mostra um usuário a menos (o de teste). Nenhum outro dado dele muda.
- Diferenças do "AGS Teste" para a AGS real:
  - não tem domínio;
  - não tem razão social nem CNPJ, que ficam vazios de propósito para que nenhum documento gerado no teste saia com o CNPJ real da AGS;
  - não tem equipe;
  - não tem closer.
- Estado vazio: a aba Enterprise do "AGS Teste" mostra 0 usuários, o domínio sem configurar e a razão social e o CNPJ em branco.
- **Regra do teste: só olhar.**
  - **Permitido:** navegar por todas as abas e menus, abrir telas e formulários sem salvar, ver as listas.
  - **Proibido:**
    - criar usuário na aba Enterprise;
    - configurar domínio;
    - salvar razão social, CNPJ, logo, ícone ou cores na tela Marca;
    - salvar repasses ou assinaturas da equipe;
    - criar proposta, análise de crédito, lead, consulta paga (CheckTudo/SCR) ou qualquer cadastro; agir na proposta de teste V3-CR-TESTE-AGS-0001 (ver ADENDO 27/11);
    - baixar PDF ou exportar relatório: algumas telas gravam EXPORT na auditoria, e isso faz a reversão parar.

    Esses cadastros geram custo, notificam a Mesa, e uma proposta apareceria nas mesas da V3 com a tarja "AGS Teste" nas cores da AGS, podendo ser confundida com o cliente real.
  - O que a reversão confere de fato (C, ver DESENHO TÉCNICO): equipe, propostas, leads, repasses, arquivos na pasta do bucket, colunas de domínio e **qualquer registro de escrita (CREATE, UPDATE, DELETE, OVERRIDE, EXPORT) em `audit_logs` com `user_id` = usuário de teste entre a ida e a volta**. Essa última consulta cobre as rotas que registram auditoria, mas não todas as ações do sistema. Se qualquer item aparecer, a reversão **para** e avisa o Hamilton. Consulta paga, Chat Mesa, chave de API, deal de M&A e lead de prospecção ficam cobertos só se a rota correspondente registra auditoria; por isso a orientação "só olhar" continua valendo.
- Prazo: reverter até **30/11/2026**, antes do relatório mensal de partners de 01/12. Se passar do prazo, o agente avisa o Hamilton na primeira mensagem seguinte.
- Aviso à equipe: o Hamilton avisa a Mesa e o João que "AGS Teste" vai aparecer na aba Enterprises do ADMIN durante o teste, para ninguém tratar como cliente novo.
- Sem UI? A operação em si não tem tela; o resultado aparece no login do usuário de teste.

## DEPENDENCIES
- Deve existir antes: o usuário de teste (existe, sem propostas e sem equipe abaixo dele, conferido em 26/11).
- Migrations pendentes: nenhuma.

## RISKS (nunca "nenhum")
- Breaking changes: nenhum código muda. A única linha alterada é a do usuário de teste.
- Arquivo compartilhado: a tela Marca apaga do bucket os arquivos que saem do tema (`app/api/enterprise/marca/route.ts:231-238`). Se o "AGS Teste" apontasse para os arquivos do Marciano e o Hamilton trocasse o ícone no teste, **o ícone real da AGS seria apagado**. Por isso os arquivos são **copiados** para a pasta do usuário de teste, e o tema do "AGS Teste" aponta só para as cópias.
- Ações reais que o menu do master permite: criar usuário (manda convite de verdade), configurar domínio (Vercel e Resend), gravar razão social e CNPJ, repasses e assinaturas, e criar proposta, análise ou lead (custo de consulta e notificação à Mesa). Não há trava técnica para essas ações. A regra "só olhar" (UX) é uma orientação, e por isso a reversão confere tudo depois e **para** se algo foi gravado, sem tentar limpar sozinha. Qualquer limpeza vira outro BRIEF.
- Reversão: restaura **todas** as colunas do snapshot do passo 1, inclusive as que o master de teste consegue gravar (razão social, CNPJ, domínio). Assim nada que o teste gravou nessas colunas fica para trás.
- LGPD e compliance: não há dado pessoal novo. A conta é de teste da V3, e as cores, o logo e o nome da AGS já são públicos na tela de login dela. A razão social e o CNPJ da AGS **não** são copiados.
- Segurança de acesso ao banco (anon, RLS, views, funções): nada muda em políticas, grants nem funções. A escrita é feita pela service role, num script local, com o env de produção apagado ao final.
- Comissões, relatórios e listas: o usuário de teste não tinha propostas na ida. Desde o ADENDO de 27/11 ele tem 1 proposta fictícia, que conta nos painéis enquanto existir e é apagada até 30/11 (ver ADENDO). Ele aparece como Enterprise separado na aba Enterprises do ADMIN durante o teste.
- Performance: nenhuma.
- Vercel timeout (60s): não se aplica.

## APPROACH
- Abordagem escolhida: um master separado, com cópia da identidade visual da AGS, e reversão exata. Mostra o menu do master sem tocar no cliente real.
- Alternativas descartadas:
  - **Trocar o master da AGS** (tirar o Marciano): afeta o cliente real, que perde a aba Enterprise durante o teste.
  - **Modo ADMIN só de leitura** (`?master=`): não mostra o menu como o master vê. O Hamilton pediu ver as abas.
  - **Referenciar os arquivos do Marciano sem copiar**: risco de apagar o ícone real da AGS (ver RISKS).

## DESENHO TÉCNICO
Script Node no scratchpad. O env de produção é puxado com `vercel env pull`, o script copia só `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` e o arquivo é apagado **logo em seguida**, antes de qualquer escrita. O script também é apagado ao final.

Colunas do snapshot (S): `enterprise_id`, `enterprise_repasse_percent`, `enterprise_assinatura`, `trial_expires_at`, `is_active`, `white_label_nome`, `white_label_logo_url`, `white_label_tema`, `white_label_razao_social`, `white_label_cnpj`, `white_label_dominio`, `white_label_dominio_status`, `white_label_dominio_atualizado_em`.

Conferências de "nada gravado" (C), para o id 07668ecf-…:
- `audit_logs` **de escrita** com `user_id` = 07668ecf-… e `created_at` depois do registro de ida é 0. Escrita quer dizer `action in ('CREATE','UPDATE','DELETE','OVERRIDE','EXPORT')`; LOGIN, LOGOUT e ACCESS ficam de fora, porque o próprio login do teste grava LOGIN. Cobre as rotas auditadas, não todas;
- equipe: `profiles` com `enterprise_id` = 07668ecf-… é 0;
- `credit_desk_proposals` com `partner_id` = 07668ecf-… é 0 (na reversão, depois do passo 0 do ADENDO de 27/11);
- `crm_leads` com `partner_id` = 07668ecf-… é 0;
- `enterprise_repasses` com `enterprise_id` = 07668ecf-… é 0;
- pasta `07668ecf-…/` no bucket `white-label`: lista de arquivos.
```
1. Ler S da linha 07668ecf-… e comparar com o esperado:
   enterprise_id = 57375034-ee87-4b29-a784-2220037c4802, enterprise_repasse_percent = 0,
   is_active = true, e todas as outras colunas de S nulas. Divergiu → PARAR, registrar no BRIEF o valor
   encontrado e ajustar o esperado com o Hamilton (sem forçar).
   Ler C: tudo 0 e a pasta vazia. Divergiu → PARAR.
   Ler o id do perfil ADMIN do Hamilton (quem pediu) para o user_id da auditoria.
2. audit_logs ANTES de qualquer escrita (await; falhou → PARAR sem escrever):
   user_id = <ADMIN do Hamilton>, user_name = "Claude via script service role (pedido do Hamilton)",
   action UPDATE, entity profiles, entity_id 07668ecf-…,
   old_data = S, new_data = { ...S novo, arquivos_copiados: [<2 caminhos de destino>], via: "script service role" }.
3. storage.from("white-label").copy(<logo do Marciano>, "07668ecf-…/logo-ags-teste.png")
   storage.from("white-label").copy(<ícone do Marciano>, "07668ecf-…/icone-ags-teste.png")
   Falhou → apagar o que foi copiado e PARAR.
4. update profiles set
     enterprise_id = null,
     white_label_nome = 'AGS Teste',
     white_label_logo_url = <URL pública da cópia do logo>,
     white_label_tema = {"cor_principal":"#040968","cor_acento":"#00E000",
                         "icone_url":<URL pública da cópia do ícone>,"logo_claro_url":null},
     trial_expires_at = '2027-11-11T01:35:47.964+00:00'   -- igual ao do Marciano, para o menu e os avisos serem os mesmos
   where id = '07668ecf-b524-4495-8bf2-ef18bb23db51' and enterprise_id = '57375034-…'
   Conferir exatamente 1 linha afetada; senão apagar as cópias e PARAR.
5. (a auditoria já foi gravada no passo 2)
6. Conferência: contextoEnterprise do 07668ecf-… → ehMaster true, marca "AGS Teste", tema com as cópias.
```
**Reversão** (quando o Hamilton disser que o teste acabou, ou no prazo de 30/11):
```
1. Ler C. PARAR e avisar o Hamilton com o que foi encontrado (a limpeza vira outro BRIEF) se:
   - audit_logs de escrita do 07668ecf-… depois da ida for diferente de 0;
   - equipe, propostas, leads ou repasses forem diferentes de 0;
   - a pasta 07668ecf-…/ tiver qualquer arquivo além das 2 cópias (upload na tela Marca, que também grava UPDATE).
   Regra única: qualquer escrita encontrada → PARAR. Os registros LOGIN e ACCESS do período são listados
   no relatório (data e hora) só como prova de que o teste aconteceu.
   Ler S atual. Se white_label_dominio, white_label_dominio_status ou white_label_dominio_atualizado_em
   mudaram → PARAR sem restaurar e avisar o Hamilton: o domínio pode estar cadastrado na Vercel e no
   Resend, e zerar a coluna deixaria o domínio solto (o DELETE da tela lê a coluna). Remover vira outro BRIEF.
   As demais colunas que mudaram são mostradas ao Hamilton (informativo) e restauradas. Na prática, mudança
   nelas já teria parado no passo 1 pela auditoria de escrita; a restauração completa fica como garantia.
2. audit_logs ANTES (await; falhou → PARAR): mesmo user_id e user_name, action UPDATE,
   old_data = S atual, new_data = S original, arquivos_removidos = <lista da pasta 07668ecf-…/>.
3. update profiles set <todas as colunas de S com os valores originais do passo 1 da ida>
   where id = '07668ecf-…' and enterprise_id is null and white_label_nome = 'AGS Teste'
   Conferir exatamente 1 linha afetada; senão PARAR.
4. storage remove de todos os arquivos da pasta 07668ecf-…/ (na ida ela estava vazia).
5. Conferência: S igual ao original, pasta vazia, o 07668ecf-… volta à equipe do Marciano.
```

## PLANO DE TESTE
- Depois do passo 6, o agente confere por leitura que o usuário de teste é master, a marca é "AGS Teste", o tema aponta para as cópias e os arquivos originais do Marciano continuam acessíveis (HTTP 200).
- O Hamilton entra em app.v3partners.com.br com o usuário de teste e confere as abas do master, inclusive "Enterprise".
- Após a reversão, o agente confere que **todas** as colunas de S voltaram ao passo 1, que a pasta do bucket está vazia, que C continua 0 e que o usuário de teste reaparece na equipe do Marciano. Confere também os 2 registros de auditoria (ida e volta).

## ESTIMATE
S. Cerca de 15 minutos para aplicar e 10 para reverter. Confiança alta.

## PARECER DE COMPLIANCE
N/A, sem dado pessoal novo. É uma conta de teste da V3, com identidade visual pública da AGS e **sem** razão social nem CNPJ dela.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada 1, 26/11/2026: BLOQUEADO, 4 falhas, todas corrigidas nesta versão:
1. O snapshot e a reversão agora cobrem todas as colunas white_label_* e enterprise_*, além de `trial_expires_at` e `is_active`.
2. Um caminho só: criar usuário é proibido, a reversão para se encontrar equipe, propostas, leads ou repasses, e a limpeza vira outro BRIEF.
3. A lista de ações permitidas ("só olhar") e proibidas está explícita. A reversão confere o que está em C, ou seja, as ações de escrita auditadas e as tabelas listadas; o restante depende da orientação "só olhar" (ver UX).
4. A auditoria é gravada antes das escritas, com o `user_id` do ADMIN do Hamilton, o snapshot completo e os arquivos copiados ou removidos.

Sugestões aplicadas:
- pasta do bucket listada na ida;
- travas com exatamente 1 linha afetada na ida e na volta;
- prazo até 30/11;
- só duas variáveis do env, apagado antes das escritas;
- aviso à Mesa e ao João.

Rodada 2, 26/11/2026: BLOQUEADO, com 1 falha: a reversão podia deixar um domínio solto na Vercel e prometia conferir mais do que conferia. Corrigido:
- a reversão para, sem restaurar, se as colunas de domínio mudaram;
- C ganhou a consulta a `audit_logs` do usuário de teste, com a cobertura limitada às rotas auditadas;
- o texto do UX agora diz o que é conferido de fato.

Sugestões aplicadas:
- IMPACT alinhado (13 colunas na volta, 2 registros de auditoria, remoção da pasta);
- lista de uploads extras mostrada antes de remover;
- snapshot divergente é registrado e ajustado, sem forçar.

Rodada 3, 26/11/2026: BLOQUEADO, com 1 falha: a trava de `audit_logs` dispararia sempre, por causa do LOGIN do próprio teste, e não estava no passo 1 da volta. Corrigido:
- `audit_logs` filtrado por ação de escrita (CREATE, UPDATE, DELETE, OVERRIDE, EXPORT);
- a condição entrou no passo 1 da volta;
- regra única: qualquer escrita, inclusive upload extra na pasta, faz a reversão parar;
- LOGIN e ACCESS só listados no relatório.

Também ajustei o texto do resumo da rodada 1.

Rodada 4 (refeita sobre o arquivo gravado) e rodada 5 na contagem da rotina, 26/11/2026: LIBERADO, zero bloqueantes.

Observação: uma rodada anterior auditou o arquivo antes de a correção ser gravada, e por isso conta 5 rodadas no total.

Sugestões aplicadas:
- UX alinhado ("de escrita");
- exportar PDF ou relatório incluído entre as ações proibidas.

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO (rodadas: 5)
- Override: não
- Go dado por: (pendente)
- Migration aplicada em produção: não se aplica (operação de dados; ver REGISTRO DE EXECUÇÃO abaixo, quando houver)

## REGISTRO DE EXECUÇÃO
- Ida: 26/11/2026, depois do go do Hamilton. C da ida: equipe 0, propostas 0, leads 0, repasses 0, pasta vazia. Snapshot S igual ao esperado. Auditoria gravada antes, com o user_id do ADMIN do Hamilton (75c6cac4…). As 2 cópias foram feitas e o update afetou 1 linha. Conferência: `enterprise_id` nulo, "AGS Teste", tema com as cópias. Os originais do Marciano e as cópias respondem HTTP 200. O env e o script foram apagados.
- Volta: pendente (prazo 30/11/2026).

---

## ADENDO 27/11/2026: proposta de teste (BRIEF `2026-11-27_operacao-teste-ags-teste.md`)
Este adendo vale junto com aquele BRIEF e só depois do go dele.
- Existe 1 proposta fictícia do usuário de teste: `V3-CR-TESTE-AGS-0001`, "CLIENTE TESTE (NÃO ANALISAR)". O id fica no REGISTRO DE EXECUÇÃO daquele BRIEF.
- **"Só olhar" vale também para ela.**
  - Proibido ao testador: abrir a proposta na Mesa de Crédito para agir, responder a pendência, enviar documento, abrir ou escrever no chat da proposta, pedir análise ou consulta.
  - Proibido à mesa: mover de etapa, rodar avaliação, cobrar, enviar a instituição, gerar mandato ou consentimento, comentar ou anexar.
- **Passo 0 da reversão** (antes do passo C da reversão):
  - roda a REVERSÃO daquele BRIEF;
  - critério único: `id = e09a6eec-81a8-468b-829d-7baa1028e018`, `code = 'V3-CR-TESTE-AGS-0001'`, `partner_id = '07668ecf-b524-4495-8bf2-ef18bb23db51'` e `metadata->>teste_ags = 'true'`;
  - o SELECT com esse critério devolve exatamente 1 linha;
  - a linha está intacta;
  - o inventário de tudo que aponta para a proposta (tabelas, Storage e notificações) está vazio;
  - a auditoria com old_data é gravada antes;
  - o DELETE devolve exatamente aquele id.

  Se qualquer item falhar, a reversão para e avisa o Hamilton.
- Depois do passo 0, a trava continua igual: **qualquer outra** proposta do usuário de teste para a reversão (propostas = 0).
- O passo 0 também pode rodar sozinho, antes da reversão, para a proposta não entrar no relatório enviado em 01/12.
