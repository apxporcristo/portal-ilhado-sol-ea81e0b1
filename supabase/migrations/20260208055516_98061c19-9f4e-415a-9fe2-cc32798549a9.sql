
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on app_settings"
  ON public.app_settings FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on app_settings"
  ON public.app_settings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on app_settings"
  ON public.app_settings FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on app_settings"
  ON public.app_settings FOR DELETE USING (true);
