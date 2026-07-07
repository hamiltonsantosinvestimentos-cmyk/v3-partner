-- ============================================================
-- MIGRATION: Partners de referencia leves (sem conta de login) — Bolsa de Ativos
-- Date: 2026-07-08
-- Scope: nova tabela cm_referral_partners + cm_asset_listings.originator_referral_id
-- Rollback: ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS originator_referral_id;
--           DROP TABLE IF EXISTS cm_referral_partners;
-- ============================================================

CREATE TABLE IF NOT EXISTS cm_referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  contact text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_referral_partners IS 'Registro leve de quem trouxe um ativo para a Mesa, sem conta de login no portal — usado quando o partner de origem nao esta cadastrado como PARTNER/PARTNER_PRO. Critico para rastreio de comissionamento.';

ALTER TABLE cm_referral_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_referral_partners_select ON cm_referral_partners FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

CREATE POLICY cm_referral_partners_insert ON cm_referral_partners FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN','GESTAO','MESA_OPERACIONAL'));

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS originator_referral_id uuid REFERENCES cm_referral_partners(id);

COMMENT ON COLUMN cm_asset_listings.originator_referral_id IS 'Alternativa a originator_profile_id quando quem trouxe o ativo nao tem conta cadastrada no portal — referencia cm_referral_partners.';
