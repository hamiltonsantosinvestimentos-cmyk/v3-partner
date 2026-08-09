-- =============================================================================
-- CORRECAO: abreviacao de Credito no dicionario de setores
-- =============================================================================
--
-- CONTEXTO
--   O deal MTNG-26-AFF01 ("Securitizacao Affonso, Judiciais + Expansao
--   Industrial", setor em texto livre "Credito / Recebiveis") tem
--   v3_code = V3-2026-05-CRE-001. A sigla CRE nunca existiu em
--   deal_sector_codes: foi emitida pelo gerador antigo, anterior a governanca
--   de numeracao de 05/08/2026, sem validacao contra o dicionario. Joao Lemos
--   pediu correcao em 06/08/2026: a abreviacao de credito deve ser CRED.
--
--   Investigacao antes de corrigir (nunca assumir): o dicionario ja tinha uma
--   entrada 'FIN' / 'Financeiro' cuja descricao e "Precatorios, FIDC,
--   recebiveis, securitizacao" — exatamente o negocio do deal Affonso e a
--   propria definicao de credito. Criar 'CRED' como entrada nova ao lado de
--   'FIN' reproduziria a mesma ambiguidade que a governanca de numeracao
--   existe para eliminar: dois codigos validos description igual, proximo
--   operador escolhe no chute.
--
--   Verificado: nenhum deal usa FIN hoje (nenhum v3_code com -FIN-), nenhuma
--   linha de codigo do portal referencia a sigla FIN. Renomear tem impacto
--   zero em dado existente.
--
-- O QUE ESTA MIGRATION FAZ
--   Renomeia a entrada 'FIN' para 'CRED' no dicionario, com label 'Credito'.
--   A descricao (que ja era a definicao correta de credito) permanece.
--   Nao cria linha nova: e a MESMA linha, PK atualizada.
--
--   O v3_code ja emitido do deal Affonso (V3-2026-05-CRE-001) permanece
--   INTOCADO, por decisao de 05/08/2026 de congelar o historico anterior a
--   governanca. So o dicionario muda; codigo ja emitido nunca e reescrito.
--
-- SEGURANCA
--   Sem FK apontando para deal_sector_codes.code hoje (Fase 2a do plano de
--   numeracao, que cria essa FK em credit_desk_proposals, ainda nao foi
--   aplicada). Rename de PK sem dependente e seguro.
--   Idempotente: se ja rodou, o segundo run nao encontra 'FIN' e nao faz nada.
-- =============================================================================

update public.deal_sector_codes
   set code = 'CRED',
       label = 'Crédito'
 where code = 'FIN';

comment on table public.deal_sector_codes is
  'Dicionario de setores para classificacao de deals M&A e demais operacoes V3. CRED (antes FIN) cobre credito, recebiveis, FIDC, precatorios e securitizacao. Fonte unica: nunca criar entrada nova sem antes verificar sobreposicao com as existentes.';
