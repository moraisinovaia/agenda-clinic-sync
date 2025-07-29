-- Limpar todos os agendamentos existentes
DELETE FROM public.agendamentos;

-- Adicionar campos de auditoria necessários na tabela agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS cancelado_por TEXT,
ADD COLUMN IF NOT EXISTS cancelado_por_user_id UUID,
ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmado_por TEXT,
ADD COLUMN IF NOT EXISTS confirmado_por_user_id UUID,
ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMP WITH TIME ZONE;

-- Função para soft delete de agendamentos
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_soft(
  p_agendamento_id UUID,
  p_cancelado_por TEXT,
  p_cancelado_por_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar o agendamento para cancelado
  UPDATE public.agendamentos 
  SET 
    status = 'cancelado',
    cancelado_por = p_cancelado_por,
    cancelado_por_user_id = p_cancelado_por_user_id,
    cancelado_em = NOW(),
    updated_at = NOW()
  WHERE id = p_agendamento_id 
    AND status IN ('agendado', 'confirmado');

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Agendamento não encontrado ou já foi cancelado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Agendamento cancelado com sucesso'
  );
END;
$$;

-- Função para confirmar agendamentos
CREATE OR REPLACE FUNCTION public.confirmar_agendamento(
  p_agendamento_id UUID,
  p_confirmado_por TEXT,
  p_confirmado_por_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar o agendamento para confirmado
  UPDATE public.agendamentos 
  SET 
    status = 'confirmado',
    confirmado_por = p_confirmado_por,
    confirmado_por_user_id = p_confirmado_por_user_id,
    confirmado_em = NOW(),
    updated_at = NOW()
  WHERE id = p_agendamento_id 
    AND status = 'agendado';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Agendamento não encontrado ou não pode ser confirmado'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Agendamento confirmado com sucesso'
  );
END;
$$;

-- Atualizar função buscar_agendamentos_otimizado para filtrar cancelados
CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado()
RETURNS TABLE(
  id uuid,
  paciente_id uuid,
  medico_id uuid,
  atendimento_id uuid,
  data_agendamento date,
  hora_agendamento time without time zone,
  status text,
  observacoes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  criado_por text,
  criado_por_user_id uuid,
  paciente_nome text,
  paciente_convenio text,
  paciente_celular text,
  medico_nome text,
  medico_especialidade text,
  atendimento_nome text,
  atendimento_tipo text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  WHERE a.status != 'cancelado' -- Não mostrar agendamentos cancelados
  ORDER BY a.data_agendamento ASC, a.hora_agendamento ASC;
$$;