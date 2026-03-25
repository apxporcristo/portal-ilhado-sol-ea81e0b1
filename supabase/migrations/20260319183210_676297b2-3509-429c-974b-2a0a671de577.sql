
-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access user_profiles select" ON public.user_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Public access user_profiles insert" ON public.user_profiles FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public access user_profiles update" ON public.user_profiles FOR UPDATE TO public USING (true);
CREATE POLICY "Public access user_profiles delete" ON public.user_profiles FOR DELETE TO public USING (true);

-- User permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  acesso_voucher boolean DEFAULT false,
  acesso_cadastrar_produto boolean DEFAULT false,
  acesso_ficha_consumo boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access user_permissions select" ON public.user_permissions FOR SELECT TO public USING (true);
CREATE POLICY "Public access user_permissions insert" ON public.user_permissions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public access user_permissions update" ON public.user_permissions FOR UPDATE TO public USING (true);
CREATE POLICY "Public access user_permissions delete" ON public.user_permissions FOR DELETE TO public USING (true);

-- View for user access info
CREATE OR REPLACE VIEW public.vw_meu_acesso AS
SELECT 
  p.user_id,
  p.nome,
  p.email,
  COALESCE(perm.acesso_voucher, false) as acesso_voucher,
  COALESCE(perm.acesso_cadastrar_produto, false) as acesso_cadastrar_produto,
  COALESCE(perm.acesso_ficha_consumo, false) as acesso_ficha_consumo
FROM public.user_profiles p
LEFT JOIN public.user_permissions perm ON perm.user_id = p.user_id;
