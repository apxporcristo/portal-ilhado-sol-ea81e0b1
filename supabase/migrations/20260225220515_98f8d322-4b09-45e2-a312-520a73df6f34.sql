
-- Drop all restrictive policies and recreate as permissive

-- app_settings
DROP POLICY IF EXISTS "Authenticated delete access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated insert access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated read access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated update access on app_settings" ON public.app_settings;

CREATE POLICY "Authenticated read access on app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert access on app_settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update access on app_settings" ON public.app_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete access on app_settings" ON public.app_settings FOR DELETE TO authenticated USING (true);

-- vouchers
DROP POLICY IF EXISTS "Authenticated insert access on vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Authenticated read access on vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Authenticated update access on vouchers" ON public.vouchers;

CREATE POLICY "Authenticated read access on vouchers" ON public.vouchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert access on vouchers" ON public.vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update access on vouchers" ON public.vouchers FOR UPDATE TO authenticated USING (true);

-- temp_vouchers
DROP POLICY IF EXISTS "Authenticated delete access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Authenticated insert access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Authenticated read access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Authenticated update access on temp_vouchers" ON public.temp_vouchers;

CREATE POLICY "Authenticated read access on temp_vouchers" ON public.temp_vouchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert access on temp_vouchers" ON public.temp_vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update access on temp_vouchers" ON public.temp_vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete access on temp_vouchers" ON public.temp_vouchers FOR DELETE TO authenticated USING (true);

-- pacotes
DROP POLICY IF EXISTS "Authenticated delete access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Authenticated insert access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Authenticated read access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Authenticated update access on pacotes" ON public.pacotes;

CREATE POLICY "Authenticated read access on pacotes" ON public.pacotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert access on pacotes" ON public.pacotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update access on pacotes" ON public.pacotes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete access on pacotes" ON public.pacotes FOR DELETE TO authenticated USING (true);
