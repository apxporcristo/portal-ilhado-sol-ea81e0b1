
CREATE TABLE public.formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  exibir_troco boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read formas_pagamento" ON public.formas_pagamento FOR SELECT TO public USING (true);
CREATE POLICY "Public insert formas_pagamento" ON public.formas_pagamento FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update formas_pagamento" ON public.formas_pagamento FOR UPDATE TO public USING (true);
CREATE POLICY "Public delete formas_pagamento" ON public.formas_pagamento FOR DELETE TO public USING (true);
CREATE TRIGGER update_formas_pagamento_updated_at BEFORE UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION update_fichas_updated_at();
