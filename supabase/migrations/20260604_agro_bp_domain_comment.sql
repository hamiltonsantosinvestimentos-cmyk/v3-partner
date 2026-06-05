-- Migration: agro_bp_domain_comment
-- Documenta o schema AGR dentro de asset_data.financial_projections em ma_deals.
-- Nenhum DDL de coluna nova. asset_data JSONB já existe.
-- O campo sector = 'agropecuaria' / 'Agropecuária' determina qual domain model usar.
--
-- Domain model REA (existente):
--   financial_projections: { noi_anual, cap_rate, vacancia_pct, valor_laudo, ... }
--
-- Domain model AGR (novo — MA-26-013 NELBLUE DA IMPÉRIO):
--   financial_projections: {
--     fase_1_mvp:       { custo_embriao_brl, custo_dose_semen_brl, custo_iatf_brl,
--                         custo_igg_select_brl, custo_te_brl, opex_central_genetica_brl,
--                         volume_embrioes_ano, preco_venda_embriao_brl, preco_venda_dose_brl },
--     fase_2_contratos: { custo_spe_juridico, custo_cvm88_estruturacao,
--                         custo_assessoria_legal_mes, receita_contrato_futuro_estimada },
--     fase_3_exportacao:{ custo_gacc, custo_halal, custo_quarentena_cabeca,
--                         frete_medio_cabeca_usd, volume_cabecas_ano,
--                         preco_arroba_brl, rendimento_carcaca_pct },
--     scenarios:        { base, otimista, conservador } each: { receita_total, custo_total, ebitda, margem_pct },
--     fluxo_caixa_12m:  [{ mes, receita, custo, saldo }],
--     break_even:       { fase_1_meses, fase_2_meses, fase_3_meses },
--     comparativo_igg:  { igg_custo, citometria_custo, economia_pct },
--     meta:             { last_updated, updated_by }
--   }

COMMENT ON TABLE ma_deals IS
'Deals M&A V3 Partners. O campo asset_data JSONB suporta múltiplos domain models
de financial_projections por setor: REA (cap_rate, noi_anual, vacancia_pct) e
AGR (fase_1_mvp, fase_2_contratos, fase_3_exportacao, scenarios, fluxo_caixa_12m,
break_even, comparativo_igg, meta). O campo sector determina qual model está em uso.
Acesso ao módulo Business Plan: ADMIN + GESTAO (edição), MESA_OPERACIONAL (leitura).
Deal Room externo (seller/intermediario/buyer) via deal_room_invites.';
