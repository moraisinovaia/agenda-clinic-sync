-- Limpeza dos usuários - manter apenas admin principal (gabworais@gmail.com)
-- Esta migration remove todos os funcionários antigos e mantém apenas o admin principal

-- Log da operação de limpeza
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Iniciando limpeza de usuários - mantendo apenas admin principal',
  'USER_CLEANUP',
  jsonb_build_object(
    'operacao', 'limpeza_usuarios',
    'admin_preservado', 'gabworais@gmail.com',
    'motivo', 'Troca de funcionários - nova estrutura da clínica'
  )
);

-- Identificar e preservar apenas o admin principal
-- Remover todos os perfis exceto o da Gabriela (gabworais@gmail.com)
DELETE FROM public.profiles 
WHERE email != 'gabworais@gmail.com';

-- Remover todos os usuários da tabela auth.users exceto o admin principal
-- (usando email para identificar)
DELETE FROM auth.users 
WHERE email != 'gabworais@gmail.com';

-- Log final da limpeza
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Limpeza de usuários concluída com sucesso',
  'USER_CLEANUP_COMPLETE',
  jsonb_build_object(
    'usuarios_removidos', 'todos_exceto_admin',
    'admin_mantido', 'gabworais@gmail.com',
    'status', 'sucesso'
  )
);

-- Verificação final - mostrar usuários restantes
-- (Esta query será executada para confirmar o resultado)
SELECT 
  p.id,
  p.nome,
  p.email,
  p.role,
  p.status,
  p.created_at
FROM public.profiles p
ORDER BY p.created_at;