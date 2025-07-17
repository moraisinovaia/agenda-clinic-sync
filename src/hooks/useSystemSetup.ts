import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { setupInitialData } from '@/utils/systemSetup';

export const useSystemSetup = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const setupCompleted = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    // Só executa setup se:
    // 1. Usuário autenticado
    // 2. Não está carregando
    // 3. Usuário aprovado
    // 4. Setup ainda não foi executado
    if (user && !authLoading && profile?.status === 'aprovado' && !setupCompleted.current) {
      setupCompleted.current = true; // Marcar como executado ANTES da chamada
      
      setupInitialData().then((result) => {
        if (!isMounted) return;
        
        if (result.success) {
          console.log('✅ Sistema configurado com sucesso');
        } else {
          console.error('❌ Erro na configuração inicial:', result.error);
          setupCompleted.current = false; // Permitir retry em caso de erro
        }
      }).catch((error) => {
        if (!isMounted) return;
        console.error('❌ Erro inesperado na configuração:', error);
        setupCompleted.current = false; // Permitir retry em caso de erro
      });
    }
    
    return () => {
      isMounted = false;
    };
  }, [user, authLoading, profile?.status]);

  // Reset quando usuário muda
  useEffect(() => {
    if (!user) {
      setupCompleted.current = false;
    }
  }, [user]);
};