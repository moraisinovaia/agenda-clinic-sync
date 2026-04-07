import type { ScheduleRepository, ScheduleConfig } from '../interfaces/ScheduleRepository.ts';
import type { BusinessRulesRepository } from '../interfaces/BusinessRulesRepository.ts';
import { ScheduleInterpreter } from '../interpreters/ScheduleInterpreter.ts';

/**
 * Fachada de domínio: orquestra BusinessRulesRepository + ScheduleInterpreter
 * e expõe findByMedico() como único ponto de acesso à configuração de agenda.
 */
export class SupabaseScheduleRepository implements ScheduleRepository {
  private readonly interpreter = new ScheduleInterpreter();

  constructor(private readonly businessRulesRepo: BusinessRulesRepository) {}

  async findByMedico(params: {
    medicoId: string;
    clienteId: string;
    servicoKey?: string;
    minimumDate?: string;
  }): Promise<ScheduleConfig | null> {
    const raw = await this.businessRulesRepo.getRawConfig({
      medicoId: params.medicoId,
      clienteId: params.clienteId,
    });

    if (!raw) return null;

    return this.interpreter.interpret({
      rawConfig: raw.config,
      servicoKey: params.servicoKey,
      minimumDate: params.minimumDate,
    });
  }
}
