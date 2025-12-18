-- 1. Desativar "Teste Ergométrico" na agenda do Dr. Marcelo D'Carli
UPDATE public.atendimentos 
SET ativo = false 
WHERE id = '4a44b957-4c94-4e35-9f38-0f1f3f62f83c';

-- 2. Renomear atendimento da agenda separada para "Teste Ergométrico"
UPDATE public.atendimentos 
SET nome = 'Teste Ergométrico'
WHERE id = '1249a1f0-b1a9-4c50-b031-d41b0513118f';