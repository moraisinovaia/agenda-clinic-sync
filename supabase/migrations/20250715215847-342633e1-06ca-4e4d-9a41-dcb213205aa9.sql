-- Add approval system columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN status character varying DEFAULT 'pendente' NOT NULL,
ADD COLUMN aprovado_por uuid REFERENCES public.profiles(id),
ADD COLUMN data_aprovacao timestamp with time zone;

-- Create index for better performance on status queries
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- Update existing users to be approved (so current users can continue working)
UPDATE public.profiles SET status = 'aprovado', data_aprovacao = now() WHERE status = 'pendente';

-- Create a view for pending approvals
CREATE OR REPLACE VIEW vw_usuarios_pendentes AS
SELECT 
  p.id,
  p.nome,
  p.email,
  p.username,
  p.role,
  p.created_at,
  aprovador.nome as aprovado_por_nome
FROM public.profiles p
LEFT JOIN public.profiles aprovador ON p.aprovado_por = aprovador.id
WHERE p.status = 'pendente'
ORDER BY p.created_at ASC;

-- Function to approve user
CREATE OR REPLACE FUNCTION public.aprovar_usuario(
  p_user_id uuid,
  p_aprovador_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o aprovador é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem aprovar usuários'
    );
  END IF;

  -- Aprovar o usuário
  UPDATE public.profiles 
  SET 
    status = 'aprovado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário aprovado com sucesso'
  );
END;
$$;

-- Function to reject user
CREATE OR REPLACE FUNCTION public.rejeitar_usuario(
  p_user_id uuid,
  p_aprovador_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o aprovador é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_aprovador_id 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem rejeitar usuários'
    );
  END IF;

  -- Rejeitar o usuário
  UPDATE public.profiles 
  SET 
    status = 'rejeitado',
    aprovado_por = p_aprovador_id,
    data_aprovacao = now()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário rejeitado'
  );
END;
$$;

-- Update RLS policies to consider approval status
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_approved" ON public.profiles
FOR SELECT USING (status = 'aprovado');

-- Allow admins to see all profiles for approval purposes
CREATE POLICY "admins_can_see_all_profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.status = 'aprovado'
  )
);

-- Allow users to see their own profile even if pending
CREATE POLICY "users_can_see_own_profile" ON public.profiles
FOR SELECT USING (user_id = auth.uid());