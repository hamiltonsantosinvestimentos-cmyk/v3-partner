-- Campos Cora na tabela de cadastros
alter table partner_registrations
  add column if not exists cora_invoice_id       text,
  add column if not exists cora_invoice_status   text default 'PENDING',
  add column if not exists cora_pix_emv          text,
  add column if not exists cora_pix_qr_code      text,
  add column if not exists cora_boleto_pdf        text,
  add column if not exists cora_boleto_barcode    text,
  add column if not exists cora_payment_url       text,
  add column if not exists cora_paid_at           timestamptz,
  add column if not exists cora_amount_cents      int;

-- Tabela de cobranças de mensalidade (renovações mensais)
create table if not exists partner_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid references auth.users(id),
  plano           text not null,
  amount_cents    int not null,
  due_date        date not null,
  cora_invoice_id text,
  status          text default 'PENDING',
  pix_emv         text,
  pix_qr_code     text,
  boleto_barcode  text,
  boleto_pdf      text,
  paid_at         timestamptz,
  created_at      timestamptz default now()
);

alter table partner_subscriptions enable row level security;

-- Partner vê só as próprias
create policy "partner sees own subscriptions"
  on partner_subscriptions for select
  using (partner_id = auth.uid());

-- Serviço pode inserir/atualizar
create policy "service full access"
  on partner_subscriptions for all
  using (true) with check (true);
