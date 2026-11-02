-- Mesa M&A, bloco C, segunda entrega (01/11/2026): trava de publicação e chave do aviso por e-mail.
-- BRIEF: 2026-11-01_Operacional_BRIEF-Mesa-MA-Bloco-C-Segunda-Entrega-Avisos-Padrao-e-Confirmacao-no-Destino_v1.html (QA liberado na rodada 3).
-- 1) CHECK: registro vindo de transferência da Mesa M&A (ma_deal_id preenchido) só entra na vitrine
--    (ativo_vitrine, proposta_recebida) com código emitido (anonymous_id). Hoje há 0 listings vindos do M&A, então
--    nenhum registro existente é afetado. A rota de status já recusa com 422; este CHECK fecha o atalho da função direta.
-- 2) Chave ma_aviso_email_partner (desligada): liga o aviso por e-mail ao partner originador. Só se liga depois da
--    resposta escrita do Robson (base legal, lista de campos, textos) e do W22 ativo no n8n.
-- Rollback: 20261101f_vitrine_exige_codigo_e_chave_aviso_rollback.sql.txt

alter table public.cm_asset_listings drop constraint if exists chk_listing_vitrine_exige_codigo;
alter table public.cm_asset_listings add constraint chk_listing_vitrine_exige_codigo
  check (ma_deal_id is null or listing_status not in ('ativo_vitrine','proposta_recebida') or anonymous_id is not null);

insert into public.cm_feature_flags (key, enabled, description)
values (
  'ma_aviso_email_partner',
  false,
  'Mesa M&A: envia ao partner originador um e-mail padrao (workflow W22) a cada mudanca de etapa do deal, sem codigo, nome da empresa ou valor. Ligar somente com a resposta escrita do Robson e o W22 ativo.'
)
on conflict (key) do nothing;
