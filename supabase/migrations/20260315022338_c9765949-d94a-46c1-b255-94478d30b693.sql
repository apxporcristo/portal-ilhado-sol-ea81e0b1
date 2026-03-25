
-- Add exigir_dados columns to categorias
ALTER TABLE public.fichas_categorias 
ADD COLUMN IF NOT EXISTS exigir_dados_cliente boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS exigir_dados_atendente boolean NOT NULL DEFAULT false;

-- Add client/attendant fields to impressoes
ALTER TABLE public.fichas_impressoes
ADD COLUMN IF NOT EXISTS nome_cliente text,
ADD COLUMN IF NOT EXISTS documento_cliente text,
ADD COLUMN IF NOT EXISTS telefone_cliente text,
ADD COLUMN IF NOT EXISTS nome_atendente text,
ADD COLUMN IF NOT EXISTS codigo_atendente text;
