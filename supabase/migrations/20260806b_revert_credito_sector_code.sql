-- =============================================================================
-- REVERSAO: 'CRED' nao pertence ao dicionario de setores
-- =============================================================================
--
-- CONTEXTO
--   A migration 20260806a renomeou a entrada 'FIN' (Financeiro) para 'CRED'
--   em deal_sector_codes, com a intencao de corrigir a sigla usada pelo deal
--   MTNG-26-AFF01 (v3_code historico V3-2026-05-CRE-001).
--
--   Joao Lemos apontou o equivoco no mesmo dia: 'CRED' ja tem dono. E o
--   prefixo em uso, em producao, para toda a Mesa de Credito (Nacional e
--   Internacional) em credit_desk_proposals.code (formato legado
--   CRED-26-NNNN, ex: CRED-26-096475). deal_sector_codes classifica SETOR
--   ECONOMICO da empresa-alvo de um M&A (Agronegocio, Real Estate, Saude...),
--   um conceito diferente de VERTICAL/MESA de negocio da V3 (M&A, Credito,
--   Consorcio, Bolsa de Ativos). Usar a mesma sigla nos dois dicionarios cria
--   ambiguidade de leitura: um codigo como V3-MA-2026-08-CRED-001 pareceria
--   dizer "operacao da Mesa de Credito" quando na verdade diria apenas "a
--   empresa-alvo deste M&A atua no setor de credito/recebiveis".
--
--   As series de vertical (v3_code_series, Fase 1a) nunca tiveram esse
--   problema: CR (Credito Nacional) e CRI (Credito Internacional) sao os
--   prefixos corretos e permanecem intocados por esta migration.
--
-- O QUE ESTA MIGRATION FAZ
--   Reverte deal_sector_codes ao estado anterior a 20260806a: 'CRED' volta a
--   ser 'FIN' / 'Financeiro'. Mesma linha, PK revertida, nenhuma nova criada.
--
-- SEGURANCA
--   Confirmado antes de reverter: nenhum deal usou 'CRED' como setor no
--   intervalo entre as duas migrations (zero linhas com v3_code contendo
--   -CRED-). Reversao sem perda de dado.
--   Idempotente: se 'CRED' nao existir (ja revertido), a UPDATE nao faz nada.
--
-- PENDENTE, EM ABERTO
--   A pergunta original que motivou 20260805a permanece sem resposta
--   definitiva: qual a sigla de setor correta para uma empresa-alvo de M&A
--   cujo negocio principal e credito/recebiveis (caso do deal Affonso)? 'FIN'
--   deja cobre isso pela descricao ("Precatorios, FIDC, recebiveis,
--   securitizacao"), e nao colide com nenhuma vertical. Fica mantido como
--   FIN ate decisao em contrario.
-- =============================================================================

update public.deal_sector_codes
   set code = 'FIN',
       label = 'Financeiro'
 where code = 'CRED';

comment on table public.deal_sector_codes is
  'Dicionario de SETOR ECONOMICO da empresa-alvo (M&A) ou tomador (credito): Agronegocio, Energia, Financeiro, Geral, Hotelaria, Industrial, Infraestrutura, Logistica, Mineracao, Real Estate, Saude, Tecnologia. NAO confundir com VERTICAL/MESA de negocio da V3 (ver v3_code_series: MA, CR, CRI, CS, BA, PR) -- sao dois dicionarios diferentes, para duas perguntas diferentes: "em que setor a empresa atua" vs "qual mesa da V3 conduz esta operacao". Nunca reutilizar a sigla de uma mesa (MA, CRED, CS, BA, TOK) como codigo de setor.';
