
CREATE OR REPLACE VIEW public.vw_meu_acesso AS
SELECT p.user_id, p.nome, p.email,
  COALESCE(perm.acesso_voucher, false) as acesso_voucher,
  COALESCE(perm.acesso_cadastrar_produto, false) as acesso_cadastrar_produto,
  COALESCE(perm.acesso_ficha_consumo, false) as acesso_ficha_consumo,
  COALESCE(perm.is_admin, false) as is_admin
FROM public.user_profiles p
LEFT JOIN public.user_permissions perm ON perm.user_id = p.user_id
WHERE p.user_id = auth.uid();
