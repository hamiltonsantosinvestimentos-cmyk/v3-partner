-- ============================================================
-- MIGRATION: Esteira de Qualificacao de Partes (Fase 2B) — Bolsa de Capitais
-- Date: 2026-07-28
-- Scope: coleta publica e individual de dados de qualificacao (CPF/CNPJ, RG,
--        endereco, dados bancarios, chave PIX) de cada envolvido em uma
--        operacao (parte principal, intermediarios finder, mandatario,
--        testemunha), antes da geracao do instrumento juridico (NDA
--        Quadripartite / FPA Venda / FPA Compra / Contrato Final).
--
-- ⚠️ ROBSON — LGPD: esta migration cria a PRIMEIRA coleta de RG e dados
-- bancarios/chave PIX de terceiros (intermediarios) em todo o portal V3 —
-- nenhum fluxo existente coletava esses dois campos ate hoje. Mesma classe
-- de dado sensivel do Credit Intelligence Engine e do Track B (CPF/CNPJ de
-- pessoa fisica), que exigiram sign-off formal de Robson Lino antes de
-- produção real. Este codigo pode ser deployado, mas NAO deve coletar dado
-- real de terceiro em producao antes desse sign-off existir.
--
-- Rollback:
--   DROP TABLE IF EXISTS cm_party_qualifications;
--   DROP TABLE IF EXISTS cm_qualification_batches;
-- ============================================================

-- ════════════════════════════════════════════════════
-- 1. TABLE: cm_qualification_batches
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_qualification_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES cm_asset_listings(id) ON DELETE CASCADE,
  match_deal_id text,
  document_type text NOT NULL CHECK (document_type IN ('nda_quadripartite', 'fpa_venda', 'fpa_compra', 'mandato', 'contrato_final')),
  status text NOT NULL DEFAULT 'coletando' CHECK (status IN ('coletando', 'completo')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

COMMENT ON TABLE cm_qualification_batches IS 'Um lote de qualificacao = um instrumento juridico a gerar (NDA Quadripartite, FPA Venda/Compra, Contrato Final), agrupando N envolvidos que precisam se qualificar antes do documento ser gerado e enviado para assinatura em lote.';
COMMENT ON COLUMN cm_qualification_batches.match_deal_id IS 'Referencia opcional ao codigo legivel da operacao (cm_bids.match_deal_id), quando o lote ja nasce vinculado a um match aceito.';

CREATE INDEX IF NOT EXISTS idx_cm_qual_batches_listing ON cm_qualification_batches(listing_id);

ALTER TABLE cm_qualification_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_qual_batches_select ON cm_qualification_batches FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_qual_batches_insert ON cm_qualification_batches FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_qual_batches_update ON cm_qualification_batches FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- ════════════════════════════════════════════════════
-- 2. TABLE: cm_party_qualifications
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cm_party_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES cm_qualification_batches(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role_in_document text NOT NULL CHECK (role_in_document IN ('parte_principal', 'intermediario_finder_venda', 'intermediario_finder_compra', 'mandatario', 'testemunha')),
  qualification_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'preenchido')),
  cpf_cnpj text,
  rg text,
  endereco_completo text,
  dados_bancarios jsonb,
  pix_key text,
  filled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cm_party_qualifications IS 'Dado de qualificacao individual de cada envolvido de um cm_qualification_batches. CPF/CNPJ, RG, endereco e dados bancarios/PIX sao dado pessoal sensivel — ver aviso LGPD no topo do arquivo.';
COMMENT ON COLUMN cm_party_qualifications.dados_bancarios IS 'JSONB: {banco, agencia, conta, tipo_conta}. Usado para repasse de comissao ao intermediario/mandatario.';

CREATE INDEX IF NOT EXISTS idx_cm_party_qual_batch ON cm_party_qualifications(batch_id);

ALTER TABLE cm_party_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_party_qual_select ON cm_party_qualifications FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY cm_party_qual_insert ON cm_party_qualifications FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- Sem policy de UPDATE para 'authenticated': o preenchimento publico (POST
-- /api/cm/qualificacao/[token]) roda com a service role key no servidor,
-- que ignora RLS — mesmo padrao de todo outro fluxo de intake publico neste
-- projeto (loi-intake, fpa-venda-intake, deal-intermediaries/fill, etc.).

-- ════════════════════════════════════════════════════
-- 3. VINCULO COM A CENTRAL DE CONTRATOS (padronizacao via template)
-- ════════════════════════════════════════════════════
-- Decisao (2026-07-28, Joao): o documento final (NDA Quadripartite, FPA
-- Venda/Compra, Contrato Final) deve ser gerado pela Central de Contratos
-- (app/api/contracts/generate) usando um template real cadastrado por
-- Dr. Luis Athaydes em contract_templates — nao por upload manual de PDF.
-- Esta coluna amarra o contrato gerado ao lote que forneceu os dados das
-- partes, para app/api/contracts/generate poder puxar cm_party_qualifications
-- automaticamente quando qualification_batch_id for informado.

ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS qualification_batch_id uuid REFERENCES cm_qualification_batches(id);
COMMENT ON COLUMN operation_contracts.qualification_batch_id IS 'Lote de qualificacao (cm_qualification_batches) cujas partes (cm_party_qualifications) alimentaram as variaveis e o array parties deste contrato, quando gerado via Central de Contratos a partir da esteira de qualificacao.';
