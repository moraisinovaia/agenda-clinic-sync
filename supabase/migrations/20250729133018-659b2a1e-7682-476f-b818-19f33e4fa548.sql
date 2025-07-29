-- Remover a constraint restritiva do campo criado_por para permitir nomes de usuários reais
ALTER TABLE public.agendamentos 
DROP CONSTRAINT IF EXISTS agendamentos_criado_por_check;

-- Atualizar dados históricos onde criado_por está como 'Recepcionista' mas temos o user_id do profile
UPDATE public.agendamentos 
SET criado_por = p.nome
FROM public.profiles p
WHERE agendamentos.criado_por_user_id = p.user_id 
  AND agendamentos.criado_por = 'Recepcionista'
  AND p.nome IS NOT NULL
  AND p.nome != '';

-- Criar uma nova constraint mais flexível que permite nomes de usuários ou valores do sistema
ALTER TABLE public.agendamentos 
ADD CONSTRAINT agendamentos_criado_por_check 
CHECK (
  criado_por IS NOT NULL 
  AND LENGTH(TRIM(criado_por)) > 0
);