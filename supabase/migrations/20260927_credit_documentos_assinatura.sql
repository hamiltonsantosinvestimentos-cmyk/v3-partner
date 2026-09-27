-- Documentos para assinatura do cliente (27/09/2026, pedido do Hamilton)
--
-- Fluxo, dentro do modal da proposta (aba Documentos):
--   1. Mesa Operacional sobe o arquivo que o cliente precisa assinar (+ orientação opcional).
--   2. Partner (ou Mesa) envia por e-mail ao cliente: o e-mail traz a orientação e um link
--      público (/assinatura/<token>) onde o cliente BAIXA o arquivo e SOBE o assinado.
--   3. O arquivo assinado chega pelo link do cliente OU o partner/Mesa sobe na plataforma.
--   4. Partner (ou Mesa) clica "Confirmar envio" → notificação para a Mesa Operacional.
-- Arquivos no bucket credit-documents, em assinaturas/<proposal_id>/<id>/.

CREATE TABLE IF NOT EXISTS public.credit_documentos_assinatura (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id        uuid NOT NULL REFERENCES public.credit_desk_proposals(id) ON DELETE CASCADE,
  titulo             text NOT NULL,
  orientacao         text,

  -- Arquivo enviado pela Mesa para o cliente assinar
  original_path      text NOT NULL,
  original_nome      text NOT NULL,
  criado_por         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- Envio por e-mail ao cliente (link público com token)
  token              text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  token_expira_em    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  email_cliente      text,
  email_enviado_em   timestamptz,
  email_enviado_por  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cliente_baixou_em  timestamptz,

  -- Arquivo assinado (subido pelo cliente no link ou pelo partner/Mesa na plataforma)
  assinado_path      text,
  assinado_nome      text,
  assinado_origem    text CHECK (assinado_origem IS NULL OR assinado_origem IN ('cliente', 'plataforma')),
  assinado_por       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assinado_em        timestamptz,

  -- Confirmação final (dispara a notificação para a Mesa Operacional)
  confirmado_em      timestamptz,
  confirmado_por     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  status             text NOT NULL DEFAULT 'aguardando_envio'
    CHECK (status IN ('aguardando_envio', 'enviado_cliente', 'assinado_recebido', 'confirmado', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_credit_doc_assinatura_proposal ON public.credit_documentos_assinatura(proposal_id);

-- Acesso só pelo servidor (service role): as rotas conferem Mesa/partner da proposta.
ALTER TABLE public.credit_documentos_assinatura ENABLE ROW LEVEL SECURITY;
