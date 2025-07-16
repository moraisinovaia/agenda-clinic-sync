-- Instruções para resetar a senha manualmente
-- Como não podemos alterar senhas diretamente via SQL por segurança,
-- vamos dar as opções disponíveis

DO $$
BEGIN
  RAISE NOTICE 'Opções para resolver o problema de login:';
  RAISE NOTICE '1. Use um navegador diferente ou modo incógnito';
  RAISE NOTICE '2. Limpe o cache completamente';
  RAISE NOTICE '3. Verifique se o link no email não expirou (válido por 1 hora)';
  RAISE NOTICE '4. Certifique-se de clicar no link completo do email';
  RAISE NOTICE '5. Como alternativa, podemos criar uma nova conta admin';
END $$;