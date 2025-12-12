-- Corrigir username e nome da ANA TESTE (e qualquer outro perfil com espaços extras)
UPDATE profiles 
SET 
  username = TRIM(username), 
  nome = TRIM(nome)
WHERE 
  username IS DISTINCT FROM TRIM(username) 
  OR nome IS DISTINCT FROM TRIM(nome);