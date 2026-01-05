
-- Teste de sincronização: atualizar idade_minima do Dr. Edson para 16
-- Isso deve disparar o trigger e atualizar business_rules SEM recursão infinita
UPDATE medicos 
SET idade_minima = 16, updated_at = now()
WHERE id = 'cdbfc594-d3de-459f-a9c1-a3f29842273e';
