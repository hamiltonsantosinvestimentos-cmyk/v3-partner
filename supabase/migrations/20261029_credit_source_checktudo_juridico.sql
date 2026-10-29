-- Jurídico CheckTudo (Dossiê Jurídico Resumido, querycode 200) na análise de crédito
-- 29/10/2026, decisão de Hamilton: soma com CNJ DataJud e Escavador.
--
-- Só o liga/desliga do Painel de Fontes. O dado da consulta fica em
-- credit_profiles.raw_result.checktudo_juridico (sem coluna nova no perfil).
-- Nullable com default true, igual às demais fontes (todas ligadas por padrão desde 01/09/2026).
-- Antes desta migration rodar, a análise já usa o default (ligado) e só o salvar do painel falha.

alter table public.credit_source_configs
  add column if not exists checktudo_juridico boolean default true;
