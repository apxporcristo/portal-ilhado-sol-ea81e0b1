
-- Create temp_vouchers table for staging
CREATE TABLE public.temp_vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id text NOT NULL,
  tempo_validade text NOT NULL,
  status text NOT NULL DEFAULT 'livre'::text,
  data_uso timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.temp_vouchers ENABLE ROW LEVEL SECURITY;

-- Public access policies (matching vouchers table pattern)
CREATE POLICY "Allow public read access on temp_vouchers"
ON public.temp_vouchers FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on temp_vouchers"
ON public.temp_vouchers FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on temp_vouchers"
ON public.temp_vouchers FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on temp_vouchers"
ON public.temp_vouchers FOR DELETE USING (true);
