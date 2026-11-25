# BRIEF: `/api/ma/documents` com acesso por papel e por dono do deal

Data: 24/11/2026 · Pedido: diretoria, prioridade ALTA ("corrigir com prioridade") · Status: QA rodada 3 liberada com override da diretoria; go dado em 24/11/2026

## Problema (verificado no código em 24/11/2026)

`app/api/ma/documents/route.ts` só confere se há login:

- **GET** `?deal_id=` devolve todos os documentos de **qualquer** deal, com link assinado válido por **20 dias**.
- **POST** grava arquivo em **qualquer** deal e, com o mesmo `doc_id`, apaga o arquivo anterior do Storage sem aviso nem log.
- **DELETE** apaga arquivo de **qualquer** deal, sem log.

Qualquer usuário logado (partner de qualquer plano, instituição, comprador) consegue ler, enviar e apagar documentos de deals que não são dele. Contraria a política de sigilo de 31/10/2026. As subrotas `upload-url` e `register` já conferem papel (ADMIN, GESTAO, MESA_OPERACIONAL).

## SCOPE

1. **Função pura** `lib/ma/acesso-documentos.ts` com a regra única (ler, enviar, substituir, excluir, quais documentos devolver) a partir do papel, do deal e do usuário.
2. **GET, POST e DELETE** de `/api/ma/documents` usam essa regra antes de qualquer uso da chave de serviço. Deal inexistente, na Lixeira (`deleted_at` preenchido) ou sem acesso responde igual ao perfil não equipe: 403, sem revelar se o deal existe.
3. **Recorte por documento (duplo cego):** perfil não equipe recebe no GET **só os documentos com `uploaded_by` igual ao próprio usuário**. Documentos enviados pela equipe (NDA, propostas, contrato, closing, due diligence da contraparte) nunca são devolvidos ao partner por esta rota. Abrir documentos da equipe ao partner depois de contratos e mandato assinados e da due diligence liberada fica para BRIEF próprio [VALIDAR COM ROBSON]. Verificado em 24/11/2026: 85 de 86 documentos ativos têm `uploaded_by` com o id do usuário; o único sem id fica visível só para a equipe.
4. **Link assinado** do GET cai de 20 dias para **1 hora**; lista em ordem cronológica decrescente por `uploaded_at`. O mesmo prazo de 1 hora passa a valer em `register/route.ts`, que hoje também emite 20 dias.
5. **Substituição (POST com `doc_id` já existente):** continua apagando o arquivo anterior (não há histórico: o trigger `sync_ma_documents_from_deal` sobrescreve o `storage_path` e um arquivo mantido viraria órfão), agora com `logAuditStrict` aguardado **antes** da remoção (se falhar, 500 e nada é removido), registrando `substituiu_doc_id`, `storage_path` e `bucket` anteriores. **Perfil não equipe não pode enviar com `doc_id` já existente cujo `uploaded_by` seja outro usuário: 409.** Mesmo tratamento de log em `register/route.ts`.
6. **Categoria:** para perfil não equipe, `category` validada no servidor contra a lista de `upload-url` (`CATEGORY_SUBFOLDER`), sem `NDA`, `Contrato` e `Closing` (só a equipe envia esses). Recusa com a mensagem "Categoria <nome> só pode ser enviada pela equipe da V3." (403), para não confundir com falta de acesso ao deal.
7. **Logs:** usa `logAuditStrict` (`lib/audit.ts`, lança erro se não gravar) com `await`, nunca `logAudit` (que engole o erro). No GET (usuário, papel, deal, quantidade de documentos), falha na gravação responde 500 sem links. Na substituição (POST e `register`), falha na gravação responde 500 e o arquivo anterior não é removido. No DELETE, falha na gravação responde 500 e nada é removido.
8. **Tela da Mesa (exclusão):** a lixeira de documentos em `components/mesa-ma/mesa-ma-client.tsx` passa a usar o modal V3 `confirmar()` vermelho (fecha só por botão) com o texto "O arquivo é removido do Storage e não pode ser recuperado."; o item só sai da lista com resposta 200; com 403 aparece "Sem permissão para excluir documentos deste deal."; o botão aparece só para ADMIN, GESTAO e MESA_OPERACIONAL.
9. Testes unitários da regra, com caso positivo e negativo para cada papel.

### Regra de acesso (decisão deste BRIEF)

| Perfil | Ler (GET) | Enviar (POST) | Excluir (DELETE) |
|---|---|---|---|
| ADMIN, GESTAO, MESA_OPERACIONAL (equipe, mesmo conjunto de `ADMIN_ROLES` de `/api/ma-deals`) | Qualquer deal, todos os documentos | Qualquer deal, qualquer categoria | Qualquer deal |
| Qualquer outro papel (MESA, partners de todos os planos, ENTERPRISE, instituição e demais) | Só deal ativo em que é `assigned_to` ou `created_by` (mesma regra de `/api/ma-deals`), e só os documentos que ele próprio enviou | Idem, sem NDA/Contrato/Closing; 409 ao tentar substituir documento de outro usuário | **Nunca** (403) |
| Anônimo | 401 | 401 | 401 |

**Depois de transferência do deal:** o `created_by` original continua passando na regra de dono, mas, pelo recorte do item 3, vê só os documentos que ele mesmo enviou. Nada do que o novo responsável ou a equipe enviar chega a ele. Mantido assim para não apagar o acesso do partner aos próprios arquivos; a revisão de dono por `originator_profile_id` fica para o BRIEF das transferências.

Os documentos comerciais do pedido de commodity continuam fora desta rota (rota própria, bloco A).

## Camada do banco (verificada em 24/11/2026)

- `storage.buckets`: `ma-documents` com `public = false`; `v3-docs-publico` com `public = false`.
- `storage.objects`: nenhuma política cita `ma-documents` (só a chave de serviço acessa). Para `v3-docs-publico` existem `admin_full_storage` (só ADMIN) e `granted_read_storage` / `granted_write_storage` (só quem tem concessão explícita em `folder_access_grants`, com validade). Nenhuma política para anon ou authenticated em geral.
- **Achado (24/11/2026): concessões ativas e não vencidas em `folder_access_grants` por papel:** ADMIN 26, MESA_OPERACIONAL 3, **PARTNER_PRO 38, STARTER 11, DIAMANTE 7, GOLD 1 (N = 57 para papéis externos)**. Pelas políticas `granted_read_storage` e `granted_write_storage`, esses partners leem (e, com permissão de escrita, gravam) arquivos das pastas concedidas direto no Storage, por fora de qualquer rota e sem recorte. Contraria a regra 1 da política de sigilo. **Não revogado neste pacote:** as concessões podem sustentar a Pasta Pública do partner e a revogação sem substituto quebraria esse acesso. Registrado no Roadmap como ALTA, prazo 01/12/2026, BRIEF próprio (trocar o acesso direto por rota da V3 com recorte e revogar as concessões externas) [VALIDAR COM ROBSON]. Esta correção de `/api/ma/documents` não depende dele e não piora nada. **Medição por pasta e permissão (24/11/2026), papéis externos:** Credito 44 com permissão `admin`; MA 8 `admin`, 1 `write`, 1 `read`; Consorcios 2 `admin`; BolsaDeAtivos 1 `admin`. Ou seja, 56 das 57 concessões externas permitem gravar direto no Storage, inclusive em 9 pastas de deal de M&A: prazo do BRIEF próprio antecipado para 27/11/2026.
- `ma_deals` (`pg_policies`): `ma_select` só ADMIN, GESTAO, MESA_OPERACIONAL e FINANCEIRO; `ma_insert` só equipe; `ma_update` só ADMIN, GESTAO e MESA_OPERACIONAL no próprio deal; `ma_delete_admin` só ADMIN. Nenhuma política para perfil externo (conforme 20261031a).

## IMPACT

- Arquivos: `app/api/ma/documents/route.ts`, `app/api/ma/documents/register/route.ts` (prazo do link e log da substituição), `lib/ma/acesso-documentos.ts` (novo), `components/mesa-ma/mesa-ma-client.tsx` (lixeira com confirmação), `tests/unit/ma-acesso-documentos.test.ts` (novo).
- Tabelas: `ma_deals` (leitura de `assigned_to`, `created_by`, `deleted_at`, `documents`). Sem migration.
- Consumidores conferidos: `components/mesa-ma/mesa-ma-client.tsx` (equipe), `components/ma/ma-client.tsx` e `components/ma/novo-deal-form.tsx` (partner, nos próprios deals, envio não afetado), `components/ma/forja-panel.tsx` e `components/ma/validacao-documental-panel.tsx` (leitura).
- Testes e2e que chamam a rota: `tests/e2e/duplicate-upload.spec.ts`, `happy-path.spec.ts`, `unlinked-upload.spec.ts`. A conta do CI é ADMIN (conferido em 24/11/2026): continua com acesso total, sem resíduo novo.
- APIs externas: nenhuma.

## UX: onde o usuário vê isso

- **Ponto de acesso:** nenhuma tela nova. Muda o que as telas atuais recebem (aba de documentos do deal na Mesa M&A, página `/ma` do partner, Novo Deal, FORJA e Validação documental) e a lixeira de documentos da Mesa ganha confirmação.
- **Estado vazio:** igual ao atual. Quem não tem acesso recebe "Sem permissão para os documentos deste deal." em vez da lista.

## DEPENDENCIES

- Deve existir antes: nada.
- Migrations pendentes: nenhuma.

## RISKS

- **Breaking changes:** sim, de propósito para quem acessava deal alheio. Regressões possíveis: (a) papel MESA passa a ver documentos só dos deals atribuídos a ele, só os que ele enviou, sem NDA, Contrato e Closing, e nunca exclui (hoje ele envia pelo POST de fallback da Mesa, porque `upload-url` e `register` já o excluem); a confirmar com a diretoria se é o comportamento desejado para MESA; (b) partner deixa de ver na tela `/ma` documentos que a equipe subiu no deal dele (intencional, duplo cego); (c) link guardado por mais de 1 hora deixa de abrir.
- **LGPD/Compliance:** reduz exposição. ⚠️ ROBSON: exposição histórica. Levantamento feito em 24/11/2026: a rota usava a chave de serviço e não gravava log por usuário; os logs de execução da Vercel estão em outra conta do time, fora do acesso desta sessão. **Não há como afirmar nem negar acesso indevido no passado.** Links de 20 dias emitidos até hoje continuam válidos até expirar (invalidação possível movendo o objeto no Storage, a avaliar com o Robson nos deals mais sensíveis). **Override necessário:** como a correção só reduz exposição, a diretoria registra aqui o override para aplicar antes da resposta do Robson, que recebe o pedido de ciência em seguida (registro em `06_Operacional/SOPs/`). Override: [x] diretoria, data 24/11/2026 ("override go" registrado), aceitando aplicar antes da resposta do Robson: (1) a exposição histórica dos links de 20 dias e (2) as 57 concessões externas ativas em `folder_access_grants`, que seguem com acesso direto ao `v3-docs-publico` até o BRIEF próprio (prazo 01/12/2026).
- **Performance:** uma leitura a mais do perfil e um `logAuditStrict` por chamada.
- **Vercel timeout:** não há chamada a modelo de IA.
- **CI:** um push por vez, esperando o CI da `main`.

## APPROACH

- **Escolhida:** regra única em função pura, aplicada nos três métodos e no `register`, com dono igual ao de `/api/ma-deals` e recorte por `uploaded_by`. Fecha deal alheio, fecha documentos da equipe ao partner e mantém o envio que o partner já faz.
- **Descartada:** dono por `originator_profile_id`. Mais correto, mas quebraria o fluxo do partner que recebeu o deal por transferência sem a decisão de produto correspondente.
- **Descartada:** só equipe. Quebraria o envio pelo partner no Novo Deal e em `/ma`.
- **Descartada:** manter o arquivo anterior na substituição. Sem histórico no banco, viraria arquivo órfão e não removível.

## ESTIMATE

- Complexidade: S/M
- Esforço: 3 a 4 horas com teste em produção
- Confiança: Alta

## Teste antes de declarar pronto

1. Unitário: matriz da tabela (equipe; MESA dono e não dono; partner dono e não dono; perfil externo equivalente, instituição ou ENTERPRISE; deal na Lixeira; papel nulo), recorte por `uploaded_by`, 409 na substituição de documento alheio, categoria proibida ao partner.
2. Produção, com deal ZZTEST criado pela conta ADMIN: GET, POST, substituição e DELETE pela conta ADMIN (200), com `logAuditStrict` gravado em cada um (conferir as linhas em `audit_logs`).
3. Produção, com as contas de partner autorizadas pelo João (identificadas no registro interno, login feito pela própria diretoria): no ZZTEST alheio, GET, POST e DELETE recebem 403; no deal em que é dono, GET devolve só o que ele enviou e POST continua 200; DELETE 403.
4. Leitura direta como anônimo, como partner e como perfil externo equivalente (instituição ou ENTERPRISE; sem conta real, em ensaio por transação desfeita com `set local role authenticated` e as claims de um perfil desse papel): `select` em `ma_deals` e list/download em `ma-documents`, todos negados. Em `v3-docs-publico`, ver o achado das concessões abaixo.
5. Anônimo: 401 ou redirecionamento ao login nos três métodos.
6. Link do GET com validade de 1 hora (parâmetro do link).
7. Lixeira da Mesa: modal vermelho, item só sai com 200.
8. Limpeza do ZZTEST (deal, arquivos, lead da ponte CRM, avisos) com resíduo 0.

## QA de governança

Rodada 1: BLOQUEADO (7 falhas: 7.3 recorte por documento, 7.1/7.6 Lixeira, 7.2 log, 7.5 camada do banco e testes, 7.5 substituição, 3.3 exclusão sem confirmação, exposição histórica do Robson). Corrigidas nesta versão; sugestões acolhidas (register, e2e, ordem, categoria). Rodada 2: BLOQUEADO (4: `logAuditStrict`, perfil externo na leitura direta, concessões de `folder_access_grants`, override da diretoria). Três corrigidas nesta versão; o override depende do João. Rodada 3: BLOQUEADO só pelo override da diretoria (cobrindo exposição histórica e as 57 concessões); conteúdo técnico liberado. Ajustes editoriais aplicados depois da rodada 3 (cabeçalho, `logAuditStrict` em Performance, medição das concessões).

---
Aguardando aprovação: "go", "ajusta: [instrução]" ou "cancela".
