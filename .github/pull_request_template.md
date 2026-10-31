## O que muda
<!-- Uma ou duas frases. Sem dado sensível: detalhes de segurança ficam no BRIEF interno, não aqui. -->

## BRIEF liberado (obrigatório)
- BRIEF: `docs/briefs/AAAA-MM-DD_<assunto>.md`
- QA de governança: LIBERADO (rodadas: N) / override registrado no BRIEF
- Go dado por: <nome> em AAAA-MM-DD
- PR sem link de BRIEF liberado não é mergeado.

## Banco
- [ ] Migration em `supabase/migrations/` com arquivo de reversão (`*_rollback.sql.txt`)
- [ ] Aplicada em produção e conferida contra o arquivo (ou: não aplicada ainda)
- [ ] Sem `grant ... to anon`, sem política `public` com `true`, view nova com `security_invoker` (ou vitrine pública documentada)

## Cartão de merge
- Ação:
- Risco:
- Validado em produção:
- CI: o push aciona e2e contra produção e notifica a equipe

## Fluxograma
- [ ] Seções tocadas atualizadas e data do header
