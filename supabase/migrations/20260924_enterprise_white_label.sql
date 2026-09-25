-- Enterprise white label (24/09/2026, pedido do Hamilton)
--
-- Um ENTERPRISE "master" tem até 10 usuários abaixo dele. Usuários também têm role ENTERPRISE
-- (mesmo acesso: Mesa de Crédito N1/N2/N3, CRM, consórcio, M&A...), diferenciados por
-- profiles.enterprise_id (= id do master). Não pagam assinatura própria.
--
-- Comissão: toda venda do master OU dos usuários gera 55% para o MASTER (a V3 paga o master).
-- O master define o % de cada usuário SOBRE os 55% dele; esse valor vira um repasse
-- (enterprise_repasses) que o MASTER paga ao usuário — a V3 não paga usuário de Enterprise.
--
-- White label: nome + logo do master (profiles.white_label_*) aparecem para o master e os
-- usuários dele na plataforma, página pública, relatórios/PDFs e e-mails.
-- Todas as colunas novas são nullable (backward compatible).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enterprise_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enterprise_repasse_percent numeric(5,2)
    CHECK (enterprise_repasse_percent IS NULL OR (enterprise_repasse_percent >= 0 AND enterprise_repasse_percent <= 100)),
  ADD COLUMN IF NOT EXISTS white_label_nome text,
  ADD COLUMN IF NOT EXISTS white_label_logo_url text,
  -- Domínio próprio do Enterprise (ex.: plataforma.cliente.com.br), cadastrado no projeto da
  -- Vercel pelo painel /enterprise. status: pendente (aguardando DNS) | ativo | erro.
  ADD COLUMN IF NOT EXISTS white_label_dominio text,
  ADD COLUMN IF NOT EXISTS white_label_dominio_status text
    CHECK (white_label_dominio_status IS NULL OR white_label_dominio_status IN ('pendente', 'ativo', 'erro')),
  ADD COLUMN IF NOT EXISTS white_label_dominio_atualizado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_enterprise_id ON public.profiles(enterprise_id);
-- Um domínio pertence a um único Enterprise.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_white_label_dominio
  ON public.profiles (lower(white_label_dominio)) WHERE white_label_dominio IS NOT NULL;

COMMENT ON COLUMN public.profiles.enterprise_id IS
  'Usuário de um Enterprise: id do perfil ENTERPRISE master. NULL = master (ou qualquer outro perfil).';
COMMENT ON COLUMN public.profiles.enterprise_repasse_percent IS
  'Usuário de Enterprise: % que o master repassa a ele, calculado SOBRE a comissão do master (55%).';
COMMENT ON COLUMN public.profiles.white_label_nome IS 'Enterprise master: nome da marca exibido no white label.';
COMMENT ON COLUMN public.profiles.white_label_logo_url IS 'Enterprise master: URL pública do logo (bucket white-label).';

-- Repasses que o master deve aos usuários, 1 por comissão gerada em venda de usuário.
-- O valor é calculado na leitura (commission_value × repasse_percent / 100), para acompanhar
-- ajuste de valor da comissão na autorização.
CREATE TABLE IF NOT EXISTS public.enterprise_repasses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id    uuid NOT NULL UNIQUE REFERENCES public.commissions(id) ON DELETE CASCADE,
  enterprise_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usuario_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  repasse_percent  numeric(5,2) NOT NULL CHECK (repasse_percent >= 0 AND repasse_percent <= 100),
  status           text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO')),
  pago_em          timestamptz,
  pago_por         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacao       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_repasses_enterprise ON public.enterprise_repasses(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_repasses_usuario ON public.enterprise_repasses(usuario_id);

ALTER TABLE public.enterprise_repasses ENABLE ROW LEVEL SECURITY;

-- Leitura: o master vê os repasses dele, o usuário vê os próprios, ADMIN/GESTAO/FINANCEIRO vêem todos.
-- Escrita só pelo servidor (service role).
DROP POLICY IF EXISTS enterprise_repasses_select ON public.enterprise_repasses;
CREATE POLICY enterprise_repasses_select ON public.enterprise_repasses
  FOR SELECT USING (
    enterprise_id = auth.uid()
    OR usuario_id = auth.uid()
    OR get_user_role() IN ('ADMIN', 'GESTAO', 'FINANCEIRO')
  );

-- Bucket público para os logos do white label.
INSERT INTO storage.buckets (id, name, public)
VALUES ('white-label', 'white-label', true)
ON CONFLICT (id) DO NOTHING;
