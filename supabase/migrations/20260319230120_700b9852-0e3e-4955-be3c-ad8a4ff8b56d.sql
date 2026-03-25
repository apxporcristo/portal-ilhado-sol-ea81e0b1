
ALTER TABLE fichas_categorias RENAME COLUMN nome TO nome_categoria;
ALTER TABLE fichas_produtos RENAME COLUMN nome TO nome_produto;

DROP VIEW IF EXISTS vw_fichas_ativas;
CREATE VIEW vw_fichas_ativas AS
SELECT p.id,
  p.nome_produto,
  p.valor,
  p.categoria_id,
  c.nome_categoria AS categoria_nome,
  c.exigir_dados_cliente,
  c.exigir_dados_atendente,
  p.created_at
FROM fichas_produtos p
JOIN fichas_categorias c ON p.categoria_id = c.id
WHERE p.ativo = true AND c.ativo = true;
