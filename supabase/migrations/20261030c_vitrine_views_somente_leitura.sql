-- Correção de segurança (30/10/2026). Alerta do painel Supabase: "Security Definer View" em
-- public.cm_vitrine_public e public.cm_vitrine_publica_imoveis.
-- As duas views são vitrines públicas de propósito: colunas anonimizadas (anonymous_id, sem
-- vendedor, sem documento), filtro por status de vitrine e deleted_at nulo, e a de imóveis ainda
-- exige allow_public_listing. Por isso continuam SECURITY DEFINER: a RLS de cm_asset_listings
-- não deixa o anônimo ler a tabela, então security_invoker as esvaziaria.
-- Achado grave (ensaio em transação desfeita): como são views de uma tabela só, são
-- atualizáveis, e anon e authenticated tinham INSERT, UPDATE, DELETE e TRUNCATE. Rodando como
-- dono, um anônimo conseguia ALTERAR e APAGAR listings em status de vitrine, contornando a RLS
-- (UPDATE: 1 linha, DELETE: 1 linha no ensaio). O INSERT só falhava por acaso, por uma coluna
-- obrigatória (seller_name) fora da view. Hoje 0 listings estão em status de vitrine, então não
-- houve exposição efetiva, mas ela apareceria na primeira publicação.
-- Correção: manter a leitura (SELECT) e retirar toda escrita de anon e authenticated.
-- Consumo no código: apenas SELECT (/api/cm/vitrine e /api/public/bolsa/imoveis).
-- O alerta do painel permanece, e é aceito: SECURITY DEFINER é o desenho.
-- Rollback: ver 20261030c_vitrine_views_somente_leitura_rollback.sql.txt

revoke insert, update, delete, truncate, references, trigger
  on public.cm_vitrine_public, public.cm_vitrine_publica_imoveis
  from anon, authenticated;
