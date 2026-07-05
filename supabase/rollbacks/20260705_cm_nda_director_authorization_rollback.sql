-- ROLLBACK: 20260705_cm_nda_director_authorization.sql

ALTER TABLE cm_asset_listings DROP CONSTRAINT IF EXISTS cm_asset_listings_nda_authorization_status_check;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS nda_authorization_reason;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS nda_authorized_by;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS nda_authorization_requested_at;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS nda_authorization_requested_by;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS nda_authorization_status;
