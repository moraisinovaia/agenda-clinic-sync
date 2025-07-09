import { Tables } from '@/integrations/supabase/types';

export type FilaEspera = Tables<'fila_espera'>;
export type FilaNotificacao = Tables<'fila_notificacoes'>;

export interface FilaEsperaWithRelations extends FilaEspera {
  pacientes: Tables<'pacientes'> | null;
  medicos: Tables<'medicos'> | null;
  atendimentos: Tables<'atendimentos'> | null;
  agendamentos: Tables<'agendamentos'> | null;
}

export interface FilaEsperaFormData {
  pacienteId: string;
  medicoId: string;
  atendimentoId: string;
  dataPreferida: string;
  periodoPreferido: 'manha' | 'tarde' | 'qualquer';
  observacoes?: string;
  prioridade: number;
  dataLimite?: string;
}

export interface FilaStatus {
  total: number;
  aguardando: number;
  notificado: number;
  agendado: number;
  cancelado: number;
}