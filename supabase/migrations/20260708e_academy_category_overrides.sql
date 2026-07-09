-- Permite ao admin editar/ocultar temas (categorias) do V3 Academy sem mexer
-- no código -- mesmo padrão já usado em academy_video_overrides.
CREATE TABLE IF NOT EXISTS academy_category_overrides (
  category_id text PRIMARY KEY,
  label       text,
  description text,
  icon        text,
  color       text,
  hidden      boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES profiles(id)
);
