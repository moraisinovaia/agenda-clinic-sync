import type {
  BusinessRulesRepository,
  RawBusinessRules,
} from '../interfaces/BusinessRulesRepository.ts';

/**
 * Implementação Opção B: lê do DynamicConfig já carregado em memória.
 * Zero queries extras por request. Acopla-se ao tipo DynamicConfig do adapter —
 * dívida conhecida a resolver quando DynamicConfig for descontinuado (Onda 3).
 */
export class DynamicConfigBusinessRulesRepository implements BusinessRulesRepository {
  /**
   * @param dynamicConfig - O objeto DynamicConfig já carregado no início da request.
   *   Tipado como `any` para não criar dependência circular com o monolito.
   */
  constructor(private readonly dynamicConfig: any) {}

  async getRawConfig(params: {
    medicoId: string;
    clienteId: string;
  }): Promise<RawBusinessRules | null> {
    const entry = this.dynamicConfig?.business_rules?.[params.medicoId];
    if (!entry?.config) return null;
    return { config: entry.config };
  }
}
