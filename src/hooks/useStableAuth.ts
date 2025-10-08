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

  // Buscar role do usuário
  const [userRole, setUserRole] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const fetchRole = async () => {
      if (!user?.id) {
        setUserRole(null);
        return;
      }
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserRole(data?.role || null);
    };
    
    fetchRole();
  }, [user?.id]);

  // Criar valores estáveis para usar como dependências
  const stableValues = useMemo(() => {
    return {
      userId: user?.id || null,
      userRole,
      userStatus: profile?.status || null,
      isAuthenticated: !!user,
      isApproved: profile?.status === 'aprovado',
      isAdmin: userRole === 'admin' && profile?.status === 'aprovado',
      loading
    };
  }, [user?.id, userRole, profile?.status, loading]);

  return {
    ...stableValues,
    user,
    profile,
    signOut,
  };
};