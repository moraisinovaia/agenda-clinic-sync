import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';
import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que fornece valores estáveis do auth para evitar loops em useEffect
 * Usa apenas as propriedades essenciais para dependências
 */
export const useStableAuth = () => {
  const auth = useAuth();
  const { user, profile, loading, signOut } = auth;

  // Verificar se usuário é admin usando RPC
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  
  React.useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) {
        console.log('🔒 useStableAuth: Sem usuário, isAdmin = false');
        setIsAdmin(false);
        return;
      }
      
      if (!profile?.status) {
        console.log('⏳ useStableAuth: Profile ainda não carregado, aguardando...');
        return; // Aguardar profile carregar
      }
      
      console.log('🔍 useStableAuth: Verificando role admin para', user.id);
      
      try {
        const { data, error } = await (supabase.rpc as any)('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        
        if (error) {
          console.error('❌ useStableAuth: Erro ao verificar role:', error);
          setIsAdmin(false);
          return;
        }
        
        const isApprovedAdmin = data === true && profile?.status === 'aprovado';
        console.log('✅ useStableAuth: Resultado -', {
          hasAdminRole: data,
          profileStatus: profile?.status,
          isApprovedAdmin
        });
        
        setIsAdmin(isApprovedAdmin);
      } catch (err) {
        console.error('❌ useStableAuth: Exception ao verificar role:', err);
        setIsAdmin(false);
      }
    };
    
    checkAdmin();
  }, [user?.id, profile?.status, loading]);

  // Criar valores estáveis para usar como dependências
  const stableValues = useMemo(() => {
    return {
      userId: user?.id || null,
      userRole: isAdmin ? 'admin' : 'user',
      userStatus: profile?.status || null,
      isAuthenticated: !!user,
      isApproved: profile?.status === 'aprovado',
      isAdmin,
      loading
    };
  }, [user?.id, isAdmin, profile?.status, loading]);

  return {
    ...stableValues,
    user,
    profile,
    signOut,
  };
};