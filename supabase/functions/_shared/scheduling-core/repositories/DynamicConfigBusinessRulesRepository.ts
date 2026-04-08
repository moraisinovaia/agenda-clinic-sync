import type {
  BusinessRulesRepository,
  RawBusinessRules,
} from '../interfaces/BusinessRulesRepository.ts';
import type { RawConfig } from '../interpreters/ScheduleInterpreter.ts';

/** Formato mínimo do DynamicConfig consumido por este repositório. */
interface DynamicConfigShape {
  business_rules?: Record<string, { config?: RawConfig }>;
}

/**
 * Implementação Opção B: lê do DynamicConfig já carregado em memória.
 * Zero queries extras por request. Acopla-se ao tipo DynamicConfig do adapter —
 * dívida conhecida a resolver quando DynamicConfig for descontinuado (Onda 3).
 */
export class DynamicConfigBusinessRulesRepository implements BusinessRulesRepository {
  constructor(private readonly dynamicConfig: DynamicConfigShape) {}

  getRawConfig(params: {
    medicoId: string;
    clienteId: string;
  }): Promise<RawBusinessRules | null> {
    const entry = this.dynamicConfig?.business_rules?.[params.medicoId];
    if (!entry?.config) return Promise.resolve(null);
    return Promise.resolve({ config: entry.config });
  }
}
