
-- Update the RPC to accept new fields
CREATE OR REPLACE FUNCTION public.registrar_impressao_fichas(
  p_produto_id uuid, 
  p_quantidade integer, 
  p_valor_unitario numeric,
  p_nome_cliente text DEFAULT NULL,
  p_documento_cliente text DEFAULT NULL,
  p_telefone_cliente text DEFAULT NULL,
  p_nome_atendente text DEFAULT NULL,
  p_codigo_atendente text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.fichas_impressoes (
    produto_id, quantidade, valor_unitario, valor_total,
    nome_cliente, documento_cliente, telefone_cliente,
    nome_atendente, codigo_atendente
  )
  VALUES (
    p_produto_id, p_quantidade, p_valor_unitario, p_valor_unitario * p_quantidade,
    p_nome_cliente, p_documento_cliente, p_telefone_cliente,
    p_nome_atendente, p_codigo_atendente
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Recreate view with new columns
DROP VIEW IF EXISTS public.vw_fichas_ativas;

CREATE VIEW public.vw_fichas_ativas AS
SELECT 
  p.id,
  p.nome,
  p.valor,
  p.categoria_id,
  c.nome AS categoria_nome,
  c.exigir_dados_cliente,
  c.exigir_dados_atendente,
  p.created_at
FROM public.fichas_produtos p
JOIN public.fichas_categorias c ON p.categoria_id = c.id
WHERE p.ativo = true AND c.ativo = true;
