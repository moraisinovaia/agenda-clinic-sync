import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';

/**
 * Hook que fornece valores estáveis do auth para evitar loops em useEffect
 * Usa apenas as propriedades essenciais para dependências
 */
export const useStableAuth = () => {
  const auth = useAuth();
  const { user, profile, loading, signOut } = auth;

  // Debug temporário
  console.log('🔍 useStableAuth - Estado atual:', {
    hasUser: !!user,
    userId: user?.id,
    profileStatus: profile?.status,
    loading
  });

  // Criar valores estáveis para usar como dependências
  const stableValues = useMemo(() => {
    const values = {
      userId: user?.id || null,
      userRole: profile?.role || null,
      userStatus: profile?.status || null,
      isAuthenticated: !!user,
      isApproved: profile?.status === 'aprovado',
      isAdmin: profile?.role === 'admin' && profile?.status === 'aprovado',
      loading
    };
    
    console.log('🔍 useStableAuth - Valores estáveis calculados:', values);
    return values;
  }, [user?.id, profile?.role, profile?.status, loading]);

  return {
    ...stableValues,
    user,
    profile,
    signOut,
  };
};