-- Adicionar campo para rastrear quem alterou o agendamento
ALTER TABLE public.agendamentos 
ADD COLUMN alterado_por_user_id UUID;

-- Criar trigger para atualizar automaticamente quando há alterações
CREATE OR REPLACE FUNCTION public.update_alterado_por()
RETURNS TRIGGER AS $$
BEGIN
  -- Só atualizar se houve mudança real nos dados importantes  
  IF (OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento OR
      OLD.hora_agendamento IS DISTINCT FROM NEW.hora_agendamento OR 
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.observacoes IS DISTINCT FROM NEW.observacoes OR
      OLD.medico_id IS DISTINCT FROM NEW.medico_id OR
      OLD.atendimento_id IS DISTINCT FROM NEW.atendimento_id) THEN
    
    NEW.alterado_por_user_id = auth.uid();
    NEW.updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_alterado_por ON public.agendamentos;
CREATE TRIGGER trigger_update_alterado_por
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alterado_por();

-- Atualizar a função buscar_agendamentos_otimizado para incluir dados de alteração
DROP FUNCTION IF EXISTS public.buscar_agendamentos_otimizado();

CREATE OR REPLACE FUNCTION public.buscar_agendamentos_otimizado()
RETURNS TABLE(
  id uuid, 
  paciente_id uuid, 
  medico_id uuid, 
  atendimento_id uuid, 
  data_agendamento date, 
  hora_agendamento time without time zone, 
  status character varying, 
  convenio character varying, 
  observacoes text, 
  criado_por text, 
  criado_por_user_id uuid, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  paciente_nome character varying, 
  paciente_data_nascimento date, 
  paciente_convenio character varying, 
  paciente_telefone character varying, 
  paciente_celular character varying, 
  medico_nome character varying, 
  medico_especialidade character varying, 
  atendimento_nome character varying, 
  atendimento_tipo character varying, 
  cancelado_por text, 
  cancelado_por_user_id uuid, 
  cancelado_em timestamp with time zone, 
  confirmado_por text, 
  confirmado_por_user_id uuid, 
  confirmado_em timestamp with time zone,
  alterado_por_user_id uuid,
  -- Campos do perfil do criador
  profile_nome text,
  profile_email text,
  profile_role text,
  -- Campos do perfil de quem alterou
  alterado_por_profile_nome text,
  alterado_por_profile_email text,
  alterado_por_profile_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.paciente_id,
    a.medico_id,
    a.atendimento_id,
    a.data_agendamento,
    a.hora_agendamento,
    a.status,
    a.convenio,
    a.observacoes,
    a.criado_por,
    a.criado_por_user_id,
    a.created_at,
    a.updated_at,
    p.nome_completo AS paciente_nome,
    p.data_nascimento AS paciente_data_nascimento,
    p.convenio AS paciente_convenio,
    p.telefone AS paciente_telefone,
    p.celular AS paciente_celular,
    m.nome AS medico_nome,
    m.especialidade AS medico_especialidade,
    at.nome AS atendimento_nome,
    at.tipo AS atendimento_tipo,
    a.cancelado_por,
    a.cancelado_por_user_id,
    a.cancelado_em,
    a.confirmado_por,
    a.confirmado_por_user_id,
    a.confirmado_em,
    a.alterado_por_user_id,
    -- Dados do perfil de quem criou o agendamento
    prof_criador.nome AS profile_nome,
    prof_criador.email AS profile_email,
    prof_criador.role AS profile_role,
    -- Dados do perfil de quem alterou o agendamento
    prof_alterou.nome AS alterado_por_profile_nome,
    prof_alterou.email AS alterado_por_profile_email,
    prof_alterou.role AS alterado_por_profile_role
  FROM public.agendamentos a
  LEFT JOIN public.pacientes p ON a.paciente_id = p.id
  LEFT JOIN public.medicos m ON a.medico_id = m.id
  LEFT JOIN public.atendimentos at ON a.atendimento_id = at.id
  LEFT JOIN public.profiles prof_criador ON a.criado_por_user_id = prof_criador.user_id
  LEFT JOIN public.profiles prof_alterou ON a.alterado_por_user_id = prof_alterou.user_id
  ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC;
END;
$function$