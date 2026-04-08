import type { RawConfig } from '../interpreters/ScheduleInterpreter.ts';

/**
 * Acesso ao JSON bruto de business_rules por médico.
 * A implementação lê do DynamicConfig já carregado (Opção B) para evitar
 * query extra por request. Pode ser substituída por leitura direta ao banco
 * quando DynamicConfig for descontinuado (dívida Onda 3).
 */
export interface RawBusinessRules {
  /** JSON bruto do campo config da tabela business_rules */
  config: RawConfig;
}

export interface BusinessRulesRepository {
  getRawConfig(params: {
    medicoId: string;
    clienteId: string;
  }): Promise<RawBusinessRules | null>;
}
