-- =============================================================================
-- FIX: regex de governanca de pasta (MPS) nao reconhece o v3_code novo
-- =============================================================================
--
-- CONTEXTO
--   A Fase 1a da governanca de numeracao (05/08/2026) decidiu, com Joao
--   Lemos, que codigos NOVOS de M&A levam a vertical embutida
--   (V3-MA-2026-08-IND-001), preservando os codigos ja emitidos no formato
--   antigo (V3-2026-06-AGR-001) sem alteracao -- decisao de congelar
--   historico.
--
--   O que nao foi verificado na Fase 1a: validate_folder_path(), que
--   protege a criacao de pasta em folder_registry desde 16/06/2026 (MPS
--   Documentos V3), so aceita o formato antigo:
--     ^MA/V3-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+
--   Um path com o v3_code novo (V3-MA-...) nao bate nessa regex.
--
--   Achado ao tentar corrigir o gap de 6 deals sem v3_code (07/08/2026):
--   os 6 receberam v3_code novo corretamente, mas create_deal_folder()
--   falhou nos 6, com FOLDER_VIOLATION -- que e tratado como severidade
--   CRITICAL em folder_governance_log e bloqueia com excecao. Nenhuma pasta
--   orfa foi criada (a funcao e transacional, falha limpa).
--
--   Isso nao afeta so os 6 deals do backfill: afeta QUALQUER M&A com
--   v3_code novo (inclusive o deal MA-26-37682 do partner Jean Paulo) que
--   tentar subir documento pelo link publico, a partir de agora.
--
-- O QUE ESTA MIGRATION FAZ
--   Torna o segmento de vertical OPCIONAL na regex de M&A, aceitando os
--   dois formatos ao mesmo tempo:
--     V3-2026-06-AGR-001        (legado, continua valido)
--     V3-MA-2026-08-IND-001     (novo, passa a ser aceito)
--   Nenhuma outra linha da funcao e tocada -- Credito, Consorcios e
--   Administracao ficam exatamente como estavam.
--
-- RISCO CONHECIDO, NAO RESOLVIDO AQUI (fora de escopo deste fix)
--   As linhas de Credito (^Credito/CRE-\d{4}-\d{3}_.+) e Consorcios
--   (^Consorcios/CON-\d{4}-\d{3}_.+) usam prefixos proprios (CRE-, CON-)
--   que nao tem nenhuma relacao com as series V3-CR/V3-CRI/V3-CS emitidas
--   pelo next_v3_code(). Se e quando essas verticais passarem a gerar
--   pasta a partir do v3_code novo (Fase 2 do credito, ainda pendente),
--   este mesmo tipo de incompatibilidade provavelmente se repete ali.
--   Registrado aqui para nao ser esquecido, nao corrigido agora por falta
--   de evidencia de uso real hoje.
--
-- SEGURANCA
--   CREATE OR REPLACE de uma unica funcao IMMUTABLE, sem efeito colateral.
--   A protecao contra path fora do padrao continua ativa e identica para
--   tudo que nao seja a nova variante de M&A -- isto amplia o que e aceito,
--   nunca afrouxa o que ja era aceito antes.
-- =============================================================================

create or replace function public.validate_folder_path(p_path text)
 returns boolean
 language plpgsql
 immutable
as $function$
begin
  return p_path ~ '^MA/V3-(?:[A-Z]{2,4}-)?\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}_.+'
      or p_path ~ '^Credito/CRE-\d{4}-\d{3}_.+'
      or p_path ~ '^Consorcios/CON-\d{4}-\d{3}_.+'
      or p_path ~ '^Administracao/(Documento_Cadastro|Financeiro|Juridico)';
end;
$function$;
