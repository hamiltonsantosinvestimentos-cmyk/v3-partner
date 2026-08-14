-- ============================================================
-- Kanban + Dashboard de WhatsApp na aba SDR — acesso SDR/CLOSER
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1) Garante que os valores de role SDR/CLOSER existem no enum user_role.
--    Esses valores já estão em uso em produção (prospeccao_leads, sidebar, etc.)
--    mas nunca foram capturados numa migration rastreada — isso só documenta
--    o estado real, é seguro rodar mesmo se já existirem (IF NOT EXISTS).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SDR';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CLOSER';

-- 2) Garante a coluna humano_ativo em sdr_leads (já existe em produção,
--    usada pelo webhook e pelo CRM do WhatsApp, mas também nunca foi
--    capturada numa migration rastreada).
ALTER TABLE sdr_leads ADD COLUMN IF NOT EXISTS humano_ativo boolean DEFAULT false;

-- 3) RLS: SDR/CLOSER podem ler e atualizar sdr_leads, mas só os que são
--    responsáveis (ADMIN/GESTAO continuam vendo tudo via a policy existente
--    sdr_leads_admin_gestao — esta é ADITIVA, não substitui aquela).
DROP POLICY IF EXISTS "sdr_leads_sdr_closer_own" ON sdr_leads;
CREATE POLICY "sdr_leads_sdr_closer_own" ON sdr_leads
  FOR ALL USING (
    responsavel_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SDR','CLOSER'))
  );

-- 4) RLS: SDR/CLOSER podem ler conversas (sdr_conversas) dos telefones pelos
--    quais são responsáveis em sdr_leads.
DROP POLICY IF EXISTS "sdr_conversas_sdr_closer_own" ON public.sdr_conversas;
CREATE POLICY "sdr_conversas_sdr_closer_own" ON public.sdr_conversas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sdr_leads sl
      JOIN profiles p ON p.id = auth.uid()
      WHERE sl.phone = sdr_conversas.phone
        AND sl.responsavel_id = auth.uid()
        AND p.role IN ('SDR','CLOSER')
    )
  );

-- Nota: as rotas /api/sdr/kanban e /api/sdr/dashboard usam o client de
-- service_role (bypassa RLS) e fazem o escopo por responsavel_id na própria
-- query — essas policies de RLS são defesa em profundidade para o caso de
-- alguma leitura futura ser feita direto do client autenticado do usuário.
