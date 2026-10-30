-- Contenção de segurança, camada 1 (30/10/2026; "go" do João em 30/10/2026).
-- Varredura de acesso anônimo: dezenas de políticas "service_role_all" e "service full access"
-- foram criadas com o papel {public} e USING (true), o que inclui anon e authenticated. Lido
-- como anônimo (somente contagem, nada gravado): sdr_conversas 4005, sdr_leads 625,
-- partner_registrations 57, partner_contracts 38, partner_subscriptions 25, entre outras.
-- Várias dessas políticas são FOR ALL, então a escrita anônima também estava aberta.
-- Esta migration só retira os privilégios de TABELA do papel anon nas tabelas sensíveis. Não
-- mexe em políticas e não afeta authenticated nem service_role. O app usa chave de serviço
-- nessas tabelas (a chave de serviço ignora a RLS), então o impacto esperado é nulo.
-- Fora desta camada, de propósito: deal_qa_threads, deal_qa_messages, deal_assessments
-- (têm política anon intencional), analise_link_opens, marketplace_*, academy_yt_links.
-- partner_registrations mantém INSERT para anon (cadastro público); perde leitura e alteração.
-- Camada 2 (pendente): trocar o papel das políticas de public para service_role e tratar a
-- exposição para authenticated, que continua aberta por causa do mesmo defeito.
-- Rollback: ver 20261030d_revoke_anon_tabelas_sensiveis_rollback.sql.txt

revoke all on
  public.partner_contracts,
  public.partner_subscriptions,
  public.sdr_leads,
  public.sdr_conversas,
  public.sdr_campanha_contatos,
  public.sdr_campanhas,
  public.sdr_config,
  public.sdr_flow_config,
  public.sdr_flow_stages,
  public.sdr_optouts,
  public.instituicoes,
  public.instituicoes_linhas,
  public.people_hub_members,
  public.disc_assessments,
  public.creative_jobs,
  public.academy_badges,
  public.academy_certificates,
  public.academy_video_overrides
from anon;

revoke select, update, delete, truncate, references, trigger
  on public.partner_registrations
from anon;
