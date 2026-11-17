-- Mesa M&A: moeda do ativo (BRL padrão, USD) e câmbio do dia gravado no card.
-- deal_value continua sendo o valor NA MOEDA DO ATIVO (fonte da verdade).
-- fx_rate_brl = quanto vale 1 unidade da moeda em reais na data fx_rate_date (PTAX do BCB).
-- Colunas nullable e backward compatible: linha antiga sem moeda é lida como BRL pela aplicação.
alter table public.ma_deals
  add column if not exists currency text default 'BRL',
  add column if not exists fx_rate_brl numeric(14,6),
  add column if not exists fx_rate_date date,
  add column if not exists fx_rate_source text;

alter table public.ma_deals
  drop constraint if exists ma_deals_currency_chk;
alter table public.ma_deals
  add constraint ma_deals_currency_chk check (currency is null or currency in ('BRL','USD','EUR'));

alter table public.ma_deals
  drop constraint if exists ma_deals_fx_rate_chk;
alter table public.ma_deals
  add constraint ma_deals_fx_rate_chk check (fx_rate_brl is null or fx_rate_brl > 0);

comment on column public.ma_deals.currency is 'Moeda do deal_value: BRL (padrão), USD ou EUR.';
comment on column public.ma_deals.fx_rate_brl is 'Câmbio do dia (BRL por 1 unidade da moeda), gravado pelo botão Atualizar câmbio.';
