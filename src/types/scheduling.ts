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
  medicoId: string;
  atendimentoId: string;
  dataAgendamento: string;
  horaAgendamento: string;
  observacoes?: string;
}