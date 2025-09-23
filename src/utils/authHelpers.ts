import { supabase } from '@/integrations/supabase/client';

/**
 * Aguarda que a sessão do Supabase esteja completamente carregada
 * Usado para evitar problemas de auth.uid() retornando null
 */
export const waitForSession = async (maxWaitTime = 5000): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erro ao verificar sessão:', error);
      return false;
    }
    
    if (session?.user?.id) {
      console.log('✅ Sessão carregada:', session.user.id);
      return true;
    }
    
    // Aguardar um pouco antes de tentar novamente
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.warn('⚠️ Timeout aguardando sessão');
  return false;
};

/**
 * Força o refresh do token de acesso se necessário
 */
export const ensureValidSession = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.warn('Sessão inválida ou não encontrada');
      return false;
    }
    
    // Verificar se o token está próximo do vencimento (menos de 1 minuto)
    const expiresAt = session.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry < 60) {
      console.log('🔄 Token próximo do vencimento, fazendo refresh...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !newSession) {
        console.error('Erro ao fazer refresh da sessão:', refreshError);
        return false;
      }
      
      console.log('✅ Token renovado com sucesso');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar/renovar sessão:', error);
    return false;
  }
};

/**
 * Executa uma função Supabase com retry em caso de erro de autenticação
 */
export const executeWithAuthRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Garantir que a sessão está válida antes de tentar
      if (attempt > 0) {
        await ensureValidSession();
        await waitForSession(1000);
      }
      
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Se é erro de autenticação e ainda há tentativas, tentar novamente
      if (
        attempt < maxRetries && 
        (error.message?.includes('permission denied') || 
         error.message?.includes('JWT') ||
         error.message?.includes('auth'))
      ) {
        console.warn(`Tentativa ${attempt + 1} falhou, tentando novamente...`, error.message);
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      
      // Se não é erro de auth ou esgotaram as tentativas, relançar o erro
      throw error;
    }
  }
  
  throw lastError;
};