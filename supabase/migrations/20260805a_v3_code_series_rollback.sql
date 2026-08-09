-- =============================================================================
-- ROLLBACK da migration 20260805a_v3_code_series.sql
-- =============================================================================
--
-- QUANDO USAR
--   Somente se a Fase 1a precisar ser desfeita ANTES de qualquer rota de
--   aplicacao passar a chamar next_v3_code(). Depois que a Fase 1b entrar em
--   producao, remover estes objetos derruba a emissao de codigo do portal
--   inteiro: cadastro de deal, proposta de credito e carta de consorcio param
--   de funcionar.
--
-- POR QUE E SEGURO NESTE MOMENTO
--   A Fase 1a nao altera nenhuma tabela existente e nenhum codigo de aplicacao
--   a utiliza ainda. Remover estes tres objetos devolve o banco exatamente ao
--   estado anterior.
--
-- O QUE SE PERDE
--   O historico de contadores em v3_code_counters. Se a Fase 1a for reaplicada
--   depois de ja ter emitido codigos reais, os contadores voltam a zero e a
--   proxima emissao tentaria repetir numeros ja usados. O loop de verificacao
--   de next_v3_code() cobre esse caso pulando os ocupados, mas a numeracao
--   ficaria com vaos. Por isso: nao rodar este rollback depois da Fase 1b.
-- =============================================================================

drop function if exists public.next_v3_code(text, text, timestamptz);
drop table    if exists public.v3_code_counters;
drop table    if exists public.v3_code_series;
