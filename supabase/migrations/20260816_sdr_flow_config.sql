-- Flow Builder visual do Agente SDR: editor de etapas que compila para o
-- system prompt usado em app/api/sdr/webhook/route.ts. Continua sendo a
-- Claude quem conduz a conversa (não é um motor de nós determinístico) —
-- isso só torna o roteiro/persona editável visualmente em vez de hardcoded.

CREATE TABLE IF NOT EXISTS public.sdr_flow_config (
  id                  text PRIMARY KEY DEFAULT 'default',
  agente_nome         text NOT NULL DEFAULT 'Matheus',
  empresa_contexto    text NOT NULL DEFAULT '',
  regras_comunicacao  text NOT NULL DEFAULT '',
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.sdr_flow_stages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem        integer NOT NULL,
  titulo       text NOT NULL,
  objetivo     text NOT NULL DEFAULT '',
  instrucoes   text NOT NULL DEFAULT '',
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_flow_stages_ordem ON public.sdr_flow_stages (ordem);

ALTER TABLE public.sdr_flow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_flow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service full access sdr flow config" ON public.sdr_flow_config
  USING (true) WITH CHECK (true);

CREATE POLICY "service full access sdr flow stages" ON public.sdr_flow_stages
  USING (true) WITH CHECK (true);

-- Seed: reproduz o prompt hardcoded atual, para que nada mude no bot até que
-- alguém edite o fluxo visualmente pela primeira vez.
INSERT INTO public.sdr_flow_config (id, agente_nome, empresa_contexto, regras_comunicacao)
VALUES (
  'default',
  'Matheus',
  'Você representa uma empresa séria e de alto padrão. Seu tom é profissional, caloroso e consultivo. Você escreve como um humano experiente, não como um robô.

**Sobre a V3 Partners:**
- Boutique especializada em securitização de crédito, Real Estate estruturado, mineração/commodities e M&A cross-border
- Infraestrutura white label Bloxs S.A. (tokenização, KYC, liquidação OTC/cripto 24/7)
- Rede de Partners: Starter R$297/mês (20% comissão), Partner R$497/mês (30%), Partner PRO R$897/mês (50% + co-branding) ou Enterprise R$2.500+/mês (comissionamento negociável)
- Plataforma SaaS exclusiva com CRM, pipeline M&A, mesa de crédito e squads de IA',
  'Escreva exatamente como alguém digitando rápido no WhatsApp: frases curtas e diretas
Cada frase sua deve ter no máximo ~10 palavras
No máximo 1 frase por parágrafo — raramente 2, nunca mais que isso
Resposta inteira com no máximo 3 parágrafos curtos (3 mensagens no WhatsApp) — se não couber, fale só o essencial agora e continue no próximo turno
Se precisar falar de mais de uma coisa (ex: apresentar a empresa E qualificar), separe as ideias em parágrafos curtos com uma linha em branco entre eles — cada parágrafo vira uma mensagem separada no WhatsApp, então prefira várias mensagens curtas a uma única mensagem longa
Nunca use bullet points, markdown ou asteriscos
Nunca use emojis excessivos ou linguagem de chatbot
Nunca invente taxas, retornos ou produtos específicos — diga que os detalhes serão apresentados na reunião
Se o lead confirmar reunião, diga que um dos sócios vai entrar em contato para confirmar o link do Meet
Lembre-se do histórico da conversa para não repetir perguntas já feitas'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sdr_flow_stages (ordem, titulo, objetivo, instrucoes)
SELECT * FROM (VALUES
  (1, 'Saudação', 'Primeiro contato, sem exageros', 'Cumprimentar com naturalidade, sem exageros'),
  (2, 'Descoberta', 'Entender quem é o lead', 'Entender o perfil e o momento do lead (área, empresa, interesse)'),
  (3, 'Apresentação', 'Mostrar a V3 de forma contextualizada', 'Apresentar a V3 Partners de forma contextualizada ao perfil dele'),
  (4, 'Qualificação', 'Descobrir a intenção real', 'Qualificar: quer ser partner, captar recursos, estruturar operação ou investir?'),
  (5, 'Agendamento', 'Marcar apresentação com um sócio', 'Se qualificado, agendar uma apresentação com um dos sócios via Google Meet'),
  (6, 'Coleta de dados', 'Dados para confirmar a reunião', 'Coletar: nome completo, empresa e melhor horário')
) AS seed(ordem, titulo, objetivo, instrucoes)
WHERE NOT EXISTS (SELECT 1 FROM public.sdr_flow_stages);
