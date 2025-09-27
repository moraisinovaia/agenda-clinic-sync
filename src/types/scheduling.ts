import { Tables } from '@/integrations/supabase/types';

// Tipos baseados nas tabelas do Supabase
export type Doctor = Tables<'medicos'>;
export type Atendimento = Tables<'atendimentos'>;
export type Patient = Tables<'pacientes'>;
export type Appointment = Tables<'agendamentos'>;

// Tipos auxiliares para UI
export interface DoctorWithAtendimentos extends Doctor {
  atendimentos: Atendimento[];
}

// Tipos específicos para o resultado da busca otimizada com campos de exclusão
export interface OptimizedAppointmentRow {
  id: string;
  paciente_id: string;
  medico_id: string;
  atendimento_id: string;
  data_agendamento: string;
  hora_agendamento: string;
  status: string;
  convenio: string;
  observacoes: string;
  criado_por: string;
  criado_por_user_id: string;
  created_at: string;
  updated_at: string;
  paciente_nome: string;
  paciente_data_nascimento: string;
  paciente_convenio: string;
  paciente_telefone: string;
  paciente_celular: string;
  medico_nome: string;
  medico_especialidade: string;
  atendimento_nome: string;
  atendimento_tipo: string;
  cancelado_por: string | null;
  cancelado_por_user_id: string | null;
  cancelado_em: string | null;
  confirmado_por: string | null;
  confirmado_por_user_id: string | null;
  confirmado_em: string | null;
  alterado_por_user_id: string | null;
  excluido_por: string | null;
  excluido_por_user_id: string | null;
  excluido_em: string | null;
  profile_nome: string | null;
  profile_email: string | null;
  profile_role: string | null;
  alterado_por_profile_nome: string | null;
  alterado_por_profile_email: string | null;
  alterado_por_profile_role: string | null;
}

export interface AppointmentWithRelations extends Appointment {
  pacientes: Patient | null;
  medicos: Doctor | null;
  atendimentos: Atendimento | null;
  criado_por_profile?: {
    id: string;
    user_id: string;
    nome: string;
    email: string;
    role: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  alterado_por_profile?: {
    id: string;
    user_id: string;
    nome: string;
    email: string;
    role: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
  } | null;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
}

export interface SchedulingFormData {
  nomeCompleto: string;
  dataNascimento: string;
  convenio: string;
  telefone: string;
  celular: string;
  medicoId: string;
  atendimentoId: string;
  dataAgendamento: string;
  horaAgendamento: string;
  observacoes?: string;
}
