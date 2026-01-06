-- Conceder permissões para a tabela recursos_equipamentos
GRANT ALL ON TABLE public.recursos_equipamentos TO authenticated;
GRANT ALL ON TABLE public.recursos_equipamentos TO service_role;
GRANT SELECT ON TABLE public.recursos_equipamentos TO anon;

-- Conceder permissões para a tabela distribuicao_recursos
GRANT ALL ON TABLE public.distribuicao_recursos TO authenticated;
GRANT ALL ON TABLE public.distribuicao_recursos TO service_role;
GRANT SELECT ON TABLE public.distribuicao_recursos TO anon;