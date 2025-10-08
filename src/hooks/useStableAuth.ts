import { useAuth } from '@/hooks/useAuth';
import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que fornece valores estáveis do auth para evitar loops em useEffect
 * Usa apenas as propriedades essenciais para dependências
 */
export const useStableAuth = () => {
  const auth = useAuth();
  const { user, profile, loading, signOut } = auth;
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // Buscar role da tabela user_roles
  useEffect(() => {
    if (!user?.id) {
      setUserRole(null);
      setRoleLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserRole(data?.role || null);
      setRoleLoading(false);
    };

    fetchRole();
  }, [user?.id]);

  // Criar valores estáveis para usar como dependências
  const stableValues = useMemo(() => {
    return {
      userId: user?.id || null,
      userRole: userRole,
      userStatus: profile?.status || null,
      isAuthenticated: !!user,
      isApproved: profile?.status === 'aprovado',
      isAdmin: userRole === 'admin' && profile?.status === 'aprovado',
      loading: loading || roleLoading
    };
  }, [user?.id, userRole, profile?.status, loading, roleLoading]);

  return {
    ...stableValues,
    user,
    profile: profile ? { ...profile, role: userRole } : null,
    signOut,
  };
};