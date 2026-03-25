-- Tighten table access: remove public policies and require authenticated users

-- vouchers
DROP POLICY IF EXISTS "Allow public insert access" ON public.vouchers;
DROP POLICY IF EXISTS "Allow public read access" ON public.vouchers;
DROP POLICY IF EXISTS "Allow public update access" ON public.vouchers;

CREATE POLICY "Authenticated insert access on vouchers"
ON public.vouchers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated read access on vouchers"
ON public.vouchers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated update access on vouchers"
ON public.vouchers
FOR UPDATE
TO authenticated
USING (true);

-- temp_vouchers
DROP POLICY IF EXISTS "Allow public delete access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Allow public insert access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Allow public read access on temp_vouchers" ON public.temp_vouchers;
DROP POLICY IF EXISTS "Allow public update access on temp_vouchers" ON public.temp_vouchers;

CREATE POLICY "Authenticated delete access on temp_vouchers"
ON public.temp_vouchers
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert access on temp_vouchers"
ON public.temp_vouchers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated read access on temp_vouchers"
ON public.temp_vouchers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated update access on temp_vouchers"
ON public.temp_vouchers
FOR UPDATE
TO authenticated
USING (true);

-- pacotes
DROP POLICY IF EXISTS "Allow public delete access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Allow public insert access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Allow public read access on pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Allow public update access on pacotes" ON public.pacotes;

CREATE POLICY "Authenticated delete access on pacotes"
ON public.pacotes
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert access on pacotes"
ON public.pacotes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated read access on pacotes"
ON public.pacotes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated update access on pacotes"
ON public.pacotes
FOR UPDATE
TO authenticated
USING (true);

-- app_settings
DROP POLICY IF EXISTS "Allow public delete access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public insert access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public read access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public update access on app_settings" ON public.app_settings;

CREATE POLICY "Authenticated delete access on app_settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert access on app_settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated read access on app_settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated update access on app_settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (true);