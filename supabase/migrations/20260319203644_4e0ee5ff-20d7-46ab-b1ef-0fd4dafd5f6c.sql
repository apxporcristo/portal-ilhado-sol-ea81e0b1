
ALTER TABLE public.fichas_impressoes ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES public.formas_pagamento(id) ON DELETE SET NULL;
ALTER TABLE public.fichas_impressoes ADD COLUMN IF NOT EXISTS forma_pagamento_nome text;
