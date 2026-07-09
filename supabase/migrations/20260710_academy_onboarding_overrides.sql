CREATE TABLE IF NOT EXISTS academy_onboarding_overrides (
  step_id     int PRIMARY KEY,
  title       text,
  description text,
  duration    text,
  video_url   text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES profiles(id)
);
