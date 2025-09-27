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
  cancelado_por: string;
  cancelado_por_user_id: string;
  cancelado_em: string;
  confirmado_por: string;
  confirmado_por_user_id: string;
  confirmado_em: string;
  alterado_por_user_id: string;
  excluido_por: string;
  excluido_por_user_id: string;
  excluido_em: string;
  profile_nome: string;
  profile_email: string;
  profile_role: string;
  alterado_por_profile_nome: string;
  alterado_por_profile_email: string;
  alterado_por_profile_role: string;
}

export interface AppointmentWithRelations extends Appointment {
  pacientes: Patient | null;
  medicos: Doctor | null;
  atendimentos: Atendimento | null;
  excluido_por?: string | null;
  excluido_por_user_id?: string | null;
  excluido_em?: string | null;
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
