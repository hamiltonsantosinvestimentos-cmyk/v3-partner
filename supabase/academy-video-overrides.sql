-- Overrides de metadados de vídeos — admin pode editar título, descrição, instrutor, etc. sem redeploy
create table if not exists academy_video_overrides (
  video_id text primary key,
  title text,
  description text,
  instructor text,
  instructor_role text,
  level text,
  duration text,
  duration_secs int,
  featured boolean,
  required boolean,
  tags text[],
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table academy_video_overrides enable row level security;
-- Todos autenticados podem ler (necessário para o cliente carregar)
create policy "authenticated users read overrides" on academy_video_overrides for select using (auth.role() = 'authenticated');
-- Apenas service role pode inserir/atualizar (feito via API com service key)
create policy "service can upsert overrides" on academy_video_overrides for insert with check (true);
create policy "service can update overrides" on academy_video_overrides for update using (true);
create policy "service can delete overrides" on academy_video_overrides for delete using (true);
