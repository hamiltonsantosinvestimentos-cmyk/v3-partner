-- White label do SDR WhatsApp: cada partner passa a poder conectar o proprio
-- numero (sessao OpenWA propria), configurar a propria IA e disparar campanhas
-- so pros proprios contatos, como add-on pago (R$29,90/mes, ativacao manual).
--
-- Decisao de design: em vez de duplicar as tabelas do SDR, adicionamos uma
-- coluna partner_id NULLABLE nas tabelas existentes. partner_id IS NULL
-- continua sendo o bot interno da V3 (prospeccao de novos partners, dado
-- atual intocado). partner_id preenchido e a instancia daquele partner. Isso
-- deixa o mesmo "cerebro" (lib/sdr-agent.ts) atender os dois casos, so
-- trocando o filtro -- evita duplicar a logica de IA inteira.
--
-- RLS reaproveita o padrao ja usado em crm_leads/split_fiscal: dono ve so o
-- proprio, ADMIN/GESTAO ve tudo. partner_id IS NULL nunca bate com nenhum
-- auth.uid() de partner, entao as linhas internas da V3 continuam invisiveis
-- pra partners automaticamente, sem precisar de caso especial na policy.

-- sdr_leads tinha "phone" como PRIMARY KEY isolado -- um telefone só podia
-- ter UM lead em todo o sistema. Com múltiplos partners isso colide: o mesmo
-- número pode falar com dois partners diferentes (ou com um partner E com o
-- bot interno da V3), e cada um precisa do próprio registro de lead. Troca a
-- PK por um id substituto e usa (phone, partner_id) como chave de unicidade.
-- partner_id NÃO pode ser NULL aqui (diferente das outras tabelas) porque
-- UNIQUE(phone, partner_id) não bloqueia duplicatas quando partner_id é NULL
-- (NULL nunca é "igual" a NULL pro Postgres) -- usamos um UUID sentinela fixo
-- pro bot interno da V3 em vez de NULL, só nesta tabela. Não referencia
-- profiles(id) porque o sentinela não é um usuário de verdade.
ALTER TABLE sdr_leads
  ADD COLUMN IF NOT EXISTS partner_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE sdr_leads DROP CONSTRAINT IF EXISTS sdr_leads_pkey;
ALTER TABLE sdr_leads ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE sdr_leads SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE sdr_leads ALTER COLUMN id SET NOT NULL;
ALTER TABLE sdr_leads ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_leads_phone_partner ON sdr_leads (phone, partner_id);
CREATE INDEX IF NOT EXISTS idx_sdr_leads_partner_id ON sdr_leads (partner_id);

ALTER TABLE sdr_conversas
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_sdr_conversas_partner_id ON sdr_conversas (partner_id);

-- O índice de idempotência (phone, wa_message_id) não incluía partner_id --
-- como cada partner agora tem a própria sessão OpenWA, o wa_message_id (gerado
-- pelo WhatsApp por sessão) não tem garantia de ser único ENTRE sessões
-- diferentes. Sem esse ajuste, uma mensagem legítima de um partner poderia
-- ser descartada por engano como "duplicata" de uma mensagem de outro
-- partner (ou do bot interno) que por coincidência gerou o mesmo id.
-- Dois índices parciais (em vez de um só) porque partner_id aqui é NULL de
-- verdade pro bot interno (não sentinela, como em sdr_leads) -- NULL nunca
-- "bate" com NULL num índice único, então um índice só com partner_id na
-- coluna não pegaria duplicatas do lado interno (que é onde está todo o
-- volume hoje).
DROP INDEX IF EXISTS sdr_conversas_wa_message_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_conversas_wa_message_id_interno
  ON sdr_conversas (phone, wa_message_id)
  WHERE wa_message_id IS NOT NULL AND partner_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_conversas_wa_message_id_partner
  ON sdr_conversas (phone, partner_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL AND partner_id IS NOT NULL;

-- sdr_flow_config era um singleton (id='default'). Passa a admitir uma linha
-- por partner tambem; a linha 'default' (partner_id NULL) continua sendo a
-- configuracao do bot interno da V3, sem nenhuma mudanca de comportamento.
ALTER TABLE sdr_flow_config
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES profiles(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_flow_config_partner_unique
  ON sdr_flow_config (partner_id) WHERE partner_id IS NOT NULL;

ALTER TABLE sdr_campanhas_whatsapp
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_sdr_campanhas_whatsapp_partner_id ON sdr_campanhas_whatsapp (partner_id);

-- Atualiza as policies das tabelas acima pro padrao "dono ve o proprio, staff
-- ve tudo" -- antes eram fechadas em ADMIN/GESTAO/SDR/CLOSER apenas.
DROP POLICY IF EXISTS "sdr_leads_admin_gestao" ON sdr_leads;
CREATE POLICY "sdr_leads_partner_or_staff" ON sdr_leads
  FOR ALL USING (
    partner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO','SDR','CLOSER'))
  );

DROP POLICY IF EXISTS "admin reads sdr conversas" ON sdr_conversas;
CREATE POLICY "sdr_conversas_partner_or_staff_select" ON sdr_conversas
  FOR SELECT USING (
    partner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO','SDR','CLOSER'))
  );

DROP POLICY IF EXISTS "sdr_campanhas_whatsapp_admin_gestao" ON sdr_campanhas_whatsapp;
CREATE POLICY "sdr_campanhas_whatsapp_partner_or_staff" ON sdr_campanhas_whatsapp
  FOR ALL USING (
    partner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );

DROP POLICY IF EXISTS "sdr_campanha_wpp_contatos_admin_gestao" ON sdr_campanha_whatsapp_contatos;
CREATE POLICY "sdr_campanha_wpp_contatos_partner_or_staff" ON sdr_campanha_whatsapp_contatos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sdr_campanhas_whatsapp c
      WHERE c.id = campanha_id
        AND (c.partner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')))
    )
  );

-- Conexao WhatsApp (sessao OpenWA) e status do add-on por partner. A V3
-- continua sendo a unica dona da API key do OpenWA -- so guardamos aqui o
-- session_id (um UUID nao-sensivel), nunca um segredo do partner.
CREATE TABLE IF NOT EXISTS partner_sdr_connections (
  partner_id          uuid PRIMARY KEY REFERENCES profiles(id),
  openwa_session_id   text,
  status              text NOT NULL DEFAULT 'desconectado' CHECK (status IN ('desconectado','aguardando_qr','conectado')),
  whatsapp_phone      text,
  addon_ativo         boolean NOT NULL DEFAULT false,
  addon_solicitado_em timestamptz,
  addon_ativado_em    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_sdr_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_sdr_connections_partner_or_staff" ON partner_sdr_connections
  FOR ALL USING (
    partner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );
