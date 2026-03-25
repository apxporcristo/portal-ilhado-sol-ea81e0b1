
-- Tabela de categorias de fichas
CREATE TABLE public.fichas_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fichas_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fichas_categorias" ON public.fichas_categorias FOR SELECT TO public USING (true);
CREATE POLICY "Public insert fichas_categorias" ON public.fichas_categorias FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update fichas_categorias" ON public.fichas_categorias FOR UPDATE TO public USING (true);
CREATE POLICY "Public delete fichas_categorias" ON public.fichas_categorias FOR DELETE TO public USING (true);

-- Tabela de produtos de fichas
CREATE TABLE public.fichas_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.fichas_categorias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fichas_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fichas_produtos" ON public.fichas_produtos FOR SELECT TO public USING (true);
CREATE POLICY "Public insert fichas_produtos" ON public.fichas_produtos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update fichas_produtos" ON public.fichas_produtos FOR UPDATE TO public USING (true);
CREATE POLICY "Public delete fichas_produtos" ON public.fichas_produtos FOR DELETE TO public USING (true);

-- Tabela de impressões de fichas
CREATE TABLE public.fichas_impressoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.fichas_produtos(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fichas_impressoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fichas_impressoes" ON public.fichas_impressoes FOR SELECT TO public USING (true);
CREATE POLICY "Public insert fichas_impressoes" ON public.fichas_impressoes FOR INSERT TO public WITH CHECK (true);

-- View de fichas ativas
CREATE OR REPLACE VIEW public.vw_fichas_ativas AS
SELECT 
  p.id,
  p.nome,
  p.valor,
  p.categoria_id,
  c.nome AS categoria_nome,
  p.created_at
FROM public.fichas_produtos p
JOIN public.fichas_categorias c ON c.id = p.categoria_id
WHERE p.ativo = true AND c.ativo = true
ORDER BY c.nome, p.nome;

-- RPC para registrar impressão
CREATE OR REPLACE FUNCTION public.registrar_impressao_fichas(
  p_produto_id uuid,
  p_quantidade integer,
  p_valor_unitario numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.fichas_impressoes (produto_id, quantidade, valor_unitario, valor_total)
  VALUES (p_produto_id, p_quantidade, p_valor_unitario, p_valor_unitario * p_quantidade)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_fichas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_fichas_categorias_updated_at
  BEFORE UPDATE ON public.fichas_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_fichas_updated_at();

CREATE TRIGGER tr_fichas_produtos_updated_at
  BEFORE UPDATE ON public.fichas_produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_fichas_updated_at();
