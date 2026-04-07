import type { AppointmentRepository } from '../interfaces/AppointmentRepository.ts';
import type { ScheduleRepository } from '../interfaces/ScheduleRepository.ts';
import type { AvailableDay, AvailableWindow, PeriodKey } from '../domain/types.ts';

export interface CheckAvailabilityInput {
  medicoId: string;
  clienteId: string;
  /** Ponto de partida da busca (YYYY-MM-DD) */
  dataInicio: string;
  quantidadeDias: number;
  periodoPreferido?: PeriodKey | null;
  /** Dia da semana preferido (0=dom … 6=sab) */
  diaPreferido?: number | null;
  /** Chave do serviço para o ScheduleRepository resolver a config correta */
  servicoKey?: string;
  /** Data mínima de agendamento (clinic_info.data_minima_agendamento) */
  minimumDate?: string;
  /** Quantas datas com vaga são suficientes. Default: 3 (ou 5 se periodoPreferido) */
  datasNecessarias?: number;
}

export interface CheckAvailabilityOutput {
  diasDisponiveis: AvailableDay[];
}

const PERIOD_KEYS: PeriodKey[] = ['manha', 'tarde'];

export class CheckAvailabilityUseCase {
  constructor(
    private readonly repo: AppointmentRepository,
    private readonly scheduleRepo: ScheduleRepository,
  ) {}

  async execute(input: CheckAvailabilityInput): Promise<CheckAvailabilityOutput> {
    const {
      medicoId, clienteId, dataInicio, quantidadeDias,
      periodoPreferido, diaPreferido, servicoKey, minimumDate,
    } = input;

    const datasNecessarias = input.datasNecessarias ?? (periodoPreferido ? 5 : 3);

    // Buscar configuração canônica de agenda via ScheduleRepository
    const scheduleConfig = await this.scheduleRepo.findByMedico({
      medicoId,
      clienteId,
      servicoKey,
      minimumDate,
    });

    // Sem configuração → sem disponibilidade
    if (!scheduleConfig) {
      return { diasDisponiveis: [] };
    }

    const { bookingMode, periodos, diasSemana } = scheduleConfig;
    const diasDisponiveis: AvailableDay[] = [];

    for (let i = 0; i <= quantidadeDias; i++) {
      if (diasDisponiveis.length >= datasNecessarias) break;

      const date = new Date(dataInicio + 'T00:00:00');
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const weekday = date.getDay();

      // Pular fins de semana
      if (weekday === 0 || weekday === 6) continue;

      // Filtrar por dia da semana preferido
      if (diaPreferido != null && weekday !== diaPreferido) continue;

      // Verificar dias permitidos pela agenda
      if (diasSemana && !diasSemana.includes(weekday)) continue;

      const windows: AvailableWindow[] = [];

      for (const periodKey of PERIOD_KEYS) {
        const config = periodos?.[periodKey];
        if (!config) continue;

        // Filtrar por período preferido
        if (periodoPreferido != null && periodoPreferido !== periodKey) continue;

        // Verificar se o dia é permitido para este período
        const diaPermitido =
          !config.dias_especificos || config.dias_especificos.includes(weekday);
        if (!diaPermitido) continue;

        const occupied = bookingMode === 'time_slot'
          ? await this.repo.countByPeriod({
              medicoId, clienteId,
              date: dateStr,
              start: config.inicio,
              end: config.fim,
              minimumDate,
            })
          : await this.repo.countByPool({
              medicoId, clienteId,
              date: dateStr,
              poolStart: config.inicio,
              poolEnd: config.fim,
              minimumDate,
            });

        const available = config.limite - occupied;
        if (available <= 0) continue;

        windows.push({
          periodKey,
          start: config.inicio,
          end: config.fim,
          available,
          capacity: config.limite,
          bookingMode,
        });
      }

      if (windows.length > 0) {
        diasDisponiveis.push({ date: dateStr, weekday, windows });
      }
    }

    return { diasDisponiveis };
  }
}
