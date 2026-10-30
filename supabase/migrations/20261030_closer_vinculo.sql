-- Closer responsável pelo partner (aba Usuários) e data do vínculo.
-- A comissão do closer (10% do líquido da V3) nasce em commissions com operation_ref = 'closer',
-- apontando para a comissão do partner em referral_source_commission_id.
-- Rodar no SQL Editor do Supabase ANTES do merge.

alter table public.profiles
  add column if not exists closer_id uuid references public.profiles(id) on delete set null,
  add column if not exists closer_vinculado_em timestamptz;

create index if not exists idx_profiles_closer_id
  on public.profiles (closer_id)
  where closer_id is not null;
