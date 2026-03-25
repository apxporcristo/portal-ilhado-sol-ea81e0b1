-- Create packages table for managing time validity prices
CREATE TABLE public.pacotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tempo_validade TEXT NOT NULL UNIQUE,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access on pacotes" 
ON public.pacotes 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access on pacotes" 
ON public.pacotes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access on pacotes" 
ON public.pacotes 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access on pacotes" 
ON public.pacotes 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_pacotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pacotes_updated_at
BEFORE UPDATE ON public.pacotes
FOR EACH ROW
EXECUTE FUNCTION public.update_pacotes_updated_at();