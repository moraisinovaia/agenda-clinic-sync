import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
}

export function useRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
) {
  const { maxAttempts = 3, delay = 1000, backoff = true } = options;
  const [isRetrying, setIsRetrying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { toast } = useToast();

  const executeWithRetry = useCallback(async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    let currentAttempt = 0;
    
    while (currentAttempt < maxAttempts) {
      try {
        setAttempts(currentAttempt + 1);
        
        if (currentAttempt > 0) {
          setIsRetrying(true);
          const currentDelay = backoff ? delay * Math.pow(2, currentAttempt - 1) : delay;
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }
        
        const result = await fn(...args);
        setIsRetrying(false);
        setAttempts(0);
        return result;
        
      } catch (error) {
        currentAttempt++;
        console.warn(`Tentativa ${currentAttempt} falhou:`, error);
        
        if (currentAttempt >= maxAttempts) {
          setIsRetrying(false);
          setAttempts(0);
          
          // Verificar se é um erro de rede
          const isNetworkError = error instanceof Error && 
            (error.message.includes('fetch') || 
             error.message.includes('network') ||
             error.message.includes('Failed to fetch'));
          
          if (isNetworkError) {
            toast({
              title: 'Erro de Conexão',
              description: 'Verifique sua conexão com a internet e tente novamente.',
              variant: 'destructive',
            });
          }
          
          throw error;
        } else if (currentAttempt < maxAttempts) {
          toast({
            title: `Tentativa ${currentAttempt} falhou`,
            description: `Tentando novamente... (${currentAttempt}/${maxAttempts})`,
            variant: 'destructive',
          });
        }
      }
    }
    
    throw new Error('Número máximo de tentativas excedido');
  }, [fn, maxAttempts, delay, backoff, toast]);

  return {
    executeWithRetry,
    isRetrying,
    attempts,
  };
}