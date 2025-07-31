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
