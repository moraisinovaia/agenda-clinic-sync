import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';

/**
 * Hook que fornece valores estáveis do auth para evitar loops em useEffect
 * Usa apenas as propriedades essenciais para dependências
 */
export const useStableAuth = () => {
  const { user, profile, loading } = useAuth();

  // Criar valores estáveis para usar como dependências
  const stableValues = useMemo(() => ({
    userId: user?.id || null,
    userRole: profile?.role || null,
    userStatus: profile?.status || null,
    isAuthenticated: !!user,
    isApproved: profile?.status === 'aprovado',
    isAdmin: profile?.role === 'admin' && profile?.status === 'aprovado',
    loading
  }), [user?.id, profile?.role, profile?.status, loading]);

  return {
    ...stableValues,
    user,
    profile,
    signOut: useAuth().signOut, // Incluir signOut do hook original
  };
};