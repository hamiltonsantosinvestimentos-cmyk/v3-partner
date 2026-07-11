-- ============================================================
-- MIGRATION: Checklists Operacionais reais para a classe "imovel"
-- Date: 2026-07-11
-- Scope: Fase 3 da Bolsa de Grandes Ativos Imobiliarios e Alternativos.
--        create_cm_checklist gerava sempre os mesmos itens (pensados para
--        credito/precatorio) independente do asset_type do listing. Passa a
--        olhar o asset_type real e usar a lista certa para imoveis; demais
--        tipos permanecem com os itens originais, inalterados (testado).
--        Aplicada em producao via mcp__plugin_supabase_supabase__apply_migration.
-- Rollback: recriar a funcao com o corpo anterior — ver
--           20260624_cm_order_book_mvp.sql secao 8 (create_cm_checklist original).
-- ============================================================

CREATE OR REPLACE FUNCTION create_cm_checklist(
  p_listing_id uuid,
  p_bid_id uuid DEFAULT NULL,
  p_type text DEFAULT 'pre_fechamento'
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_checklist_id uuid;
  v_items jsonb;
  v_asset_type cm_asset_type;
BEGIN
  SELECT asset_type INTO v_asset_type FROM cm_asset_listings WHERE id = p_listing_id;

  INSERT INTO cm_operation_checklists (listing_id, bid_id, checklist_type)
  VALUES (p_listing_id, p_bid_id, p_type)
  RETURNING id INTO v_checklist_id;

  IF v_asset_type = 'imovel' THEN
    v_items := CASE p_type
      WHEN 'pre_aceite' THEN '[
        {"key":"laudo_vistoria","label":"Laudo de vistoria inicial","sort":1},
        {"key":"cnds","label":"Certidoes Negativas (CNDs) verificadas","sort":2},
        {"key":"titularidade","label":"Comprovacao de titularidade/propriedade","sort":3},
        {"key":"pld_corporativo","label":"PLD corporativo do cedente OK","sort":4},
        {"key":"mandato_v3_exclusividade","label":"Mandato V3 com exclusividade assinado","sort":5}
      ]'::jsonb
      WHEN 'pre_fechamento' THEN '[
        {"key":"aporte_escrow","label":"Comprovante de aporte na Conta Escrow V3","sort":1},
        {"key":"loi_mou_validada","label":"LOI/MOU do comprador validada","sort":2},
        {"key":"minutas_contratuais","label":"Minutas contratuais emitidas pela Central de Contratos","sort":3}
      ]'::jsonb
      WHEN 'pos_cessao' THEN '[
        {"key":"escritura_averbacao","label":"Escritura publica ou averbacao registrada em orgao competente","sort":1},
        {"key":"liberacao_escrow","label":"Liberacao assistida dos fundos da Escrow","sort":2},
        {"key":"repasse_intermediarios","label":"Contrato de repasse da cadeia de intermediarios executado (Anexo FPA/NCND)","sort":3},
        {"key":"faturamento_estruturacao","label":"Faturamento das taxas de estruturacao V3","sort":4}
      ]'::jsonb
    END;
  ELSE
    v_items := CASE p_type
      WHEN 'pre_aceite' THEN '[
        {"key":"proof_of_funds","label":"Prova de fundos verificada","sort":1},
        {"key":"kyc_pld","label":"KYC/PLD do comprador OK","sort":2},
        {"key":"valor_compativel","label":"Valor compativel com floor","sort":3},
        {"key":"mandato_v3","label":"Mandato V3 assinado","sort":4},
        {"key":"conflito_interesse","label":"Conflito de interesse verificado","sort":5}
      ]'::jsonb
      WHEN 'pre_fechamento' THEN '[
        {"key":"loi_assinada","label":"LOI assinada (comprador)","sort":1},
        {"key":"contrato_cessao","label":"Contrato de cessao minutado","sort":2},
        {"key":"procuracao_cedente","label":"Procuracao do cedente OK","sort":3},
        {"key":"cnds_atualizadas","label":"CNDs do cedente atualizadas","sort":4},
        {"key":"escritorio_notificado","label":"Escritorio vendedor notificado","sort":5},
        {"key":"comissao_definida","label":"Comissao V3 definida e aceita","sort":6},
        {"key":"forma_pagamento","label":"Forma de pagamento acordada","sort":7},
        {"key":"escrow_definida","label":"Escrow account definida (se aplicavel)","sort":8}
      ]'::jsonb
      WHEN 'pos_cessao' THEN '[
        {"key":"cartorio","label":"Contrato registrado em cartorio","sort":1},
        {"key":"intimacao","label":"Intimacao judicial realizada (protocolo)","sort":2},
        {"key":"ente_notificado","label":"Ente devedor notificado","sort":3},
        {"key":"averbacao","label":"Cessao averbada no processo","sort":4},
        {"key":"comissao_paga","label":"Comissao V3 paga","sort":5},
        {"key":"credito_transferido","label":"Credito transferido no tribunal","sort":6}
      ]'::jsonb
    END;
  END IF;

  INSERT INTO cm_checklist_items (checklist_id, item_key, label, sort_order)
  SELECT v_checklist_id, elem->>'key', elem->>'label', (elem->>'sort')::int
  FROM jsonb_array_elements(v_items) AS elem;

  RETURN v_checklist_id;
END;
$$;
