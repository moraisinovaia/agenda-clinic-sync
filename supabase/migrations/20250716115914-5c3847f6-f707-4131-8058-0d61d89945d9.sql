-- Corrigir as demais funções que ainda não possuem search_path

-- Função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'recepcionista'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Função aprovar_usuario (já tem search_path, mas vamos garantir que está correto)
CREATE OR REPLACE FUNCTION public.aprovar_usuario(p_user_id uuid, p_aprovador_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Função rejeitar_usuario (já tem search_path, mas vamos garantir que está correto)
CREATE OR REPLACE FUNCTION public.rejeitar_usuario(p_user_id uuid, p_aprovador_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Função buscar_agendamentos_otimizado (já tem search_path, mas vamos garantir)
CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado()
 RETURNS TABLE(id uuid, paciente_id uuid, medico_id uuid, atendimento_id uuid, data_agendamento date, hora_agendamento time without time zone, status text, observacoes text, created_at timestamp with time zone, updated_at timestamp with time zone, criado_por text, criado_por_user_id uuid, paciente_nome text, paciente_convenio text, paciente_celular text, medico_nome text, medico_especialidade text, atendimento_nome text, atendimento_tipo text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    a.id,
    a.paciente_id,
    a.medico_id,
    a.atendimento_id,
    a.data_agendamento,
    a.hora_agendamento,
    a.status,
    a.observacoes,
    a.created_at,
    a.updated_at,
    a.criado_por,
    a.criado_por_user_id,
    p.nome_completo as paciente_nome,
    p.convenio as paciente_convenio,
    p.celular as paciente_celular,
    m.nome as medico_nome,
    m.especialidade as medico_especialidade,
    at.nome as atendimento_nome,
    at.tipo as atendimento_tipo
  FROM public.agendamentos a
  JOIN public.pacientes p ON a.paciente_id = p.id
  JOIN public.medicos m ON a.medico_id = m.id
  JOIN public.atendimentos at ON a.atendimento_id = at.id
  ORDER BY a.data_agendamento ASC, a.hora_agendamento ASC;
$function$;