-- =============================================================================
-- CLIENT 360, FASE A: fechar a escrita
-- =============================================================================
--
-- CONTEXTO
--   Fase 1 (09/08) fez o backfill de v3_clients, mas nunca ligou resolveClient()
--   em nenhuma rota de criacao -- o Client 360 era uma fotografia parada, nao
--   um sistema vivo. Joao pediu explicitamente pra fechar esse ciclo (10/08):
--   "toda operacao nova ja nasce ligada ao cliente".
--
--   Esta migration prepara o terreno para os 6 pontos de escrita: adiciona as
--   colunas que faltavam para Consorcios ter onde guardar o documento do
--   cliente. Credito, Bolsa de Ativos e Credit Engine ja tinham
--   client_cpf_cnpj/seller_cpf_cnpj/subject_cpf_cnpj e v3_client_id desde a
--   Fase 1 -- nada a fazer ali alem de chamar resolveClient() na rota (feito
--   no codigo, nao aqui).
--
--   Achado ao investigar antes de codar: nem consorcio_projetos nem
--   consorcio_ofertas jamais capturaram CPF/CNPJ em nenhum formulario -- nao
--   e falta de wiring, e falta do proprio campo. Confirmado por busca no
--   codigo (zero ocorrencia de "cpf" em toda a pasta consorcio/).
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 3 colunas novas nullable, 1 FK nova nullable. Nenhum DROP,
--   nenhum UPDATE em dado existente.
-- =============================================================================

alter table public.consorcio_projetos
  add column if not exists client_cpf_cnpj text;

comment on column public.consorcio_projetos.client_cpf_cnpj is
  'CPF/CNPJ do cliente do projeto, capturado no formulario de criacao. Alimenta resolveClient() (Client 360) no momento da criacao.';

alter table public.consorcio_ofertas
  add column if not exists interessado_cpf_cnpj text;

comment on column public.consorcio_ofertas.interessado_cpf_cnpj is
  'CPF/CNPJ do interessado na carta, capturado no formulario de oferta. Usado por resolveClient() (Client 360) no momento em que a oferta e ACEITA, nunca na criacao da oferta -- mesma logica ja aplicada a create_deal_folder: uma oferta pode nunca virar aquisicao.';

alter table public.consorcio_cartas
  add column if not exists v3_client_id uuid references public.v3_clients(id);

comment on column public.consorcio_cartas.v3_client_id is
  'Cliente que adquiriu a carta, preenchido no momento em que uma oferta e aceita (POST /api/consorcio/ofertas/[id]/aceitar). Nulo enquanto a carta esta DISPONIVEL ou NEGOCIACAO.';
