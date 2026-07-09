CREATE TABLE IF NOT EXISTS academy_live_classes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  description text,
  instructor text,
  category text,
  date timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  level text,
  total_spots int NOT NULL DEFAULT 100,
  zoom_link text,
  recording_url text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_live_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id text NOT NULL REFERENCES academy_live_classes(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES profiles(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  reminder_sent_at timestamptz,
  UNIQUE (live_class_id, partner_id)
);
