CREATE TABLE public.impressoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL,
  ip text,
  porta text DEFAULT '9100',
  bluetooth_nome text,
  bluetooth_mac text,
  descricao text,
  ativa boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.impressoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read impressoras" ON public.impressoras FOR SELECT TO public USING (true);
CREATE POLICY "Public insert impressoras" ON public.impressoras FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update impressoras" ON public.impressoras FOR UPDATE TO public USING (true);
CREATE POLICY "Public delete impressoras" ON public.impressoras FOR DELETE TO public USING (true);

CREATE TRIGGER update_impressoras_updated_at
  BEFORE UPDATE ON public.impressoras
  FOR EACH ROW EXECUTE FUNCTION update_fichas_updated_at();