-- ============================================================
-- MIGRATION: Checklist de documentos nomeados + valores_ocr (Bolsa de Ativos)
-- Date: 2026-07-05
-- Scope: cm_listing_documents.checklist_item_id + cm_asset_listings.valores_ocr + trigger de sync
-- Ja aplicada em producao via mcp__plugin_supabase_supabase__apply_migration
-- ============================================================

-- BRIEF D: checklist de documentos nomeados (slot de origem do upload)
ALTER TABLE cm_listing_documents ADD COLUMN IF NOT EXISTS checklist_item_id text;

-- BRIEF E: historico de valores extraidos via OCR, separado do valor negociado manualmente
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS valores_ocr jsonb;

CREATE OR REPLACE FUNCTION sync_cm_valores_ocr()
RETURNS TRIGGER AS $$
DECLARE
  extracted jsonb;
  field_key text;
  field_val jsonb;
  entry jsonb;
  current_ocr jsonb;
BEGIN
  IF NEW.ocr_result IS NULL THEN
    RETURN NEW;
  END IF;

  extracted := NEW.ocr_result -> 'dados_extraidos';
  IF extracted IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT valores_ocr INTO current_ocr FROM cm_asset_listings WHERE id = NEW.listing_id;
  IF current_ocr IS NULL THEN
    current_ocr := '{}'::jsonb;
  END IF;

  FOREACH field_key IN ARRAY ARRAY['valor_face','valor_atualizado'] LOOP
    field_val := extracted -> field_key;
    IF field_val IS NOT NULL AND jsonb_typeof(field_val) = 'number' THEN
      entry := jsonb_build_object(
        'valor', field_val,
        'doc_id', NEW.id,
        'documento', NEW.original_filename,
        'confiabilidade', NEW.ocr_result -> 'confiabilidade',
        'extracted_at', now()
      );
      current_ocr := jsonb_set(
        current_ocr,
        ARRAY[field_key],
        COALESCE(current_ocr -> field_key, '[]'::jsonb) || jsonb_build_array(entry),
        true
      );
    END IF;
  END LOOP;

  UPDATE cm_asset_listings SET valores_ocr = current_ocr WHERE id = NEW.listing_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_cm_valores_ocr ON cm_listing_documents;
CREATE TRIGGER trg_sync_cm_valores_ocr
  AFTER INSERT OR UPDATE OF ocr_result ON cm_listing_documents
  FOR EACH ROW EXECUTE FUNCTION sync_cm_valores_ocr();

COMMENT ON COLUMN cm_asset_listings.valores_ocr IS 'Historico de valores extraidos via OCR por campo financeiro (valor_face, valor_atualizado), populado automaticamente via trigger. Nunca e a fonte de verdade — o valor negociado (colunas escalares valor_face/valor_atualizado) so muda por acao manual da Mesa.';
COMMENT ON COLUMN cm_listing_documents.checklist_item_id IS 'ID do slot nomeado do checklist obrigatorio (lib/cm-checklists.ts) que este documento preenche. Null = upload legado sem slot definido.';
