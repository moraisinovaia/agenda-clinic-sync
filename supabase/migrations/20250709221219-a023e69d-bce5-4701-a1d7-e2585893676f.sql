-- Corrigir constraint do campo criado_por na tabela agendamentos
ALTER TABLE public.agendamentos DROP CONSTRAINT IF EXISTS agendamentos_criado_por_check;

-- Criar novo constraint mais flexível para criado_por
ALTER TABLE public.agendamentos 
ADD CONSTRAINT agendamentos_criado_por_check 
CHECK (criado_por IN ('recepcionista', 'Recepcionista', 'n8n_agent', 'sistema'));

-- Corrigir políticas RLS da tabela profiles para permitir inserção automática
DROP POLICY IF EXISTS "Usuários podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;

-- Políticas RLS mais permissivas para profiles
CREATE POLICY "Permitir leitura de perfis autenticados" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção de perfis" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Permitir inserção de perfis pelo trigger de criação de usuário
CREATE POLICY "Permitir inserção por trigger de usuário" 
ON public.profiles 
FOR INSERT 
TO service_role 
WITH CHECK (true);

-- Garantir que o campo celular em pacientes pode ser vazio ou nulo temporariamente
ALTER TABLE public.pacientes ALTER COLUMN celular DROP NOT NULL;
ALTER TABLE public.pacientes ALTER COLUMN celular SET DEFAULT '';

-- Atualizar qualquer valor nulo existente
UPDATE public.pacientes SET celular = '' WHERE celular IS NULL;