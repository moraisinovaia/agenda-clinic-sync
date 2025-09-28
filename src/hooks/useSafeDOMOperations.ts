import { useCallback, useRef } from 'react';
import { safeDOMOperation } from '@/utils/domCleanup';

/**
 * Hook para operações DOM seguras com debounce
 * Previne múltiplas operações DOM simultâneas que podem causar conflitos
 */
export const useSafeDOMOperations = () => {
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const safeOperation = useCallback((operation: () => void, delay = 100, context = 'DOM Operation') => {
    // Cancelar operação anterior se existir
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current);
    }

    // Executar com delay para evitar conflitos
    operationTimeoutRef.current = setTimeout(() => {
      safeDOMOperation(operation, context);
    }, delay);
  }, []);

  const safeRender = useCallback((renderFn: () => void, context = 'Render Operation') => {
    // Operações de renderização imediatas mas seguras
    safeDOMOperation(renderFn, context);
  }, []);

  const cleanup = useCallback(() => {
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current);
      operationTimeoutRef.current = null;
    }
  }, []);

  return {
    safeOperation,
    safeRender,
    cleanup
  };
};