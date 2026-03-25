
CREATE TABLE public.fichas_impressas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.fichas_produtos(id),
  produto_nome text NOT NULL,
  categoria_id uuid NOT NULL,
  categoria_nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  nome_cliente text,
  telefone_cliente text,
  nome_atendente text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fichas_impressas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fichas_impressas" ON public.fichas_impressas FOR SELECT TO public USING (true);
CREATE POLICY "Public insert fichas_impressas" ON public.fichas_impressas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public delete fichas_impressas" ON public.fichas_impressas FOR DELETE TO public USING (true);
