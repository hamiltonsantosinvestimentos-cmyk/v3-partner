-- Banner principal (hero) da página inicial do V3 Academy, editável pelo admin.
CREATE TABLE IF NOT EXISTS academy_home_banner (
  id          text PRIMARY KEY DEFAULT 'main',
  title       text,
  subtitle    text,
  background_image_url text,
  cta_label   text,
  cta_href    text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES profiles(id)
);
