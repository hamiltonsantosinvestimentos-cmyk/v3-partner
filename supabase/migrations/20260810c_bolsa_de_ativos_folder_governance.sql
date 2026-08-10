-- =============================================================================
-- GOVERNANCA DOCUMENTAL UNIVERSAL, FASE 2 (parcial: Credito + Bolsa de Ativos)
-- =============================================================================
--
-- CONTEXTO
--   Pedido original de Joao Lemos em 08/08/2026: "todas as pastas precisam
--   ter uma pasta publica de todos os clientes". create_deal_folder() ja
--   suporta MA (7 subpastas), Credito (5) e Consorcios (4) desde 17/06/2026,
--   mas nunca foi chamada por nenhum fluxo de Credito ou Consorcios -- so
--   M&A cria pasta de verdade hoje. Bolsa de Ativos (cm_asset_listings) nem
--   tinha branch no CASE: cairia no RAISE EXCEPTION.
--
--   Investigacao em 10/08/2026 (Fase 2) encontrou 2 problemas que o plano
--   original nao previa e foram resolvidos com Joao antes desta migration:
--     1. cm_asset_listings nao tem NENHUMA coluna de codigo V3 -- so o
--        anonymous_id legado (CM-OT-FED-NNNN / CM-PR-FED-NNNN). A serie BA/PR
--        ja estava registrada em v3_code_series (Fase 1a, 05/08) com
--        target_column = anonymous_id: o desenho original ja previa suceder
--        o gerador legado, nao criar coluna nova. Decisao de Joao: emitir
--        agora, reaproveitando o alvo ja registrado (ver route.ts).
--     2. Consorcios (consorcio_cartas) e catalogo de cartas a venda, nao tem
--        coluna de cliente -- nao e o mesmo tipo de "deal" que MA/Credito.
--        Decisao de Joao: adiar Consorcios ate existir unidade real de pasta
--        (ex: quando a carta e vendida a um cliente). Esta migration NAO
--        toca a branch Consorcios nem sua regex -- CREATE OR REPLACE precisa
--        do corpo inteiro, entao ela e reproduzida identica, nunca alterada.
--
--   Bug real achado de passagem, corrigido no mesmo bloco: a regex de
--   Credito em validate_folder_path() (^Credito/CRE-\d{4}-\d{3}_.+) nunca
--   bateu com o formato real emitido em producao (CRED-26-698926, prefixo
--   CRED nao CRE, ano de 2 digitos, sequencial sem largura fixa). Nenhuma
--   pasta de Credito foi criada ainda, entao o bug nunca quebrou nada em
--   producao -- so teria quebrado no primeiro create_deal_folder('Credito').
--
-- SEGURANCA EM PRODUCAO
--   ALTER de CHECK constraint (aditivo, so acrescenta 'BolsaDeAtivos') e 2
--   CREATE OR REPLACE FUNCTION. Nenhum DROP, nenhum UPDATE em dado existente.
--   Zero linhas em folder_registry hoje para Credito/Consorcios/BolsaDeAtivos,
--   entao nao ha path antigo para migrar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. folder_registry aceita a vertical nova
-- -----------------------------------------------------------------------------

alter table public.folder_registry drop constraint folder_registry_vertical_check;
alter table public.folder_registry add constraint folder_registry_vertical_check
  check (vertical = any (array['MA'::text, 'Credito'::text, 'Consorcios'::text, 'Administracao'::text, 'BolsaDeAtivos'::text]));


-- -----------------------------------------------------------------------------
-- 2. create_deal_folder() -- branch nova para BolsaDeAtivos
--    Taxonomia de 5 subpastas espelhando o pipeline real de cm_listing_status
--    (20260619_cm_marketplace_foundation.sql): documentacao/nda -> due
--    diligence/analise -> vitrine/propostas -> escrow/cessao -> liquidacao.
--    MA, Credito e Consorcios reproduzidos identicos (CREATE OR REPLACE exige
--    o corpo inteiro) -- nenhuma das tres foi alterada.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_deal_folder(p_vertical text, p_deal_code text, p_client_name text, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_folder_id UUID;
  v_base_path TEXT;
  v_subfolder TEXT;
  v_subfolders TEXT[];
BEGIN
  v_base_path := p_vertical || '/' || p_deal_code || '_' || p_client_name;

  CASE p_vertical
    WHEN 'MA' THEN
      v_subfolders := ARRAY['01_NDA','02_Teaser','03_CIM','04_Due_Diligence','05_Propostas','06_Contrato','07_Closing'];
    WHEN 'Credito' THEN
      v_subfolders := ARRAY['01_Analise','02_Documentacao','03_Parecer','04_Contrato','05_Monitoramento'];
    WHEN 'Consorcios' THEN
      v_subfolders := ARRAY['01_Proposta','02_Documentacao','03_Contrato','04_Acompanhamento'];
    WHEN 'BolsaDeAtivos' THEN
      v_subfolders := ARRAY['01_Documentacao','02_Due_Diligence','03_Vitrine_e_Propostas','04_Escrow_e_Cessao','05_Liquidacao'];
    ELSE
      RAISE EXCEPTION 'Vertical "%" nao suporta criacao automatica de deal folder', p_vertical;
  END CASE;

  INSERT INTO folder_registry (vertical, deal_code, client_name, full_path, depth, created_by)
  VALUES (p_vertical, p_deal_code, p_client_name, v_base_path, 1, p_user_id)
  RETURNING id INTO v_folder_id;

  FOREACH v_subfolder IN ARRAY v_subfolders LOOP
    INSERT INTO folder_registry (vertical, deal_code, client_name, full_path, parent_path, depth, created_by)
    VALUES (p_vertical, p_deal_code, p_client_name, v_base_path || '/' || v_subfolder, v_base_path, 2, p_user_id);
  END LOOP;

  INSERT INTO folder_access_grants (folder_id, user_id, permission, granted_by, reason)
  VALUES (v_folder_id, p_user_id, 'admin', p_user_id, 'Criador da pasta do deal');

  RETURN v_folder_id;
END;
$function$;


-- -----------------------------------------------------------------------------
-- 3. validate_folder_path() -- fix Credito + pattern nova BolsaDeAtivos
--    Credito: aceita o formato legado real (CRED-26-698926) E o formato novo
--    da serie CR/CRI (V3-CR-2026-08-SAU-001 / V3-CRI-...), para o dia em que
--    credit_desk_proposals passar a emitir pela serie nova sem quebrar de novo
--    -- mesmo padrao de congelamento de historico ja usado em MA.
--    BolsaDeAtivos: so aceita o formato novo (V3-BA-.../V3-PR-...), porque
--    nenhuma pasta e criada retroativamente para listagem antiga (anonymous_id
--    legado CM-OT-FED-NNNN nunca vira deal_code de pasta).
--    Consorcios e Administracao: identicos, nao tocados.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_folder_path(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  return p_path ~ '^MA/V3-(?:[A-Z]{2,4}-)?\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+'
      or p_path ~ '^Credito/(CRED-\d{2}-\d+|V3-CRI?-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3})_.+'
      or p_path ~ '^Consorcios/CON-\d{4}-\d{3}_.+'
      or p_path ~ '^BolsaDeAtivos/V3-(BA|PR)-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+'
      or p_path ~ '^Administracao/(Documento_Cadastro|Financeiro|Juridico)';
end;
$function$;
