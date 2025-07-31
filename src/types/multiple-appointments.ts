export interface MultipleAppointmentData {
  nomeCompleto: string;
  dataNascimento: string;
  convenio: string;
  telefone: string;
  celular: string;
  medicoId: string;
  atendimentoIds: string[];
  dataAgendamento: string;
  horaAgendamento: string;
  observacoes?: string;
}

export interface SelectedExam {
  id: string;
  nome: string;
  tipo: string;
}

export interface MultipleAppointmentResult {
  success: boolean;
  agendamento_ids?: string[];
  total_agendamentos?: number;
  atendimentos?: string[];
  message?: string;
  error?: string;
}