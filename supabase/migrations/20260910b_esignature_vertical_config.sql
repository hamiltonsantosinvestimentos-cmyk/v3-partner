-- Fase 3 do BRIEF "ClickSign vs CertOne" (switch de provedor por vertical),
-- go de Joao em 10/09/2026, com 2 correcoes dele antes do go:
--
-- 1. Modelo de dominio corrigido: as verticais reais sao as 7 do enum
--    contract_vertical (capital_markets, credito, ma, institucional,
--    clientes, talent_pool, colaboradores), confirmado contra o enum real
--    antes de escrever esta migration. "Regularizacao" NAO e vertical, e
--    serie de contrato (V3C-REG, roteada por template.vertical como
--    qualquer outro contrato), corrigido do rascunho original do BRIEF.
--
-- 2. Congelamento por contrato (achado real da sessao, nao do BRIEF
--    original): esignature_vertical_config so decide o provedor no
--    MOMENTO DO ENVIO. Depois de enviado, o contrato usa para sempre o
--    valor gravado em operation_contracts.esignature_provider (Fase 2),
--    nunca a config atual da vertical -- evita que uma troca de switch
--    quebre cancelamento/reenvio/sync de contratos ja em transito.
create table if not exists esignature_vertical_config (
  vertical    contract_vertical primary key,
  provider    text not null default 'clicksign' check (provider in ('clicksign', 'certone')),
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into esignature_vertical_config (vertical, provider)
values
  ('capital_markets', 'clicksign'),
  ('credito', 'clicksign'),
  ('ma', 'clicksign'),
  ('institucional', 'clicksign'),
  ('clientes', 'clicksign'),
  ('talent_pool', 'clicksign'),
  ('colaboradores', 'clicksign')
on conflict (vertical) do nothing;

alter table esignature_vertical_config enable row level security;

create policy "esignature_vertical_config_select" on esignature_vertical_config
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('ADMIN', 'GESTAO'))
  );

create policy "esignature_vertical_config_update" on esignature_vertical_config
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('ADMIN', 'GESTAO'))
  );
