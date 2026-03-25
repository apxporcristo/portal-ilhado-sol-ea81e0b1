-- Create vouchers table
CREATE TABLE public.vouchers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_id TEXT NOT NULL UNIQUE,
    tempo_validade TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'livre' CHECK (status IN ('livre', 'usado')),
    data_uso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (for this internal system)
CREATE POLICY "Allow public read access" 
ON public.vouchers 
FOR SELECT 
USING (true);

-- Create policy for public insert access
CREATE POLICY "Allow public insert access" 
ON public.vouchers 
FOR INSERT 
WITH CHECK (true);

-- Create policy for public update access
CREATE POLICY "Allow public update access" 
ON public.vouchers 
FOR UPDATE 
USING (true);

-- Create index for faster queries by status and tempo_validade
CREATE INDEX idx_vouchers_status_tempo ON public.vouchers(status, tempo_validade);
CREATE INDEX idx_vouchers_data_uso ON public.vouchers(data_uso);