// Tipos específicos para as funções atômicas de agendamento

export interface AtomicAppointmentResult {
  success: boolean;
  agendamento_id?: string;
  paciente_id?: string;
  message?: string;
  error?: string;
}

export interface AtomicAppointmentParams {
  p_nome_completo: string;
  p_data_nascimento: string;
  p_convenio: string;
  p_telefone: string | null;
  p_celular: string;
  p_medico_id: string;
  p_atendimento_id: string;
  p_data_agendamento: string;
  p_hora_agendamento: string;
  p_observacoes: string | null;
  p_criado_por: string;
  p_criado_por_user_id: string | null;
}

export interface OptimizedAppointmentRow {
  id: string;
  paciente_id: string;
  medico_id: string;
  atendimento_id: string;
  data_agendamento: string;
  hora_agendamento: string;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  criado_por: string;
  criado_por_user_id: string | null;
  paciente_nome: string;
  paciente_convenio: string;
  paciente_celular: string;
  medico_nome: string;
  medico_especialidade: string;
  atendimento_nome: string;
  atendimento_tipo: string;
}