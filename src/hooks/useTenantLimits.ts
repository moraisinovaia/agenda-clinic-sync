import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type LimitType = 'medicos' | 'pacientes' | 'usuarios';

interface LimitResult {
  allowed: boolean;
  current: number;
  max: number;
  message: string;
}

export function useTenantLimits() {
  const checkLimit = useCallback(async (tipo: LimitType): Promise<LimitResult> => {
    try {
      const { data, error } = await supabase.rpc('check_tenant_limit', {
        p_tipo: tipo
      } as any);

      if (error) {
        console.warn('⚠️ Erro ao verificar limite de tenant:', error.message);
        // Se a função não existir ou houver erro, permitir (fail-open para não bloquear operações)
        return { allowed: true, current: 0, max: 0, message: '' };
      }

      if (data && typeof data === 'object') {
        const result = data as any;
        return {
          allowed: result.allowed ?? true,
          current: result.current ?? 0,
          max: result.max ?? 0,
          message: result.message ?? '',
        };
      }

      return { allowed: true, current: 0, max: 0, message: '' };
    } catch {
      return { allowed: true, current: 0, max: 0, message: '' };
    }
  }, []);

  return { checkLimit };
}
