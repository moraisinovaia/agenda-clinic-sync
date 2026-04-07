import type { BookingMode, PeriodKey, PeriodConfig, OrdemChegadaConfig } from '../domain/types.ts';

/**
 * Configuração canônica de agenda — saída do ScheduleInterpreter.
 * Substitui ScheduleHint (removido em Fase 4).
 */
export interface ScheduleConfig {
  bookingMode: BookingMode;
  periodos: Partial<Record<PeriodKey, PeriodConfig>>;
  diasSemana?: number[];
  ordemChegadaConfig?: OrdemChegadaConfig;
  minimumDate?: string;
}

export interface ScheduleRepository {
  /**
   * Retorna a configuração canônica de agenda para um médico/serviço.
   * Retorna null se não houver configuração válida (médico sem business_rules).
   */
  findByMedico(params: {
    medicoId: string;
    clienteId: string;
    servicoKey?: string;
    minimumDate?: string;
  }): Promise<ScheduleConfig | null>;
}
