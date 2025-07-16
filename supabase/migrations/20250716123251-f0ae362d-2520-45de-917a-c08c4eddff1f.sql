-- Resetar a senha da conta de administradora Gabriela Morais
-- Como não podemos alterar senhas diretamente via SQL por motivos de segurança,
-- vamos criar um usuário temporário para ela poder acessar e depois alterar a senha

-- Verificar se a conta existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'moraisinovaiacloud@gmail.com'
  ) THEN
    RAISE NOTICE 'Conta encontrada: moraisinovaiacloud@gmail.com';
    RAISE NOTICE 'Instruções: Use a funcionalidade de "Esqueci minha senha" na tela de login';
    RAISE NOTICE 'Ou solicite que o administrador do sistema redefina a senha manualmente';
  ELSE
    RAISE NOTICE 'Conta não encontrada no sistema de autenticação';
  END IF;
END $$;