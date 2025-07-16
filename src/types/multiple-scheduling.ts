export interface MultipleSchedulingFormData {
  nomeCompleto: string;
  dataNascimento: string;
  convenio: string;
  telefone: string;
  celular: string;
  medicoId: string;
  atendimentoIds: string[]; // Array de IDs dos atendimentos selecionados
  dataAgendamento: string;
  horaAgendamento: string;
  observacoes?: string;
}

export interface ExamCompatibility {
  atendimento1_id: string;
  atendimento1_nome: string;
  atendimento1_tipo: string;
  atendimento2_id: string;
  atendimento2_nome: string;
  atendimento2_tipo: string;
  medico_id: string;
  medico_nome: string;
  compativel: boolean;
  motivo_compatibilidade: string;
}

export interface MultipleAppointmentResult {
  success: boolean;
  agendamento_ids?: string[];
  paciente_id?: string;
  total_agendamentos?: number;
  atendimentos?: string[];
  message: string;
  error?: string;
}