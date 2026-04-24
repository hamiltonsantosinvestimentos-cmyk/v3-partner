-- Co-branding PARTNER PRO
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cobranding_slug       TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cobranding_bio        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cobranding_whatsapp   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cobranding_instagram  TEXT;

-- Onboarding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed  BOOLEAN DEFAULT FALSE;
