-- ============================================================
-- V3 Academy — Tabelas de suporte
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Progresso por vídeo por usuário
CREATE TABLE IF NOT EXISTS academy_progress (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id    text NOT NULL,
  progress_pct integer NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress" ON academy_progress
  FOR ALL USING (auth.uid() = user_id);

-- 2. Links YouTube gerenciados pelo admin (persiste no banco, não localStorage)
CREATE TABLE IF NOT EXISTS academy_yt_links (
  video_id    text PRIMARY KEY,
  url         text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id)
);
ALTER TABLE academy_yt_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads yt_links" ON academy_yt_links
  FOR SELECT USING (true);
CREATE POLICY "Admins manage yt_links" ON academy_yt_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO'))
  );

-- 3. Anotações dos partners com timestamp do vídeo
CREATE TABLE IF NOT EXISTS academy_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id       text NOT NULL,
  timestamp_secs integer NOT NULL DEFAULT 0,
  note           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE academy_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON academy_notes
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_academy_notes_user_video ON academy_notes(user_id, video_id);

-- 4. Certificados emitidos por categoria concluída
CREATE TABLE IF NOT EXISTS academy_certificates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id text NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);
ALTER TABLE academy_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own certificates" ON academy_certificates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts certificates" ON academy_certificates
  FOR INSERT WITH CHECK (true);
