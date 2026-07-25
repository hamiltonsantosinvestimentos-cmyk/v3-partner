-- ============================================================
-- MIGRATION: Carta de Intencao (LOI) via intake publico + gate de Deal Room
-- Date: 2026-07-25
-- Scope: liga operation_contracts a deal_room_invites (para o gate de sala
--        antes de liberar VDR) e cadastra o template da Carta de Intencao
--        de Compra usado pelo fluxo /intake/carta-intencao/[token].
-- Rollback:
--   DELETE FROM contract_templates WHERE template_name = 'Carta de Intencao de Compra (Matching)';
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS deal_room_invite_id;
-- ============================================================

ALTER TABLE operation_contracts
  ADD COLUMN IF NOT EXISTS deal_room_invite_id uuid REFERENCES deal_room_invites(id);

COMMENT ON COLUMN operation_contracts.deal_room_invite_id IS 'Liga o contrato (ex: Carta de Intencao) ao convite de Deal Room do comprador. Usado pelo gate de sala em /api/investor/vdr/[token]: sala so libera se existir operation_contracts vinculado com status_signature=assinado.';

CREATE INDEX IF NOT EXISTS idx_operation_contracts_deal_room_invite ON operation_contracts(deal_room_invite_id);

INSERT INTO contract_templates (template_name, vertical, body_text_raw, variables_map, editable_sections, is_active, approval_status, version)
SELECT
  'Carta de Intencao de Compra (Matching)',
  'ma',
  '<p>{{local}}, {{data_extenso}}</p>
<p>Aos cuidados de <strong>V3 Partners Soluções Ltda</strong></p>
<p>Prezados,</p>
<p>Por meio desta, a empresa {{nome_interessada}}, representante da CESSIONÁRIA, por intermédio da empresa {{razao_social}}, pessoa jurídica de direito privado, CNPJ {{cnpj}}, com sede na {{endereco_completo}}, por seu sócio {{nome_completo_socio}}, {{nacionalidade}}, {{profissao}}, {{estado_civil}}, CPF {{cpf}}, {{email}}, manifesta formalmente intenção de adquirir {{ativo_descricao}}, ativo estruturado pela V3 Partners Soluções Ltda, no valor total de {{valor_total}} ({{valor_total_extenso}}), com os seguintes requisitos:</p>
<h2>Requisitos da Operação</h2>
<p>1. Volume total do lote: {{volume_descricao}}</p>
<p>2. Condição comercial: {{condicao_comercial}}</p>
<p>3. Escopo logístico: {{escopo_logistico}}</p>
<p>A presente manifestação tem como objetivo demonstrar o interesse real na referida operação, ciente de que a aquisição estará condicionada à devida verificação documental, devendo, como condição sine qua non, o ativo possuir regularidade documental perante os órgãos competentes, bem como a apresentação dos instrumentos contratuais definitivos que regerão os termos e condições da transação.</p>
<p>A V3 Partners compromete-se a apresentar toda a documentação técnica e de propriedade do ativo, atualizada e homologada, enviada somente ao Mandatário de Compra autorizado mediante NDA prévia, para assim realizar a due diligence e, em ato contínuo, celebrar a negociação.</p>
<p>Para tanto, apresento minha qualificação completa e de meus sócios nesta operação para breve NDA celebrada entre as partes e, de igual forma, solicito reunião virtual com a presença do Procurador da Venda e do responsável técnico pelo ativo, a fim de alinhar a negociação, esclarecer especificações técnicas e tratar dos trâmites documentais, com o objetivo de celebrarmos o contrato com celeridade.</p>
<p>Reforçamos nosso compromisso com a legalidade, transparência e conformidade de todos os atos relacionados à presente negociação, colocando-nos à disposição para dar seguimento às tratativas necessárias.</p>
<p>Sem mais para o momento, subscrevemo-nos.</p>
<p>Atenciosamente,</p>
<p style="margin-top:60px;text-align:center;">_________________________________</p>
<p style="text-align:center;font-weight:700;color:#F5F1E8;">{{nome_completo_socio}}</p>
<p style="text-align:center;">Representante da Cessionária</p>',
  '[
    {"key":"local","label":"local","source":"auto"},
    {"key":"data_extenso","label":"data extenso","source":"auto"},
    {"key":"nome_interessada","label":"nome interessada","source":"intake"},
    {"key":"razao_social","label":"razao social","source":"intake"},
    {"key":"cnpj","label":"cnpj","source":"intake"},
    {"key":"endereco_completo","label":"endereco completo","source":"intake"},
    {"key":"nome_completo_socio","label":"nome completo socio","source":"intake"},
    {"key":"nacionalidade","label":"nacionalidade","source":"intake"},
    {"key":"profissao","label":"profissao","source":"intake"},
    {"key":"estado_civil","label":"estado civil","source":"intake"},
    {"key":"cpf","label":"cpf","source":"intake"},
    {"key":"email","label":"email","source":"intake"},
    {"key":"ativo_descricao","label":"ativo descricao","source":"auto"},
    {"key":"valor_total","label":"valor total","source":"auto"},
    {"key":"valor_total_extenso","label":"valor total extenso","source":"auto"},
    {"key":"volume_descricao","label":"volume descricao","source":"auto"},
    {"key":"condicao_comercial","label":"condicao comercial","source":"auto"},
    {"key":"escopo_logistico","label":"escopo logistico","source":"auto"}
  ]'::jsonb,
  '{}'::text[],
  true,
  'rascunho',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM contract_templates WHERE template_name = 'Carta de Intencao de Compra (Matching)'
);
