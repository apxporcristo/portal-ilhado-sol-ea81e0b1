
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
