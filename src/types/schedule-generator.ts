export interface ScheduleConfiguration {
  id?: string;
  medico_id: string;
  dia_semana: number; // 0-6 (0=Domingo)
  periodo: 'manha' | 'tarde' | 'noite';
  hora_inicio: string; // HH:mm
  hora_fim: string; // HH:mm
  intervalo_minutos: 10 | 15 | 20 | 30;
  ativo: boolean;
  cliente_id?: string;
}

export interface EmptyTimeSlot {
  id?: string;
  medico_id: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:mm
  status: 'disponivel' | 'ocupado' | 'expirado';
  cliente_id?: string;
}

export interface GenerationConfig {
  medico_id: string;
  data_inicio: string;
  data_fim: string;
  configuracoes: ScheduleConfiguration[];
}

export interface GenerationResult {
  success: boolean;
  slots_criados: number;
  slots_ignorados: number;
  errors?: string[];
}

export interface DaySchedule {
  dia_semana: number;
  manha: {
    ativo: boolean;
    hora_inicio: string;
    hora_fim: string;
  };
  tarde: {
    ativo: boolean;
    hora_inicio: string;
    hora_fim: string;
  };
}
