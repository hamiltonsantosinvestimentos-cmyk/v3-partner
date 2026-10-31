# BRIEF: <nome da funcionalidade ou tarefa>

> Data: AAAA-MM-DD | Autor: <quem escreveu> | Status: RASCUNHO / EM QA / LIBERADO / GO DADO
> Salvar em `docs/briefs/AAAA-MM-DD_<assunto>.md` e commitar junto com o código.

## SCOPE
O que será criado ou modificado, em uma ou duas frases.

## IMPACT
- Arquivos afetados:
- Tabelas afetadas:
- Rotas afetadas:
- APIs e integrações afetadas:

## UX: ONDE O USUÁRIO VÊ ISSO
- Ponto de acesso (tela e elemento exato, nunca "vai ter uma UI depois"):
- Estado vazio:
- Sem UI? (se for só backend, cron ou webhook, justificar):
- Nota do porquê (tooltip) em campo, consulta ou aceite novo:

## DEPENDENCIES
- Deve existir antes:
- Migrations pendentes:

## RISKS (nunca "nenhum")
- Breaking changes:
- LGPD e compliance:
- Segurança de acesso ao banco (anon, RLS, views, funções):
- Performance:
- Outro:

## APPROACH
- Abordagem escolhida e por quê:
- Alternativa descartada e por quê:

## DESENHO TÉCNICO
SQL da migration (arquivo antes de aplicar), SQL de reversão, rotas, regras de role. Toda migration: `IF EXISTS` / `IF NOT EXISTS`, coluna nova nullable, `SECURITY DEFINER` sempre com `SET search_path = public`, e código de operação ou contrato sempre por `next_v3_code()`.

## PLANO DE TESTE
Casos, perfis de teste usados (nunca partner real), e o que não é testável.

## ESTIMATE
Complexidade (S / M / L / XL), esforço, confiança.

## PARECER DE COMPLIANCE
Quando houver dado pessoal, regulação ou exposição de dados. Registrar: data, quem respondeu, texto da resposta, onde o texto literal está arquivado. Sem isso, o campo diz "N/A, sem dado pessoal" e o motivo.

---

## RELATÓRIO DO QA DE GOVERNANÇA
Rodada N de 6. Colar o relatório do `@v3-governance-qa` (PASSOU, FALHOU, SUGESTÃO, NÃO SE APLICA, VEREDITO).

## REGISTRO DE LIBERAÇÃO
- QA: LIBERADO / BLOQUEADO (rodadas: N)
- Override ("go mesmo assim"): não / sim, com as falhas aceitas listadas aqui:
- Go dado por: <João ou Hamilton>, em AAAA-MM-DD HH:MM (registrado pelo hook em `.claude/brief-release/go-log.jsonl`)
- Migration aplicada em produção: não / sim, em AAAA-MM-DD, arquivo `supabase/migrations/<nome>.sql`, segundo go de <nome>

> Aguardando aprovação. Digite "go" para iniciar, "ajusta: <instrução>" para modificar, "cancela" para abortar.
