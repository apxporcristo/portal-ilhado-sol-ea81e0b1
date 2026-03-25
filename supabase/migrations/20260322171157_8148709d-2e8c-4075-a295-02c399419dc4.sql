ALTER TABLE public.fichas_produtos 
  ADD COLUMN IF NOT EXISTS tem_complementos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forma_venda text NOT NULL DEFAULT 'unitario',
  ADD COLUMN IF NOT EXISTS valor_por_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS obs text;