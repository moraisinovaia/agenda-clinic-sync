-- Força o reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- Garante que a função está acessível via RPC para roles anon e authenticated
GRANT EXECUTE ON FUNCTION public.listar_agendamentos_medico_dia(TEXT, DATE) TO anon, authenticated;

-- Comentário para documentação
COMMENT ON FUNCTION public.listar_agendamentos_medico_dia(TEXT, DATE) IS 
'Lista agendamentos de um médico em uma data específica.
Acessível via RPC para N8N workflows.
Roles permitidas: anon, authenticated';
