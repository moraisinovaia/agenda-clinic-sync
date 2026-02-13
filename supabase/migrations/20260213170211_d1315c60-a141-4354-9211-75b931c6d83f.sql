
-- Restaurar permissões de tabela para o role authenticated
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.clientes TO authenticated;
