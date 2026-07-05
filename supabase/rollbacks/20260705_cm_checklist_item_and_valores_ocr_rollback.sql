-- ROLLBACK: 20260705_cm_checklist_item_and_valores_ocr.sql

DROP TRIGGER IF EXISTS trg_sync_cm_valores_ocr ON cm_listing_documents;
DROP FUNCTION IF EXISTS sync_cm_valores_ocr();
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS valores_ocr;
ALTER TABLE cm_listing_documents DROP COLUMN IF EXISTS checklist_item_id;
