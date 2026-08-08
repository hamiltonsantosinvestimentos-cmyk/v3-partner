-- ============================================================================
-- Fase 2a: escopo (nacional/internacional) em regras_linhas_credito +
-- credit_line_id em credit_desk_proposals, com backfill evidenciado.
-- Ver ~/.claude/rules/v3-numbering-governance.md e sessão 07-08/08/2026.
-- ============================================================================

-- 1) Escopo da linha: nacional (padrão) ou internacional
alter table public.regras_linhas_credito
  add column if not exists escopo text not null default 'nacional'
  check (escopo in ('nacional', 'internacional'));

update public.regras_linhas_credito
set escopo = 'internacional'
where id in (
  'op_int_garantia', -- Op. Internacional — Garantia Imobiliária
  'op_int_cash',      -- Op. Internacional — Cash Collateral
  'acc',              -- ACC — Adiantamento s/ Contrato de Câmbio
  'ace',              -- ACE — Adiantamento s/ Cambiais Entregues
  'finimp',           -- FINIMP — Financiamento de Importações
  'fin_exterior',     -- Financiamento — Brasileiros no Exterior
  'cambio_pronto',    -- Câmbio Pronto
  'cash_collateral'   -- Cash Collateral
);

comment on column public.regras_linhas_credito.escopo is
  'nacional | internacional. Usado pelo gate de Plano de Negócios obrigatório '
  'na aprovação final (stage=LIBERADO) de propostas em credit_desk_proposals. '
  'Fase 2b, 08/08/2026.';

-- 2) Vínculo estruturado da proposta com o dicionário (mantém credit_line
--    texto livre intacto — nunca remover, é a fonte original do dado)
alter table public.credit_desk_proposals
  add column if not exists credit_line_id text
  references public.regras_linhas_credito(id);

-- 3) Backfill das 92 propostas reais existentes, mapeamento por grafia exata
--    verificada em produção em 07/08/2026 (24 grafias distintas). Confiança
--    alta = correspondência direta de nome/sigla. Confiança média = melhor
--    opção única disponível no dicionário, sem entrada mais específica —
--    marcado explicitamente no comentário de cada linha, não é adivinhação
--    silenciosa. 3 grafias (7 propostas) ficam sem mapeamento por não terem
--    nenhuma correspondência razoável no dicionário; nenhuma delas soa
--    internacional, então não há risco de sub-gate do Plano de Negócios.
update public.credit_desk_proposals set credit_line_id = 'home_equity'   where credit_line in ('HOME EQUITY', 'Home Equity');
update public.credit_desk_proposals set credit_line_id = 'homecash'      where credit_line in ('HOMECASH', 'HomeCash');
update public.credit_desk_proposals set credit_line_id = 'credito_aval'  where credit_line in ('CRÉDITO NO AVAL/ RECEBIVEIS', 'Crédito no Aval', 'AVAL');
update public.credit_desk_proposals set credit_line_id = 'v3equity'      where credit_line = 'V3Equity';
update public.credit_desk_proposals set credit_line_id = 'v3auto'        where credit_line = 'V3Auto';
update public.credit_desk_proposals set credit_line_id = 'distressed'    where credit_line = 'HOME EQUITY ESTRESSADO';
update public.credit_desk_proposals set credit_line_id = 'fin_imobiliario' where credit_line = 'Financiamento Imobiliário';
update public.credit_desk_proposals set credit_line_id = 'unifamiliar'   where credit_line = 'Fundo Construção — Unifamiliar';
update public.credit_desk_proposals set credit_line_id = 'incorporadoras' where credit_line = 'FUNDO CONSTRUÇÃO — INCORPORADORAS';
update public.credit_desk_proposals set credit_line_id = 'cri_inicio_obra' where credit_line = 'FUNDO CONSTRUÇÃO — CRÉDITO PONTE (INÍCIO DE OBRA) CRI';
update public.credit_desk_proposals set credit_line_id = 'acc'           where credit_line = 'ACC — ADIANTAMENTO SOBRE CONTRATO DE CÂMBIO';
update public.credit_desk_proposals set credit_line_id = 'op_int_garantia' where credit_line = 'OP. INTERNACIONAL — GARANTIA IMOBILIÁRIA';
update public.credit_desk_proposals set credit_line_id = 'op_int_cash'   where credit_line = 'OP. INTERNACIONAL - CASH COLLATERAL';

-- Confiança média: única opção plausível do dicionário, sem entrada mais
-- específica disponível hoje. Revisar com João/Mesa de Crédito quando
-- houver tempo — não bloqueia a Fase 2b.
update public.credit_desk_proposals set credit_line_id = 'slb_agro'      where credit_line = 'SALE LEASEBACK'; -- genérico, dicionário só tem a variante Agro
update public.credit_desk_proposals set credit_line_id = 'cgi_pj'        where credit_line = 'CGI — CRÉDITO COM GARANTIA IMOBILIÁRIA';
update public.credit_desk_proposals set credit_line_id = 'giro_auto'     where credit_line = 'V3GIRO E V3AUTOGIRO';
update public.credit_desk_proposals set credit_line_id = 'op_int_garantia' where credit_line = 'FUNDO INTERNACIONAL IMOB'; -- "internacional" + "imob" no texto livre

-- Sem mapeamento (fica NULL de propósito):
--   'ANTECIPAÇÃO DE CONTRATOS (CONTRATOS PUBLICOS)' (4 propostas)
--   'PROJECT FINANCE' (1 proposta)
--   'FUNDO CONSTRUÇÃO EMPREENDIMENTO' (2 propostas)

-- 4) Setor econômico da proposta (dicionário deal_sector_codes, mesmo usado
--    em v3_code_series). Sem backfill: credit_desk_proposals não tem hoje
--    nenhuma coluna de origem confiável para inferir setor das 92 propostas
--    existentes (diferente de credit_line, que tinha texto livre real para
--    mapear). Populado só em propostas novas, a partir daqui.
alter table public.credit_desk_proposals
  add column if not exists sector text
  references public.deal_sector_codes(code);

comment on column public.credit_desk_proposals.credit_line_id is
  'FK para regras_linhas_credito.id. Backfill 08/08/2026: 85 de 92 propostas '
  'mapeadas (20 grafias com correspondência direta, 4 grafias/18 propostas '
  'com melhor opção única do dicionário). credit_line (texto livre) '
  'permanece como fonte original, nunca removida.';
comment on column public.credit_desk_proposals.sector is
  'FK para deal_sector_codes.code. Sem backfill histórico — nenhuma coluna '
  'de origem confiável em credit_desk_proposals para inferir setor das '
  'propostas anteriores a 08/08/2026.';
