import type { BookingMode, PeriodKey, PeriodConfig, OrdemChegadaConfig } from '../domain/types.ts';
import type { ScheduleConfig } from '../interfaces/ScheduleRepository.ts';

/**
 * Transforma o JSON bruto de business_rules em ScheduleConfig canônico.
 * Função pura — sem I/O. Todos os detalhes do JSONB heterogêneo ficam aqui.
 */
export class ScheduleInterpreter {
  interpret(params: {
    rawConfig: Record<string, any>;
    servicoKey?: string;
    minimumDate?: string;
  }): ScheduleConfig | null {
    const { rawConfig, servicoKey, minimumDate } = params;

    // 1. Resolver configuração do serviço
    const servico = this.resolveServico(rawConfig, servicoKey);

    // 2. Resolver booking mode: serviço.tipo → raiz.tipo_agendamento → fallback
    const rawTipo: string =
      servico?.tipo ||
      servico?.tipo_agendamento ||
      rawConfig.tipo_agendamento ||
      'ordem_chegada';

    const bookingMode: BookingMode =
      rawTipo === 'hora_marcada' ? 'time_slot' : 'capacity_window';

    // 3. Resolver períodos
    const periodos = this.normalizePeriodos(servico?.periodos ?? rawConfig.periodos);
    if (!periodos || Object.keys(periodos).length === 0) {
      return null;
    }

    // 4. Resolver dias da semana
    const diasSemana: number[] | undefined =
      servico?.dias_semana ?? rawConfig.dias_semana ?? undefined;

    // 5. Resolver ordem_chegada_config
    const ordemChegadaConfig: OrdemChegadaConfig | undefined =
      rawConfig.ordem_chegada_config ?? servico?.ordem_chegada_config ?? undefined;

    return {
      bookingMode,
      periodos,
      diasSemana,
      ordemChegadaConfig,
      minimumDate,
    };
  }

  // ─── private ────────────────────────────────────────────────────────────────

  private resolveServico(
    rawConfig: Record<string, any>,
    servicoKey?: string,
  ): Record<string, any> | null {
    const servicos = rawConfig.servicos;
    if (!servicos || typeof servicos !== 'object') return null;

    if (servicoKey && servicos[servicoKey]) {
      return servicos[servicoKey];
    }

    // Fallback: primeiro serviço com períodos configurados
    const found = Object.values(servicos).find(
      (s: any) => s?.periodos && Object.keys(s.periodos).length > 0,
    );
    return (found as Record<string, any>) ?? null;
  }

  private normalizePeriodos(
    periodos: Record<string, any> | null | undefined,
  ): Partial<Record<PeriodKey, PeriodConfig>> {
    if (!periodos || typeof periodos !== 'object') return {};

    const result: Partial<Record<PeriodKey, PeriodConfig>> = {};

    for (const [key, raw] of Object.entries(periodos)) {
      if (key !== 'manha' && key !== 'tarde') continue;
      const normalized = this.normalizePeriodo(raw);
      if (normalized) result[key as PeriodKey] = normalized;
    }

    return result;
  }

  private normalizePeriodo(raw: any): PeriodConfig | null {
    if (!raw || typeof raw !== 'object') return null;

    // Aceitar ambas nomenclaturas (inicio/horario_inicio, fim/horario_fim)
    const inicio: string = raw.inicio ?? raw.horario_inicio ?? '';
    const fim: string = raw.fim ?? raw.horario_fim ?? '';
    const limite: number = Number(raw.limite ?? raw.limite_pacientes ?? 0);

    if (!inicio || !fim || limite <= 0) return null;

    return {
      inicio,
      fim,
      limite,
      dias_especificos: raw.dias_especificos ?? undefined,
      distribuicao_fichas: raw.distribuicao_fichas ?? undefined,
    };
  }
}
