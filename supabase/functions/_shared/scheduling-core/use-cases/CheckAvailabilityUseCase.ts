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
  /**
   * Restringe a contagem de ocupação aos atendimento_ids deste serviço/pool.
   * Sem isso, capacity_window vê todas as bookings do médico no intervalo de hora —
   * Consulta-tarde lota a janela MRPA-tarde mesmo sendo serviços distintos.
   * Vazio/undefined = sem restrição (compat).
   */
  atendimentoIds?: string[];
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
      atendimentoIds,
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
              atendimentoIds,
            })
          : await this.repo.countByPool({
              medicoId, clienteId,
              date: dateStr,
              poolStart: config.inicio,
              poolEnd: config.fim,
              minimumDate,
              atendimentoIds,
            });

        // 🛡️ STRICT: capacidade DEVE vir definida e > 0. Sem fallback fantasma.
        // Se a config não tem limite, este período NÃO é ofertado (em vez de inventar 1 vaga).
        if (!Number.isFinite(config.limite as number) || (config.limite as number) <= 0) {
          console.warn(`[CheckAvailability] Período ${periodKey} em ${dateStr} ignorado: limite inválido (${config.limite}) para medico=${medicoId}`);
          continue;
        }
        const capacity = config.limite as number;
        const available = Math.max(0, capacity - (occupied ?? 0));
        if (available <= 0) continue;

        windows.push({
          periodKey,
          start: config.inicio,
          end: config.fim,
          available,
          capacity,
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
