import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';

/**
 * Hook que fornece valores estáveis do auth para evitar loops em useEffect
 * Usa apenas as propriedades essenciais para dependências
 */
export const useStableAuth = () => {
  const auth = useAuth();
  const { user, profile, loading, signOut } = auth;

  // Criar valores estáveis para usar como dependências
  const stableValues = useMemo(() => {
    return {
      userId: user?.id || null,
      userRole: profile?.role || null,
      userStatus: profile?.status || null,
      isAuthenticated: !!user,
      isApproved: profile?.status === 'aprovado',
      isAdmin: profile?.role === 'admin' && profile?.status === 'aprovado',
      loading
    };
  }, [user?.id, profile?.role, profile?.status, loading]);

  return {
    ...stableValues,
    user,
    profile,
    signOut,
  };
};