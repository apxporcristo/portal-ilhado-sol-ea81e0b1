
-- Replace authenticated-only policies with public access (anon + authenticated)

-- app_settings
DROP POLICY IF EXISTS "Authenticated read access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated insert access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated update access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated delete access on app_settings" ON public.app_settings;
CREATE POLICY "Public read access on app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Public insert access on app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access on app_settings" ON public.app_settings FOR UPDATE USING (true);
CREATE POLICY "Public delete access on app_settings" ON public.app_settings FOR DELETE USING (true);

-- vouchers
DROP POLICY IF EXISTS "Authenticated read access on vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Authenticated insert access on vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Authenticated update access on vouchers" ON public.vouchers;
CREATE POLICY "Public read access on vouchers" ON public.vouchers FOR SELECT USING (true);
CREATE POLICY "Public insert access on vouchers" ON public.vouchers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access on vouchers" ON public.vouchers FOR UPDATE USING (true);

-- temp_vouchers
DROP POLICY IF EXISTS "Authenticated read access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Authenticated insert access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Authenticated update access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Authenticated delete access on temp_vouchers" ON public.temp_vouchers;
CREATE POLICY "Public read access on temp_vouchers" ON public.temp_vouchers FOR SELECT USING (true);
CREATE POLICY "Public insert access on temp_vouchers" ON public.temp_vouchers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access on temp_vouchers" ON public.temp_vouchers FOR UPDATE USING (true);
CREATE POLICY "Public delete access on temp_vouchers" ON public.temp_vouchers FOR DELETE USING (true);

-- pacotes
DROP POLICY IF EXISTS "Authenticated read access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Authenticated insert access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Authenticated update access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Authenticated delete access on pacotes" ON public.pacotes;
CREATE POLICY "Public read access on pacotes" ON public.pacotes FOR SELECT USING (true);
CREATE POLICY "Public insert access on pacotes" ON public.pacotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access on pacotes" ON public.pacotes FOR UPDATE USING (true);
CREATE POLICY "Public delete access on pacotes" ON public.pacotes FOR DELETE USING (true);
