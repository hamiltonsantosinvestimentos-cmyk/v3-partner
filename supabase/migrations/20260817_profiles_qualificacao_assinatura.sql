-- ============================================================
-- MIGRATION: profiles ganha nationality/marital_status/profession
-- Date: 2026-08-17
-- Scope: fecha o bloqueio de CPF em lib/ncnda-desk-head.ts (Hamilton
-- Santos e Robson Lino sem CPF localizado em nenhuma fonte segura do
-- repositorio, generate() bloqueava com 422). Decisao de Joao: cada
-- Head da mesa preenche o proprio dado de qualificacao juridica em
-- /perfil (mesmo padrao ja usado para document_cpf, que ja existia e
-- ja era auto-editavel, so nunca tinha os 3 campos de qualificacao
-- que o NCNDA precisa).
--
-- Backfill: apenas dado ja conhecido como real e ja usado hoje em
-- lib/ncnda-desk-head.ts (hardcoded) ou ja presente em profiles.
-- Nada fabricado. Joao nao tinha document_cpf em profiles (so no
-- arquivo estatico), corrigido aqui para nao quebrar MESA_MA ao
-- migrar generate() para leitura dinamica. Dr. Athaydes ja tinha
-- document_cpf em profiles, so faltava qualificacao.
--
-- Hamilton (suporte@v3partners.com.br) e Robson (robinholino16@gmail.com,
-- confirmado por Joao como a conta real de login dele) ficam NULL de
-- proposito -- preenchem pelo /perfil.
--
-- Rollback:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS nationality;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS marital_status;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS profession;
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marital_status text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession text;

COMMENT ON COLUMN profiles.nationality IS 'Nacionalidade, usada em blocos de qualificacao juridica de contratos (NCNDA Mestre, etc). Auto-preenchido pelo proprio usuario em /perfil.';
COMMENT ON COLUMN profiles.marital_status IS 'Estado civil, mesmo uso de nationality.';
COMMENT ON COLUMN profiles.profession IS 'Profissao, mesmo uso de nationality.';

-- Backfill: Joao (MESA_MA) -- CPF real, ja usado em contrato assinado
-- (V3C-NDA e outros), nunca tinha sido gravado em profiles.
UPDATE profiles
SET document_cpf = '078.678.257-97',
    nationality = 'brasileiro',
    profession = 'empresário'
WHERE email = 'joao.lemos@v3partners.com.br'
  AND (document_cpf IS NULL OR document_cpf = '');

-- Backfill: Dr. Luis Athaydes (BOLSA_ATIVOS) -- CPF ja presente em
-- profiles (78385172653), so faltava qualificacao.
UPDATE profiles
SET nationality = 'brasileiro',
    profession = 'advogado'
WHERE email = 'luis.athaydes@v3partners.com.br'
  AND nationality IS NULL;
