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

  // Verificar se usuário é admin ou admin_clinica usando RPC
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [isClinicAdmin, setIsClinicAdmin] = React.useState<boolean>(false);
  const [clinicAdminClienteId, setClinicAdminClienteId] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const checkRoles = async () => {
      if (!user?.id) {
        console.log('🔒 useStableAuth: Sem usuário, roles = false');
        setIsAdmin(false);
        setIsClinicAdmin(false);
        setClinicAdminClienteId(null);
        return;
      }
      
      if (!profile?.status) {
        console.log('⏳ useStableAuth: Profile ainda não carregado, aguardando...');
        return; // Aguardar profile carregar
      }
      
      console.log('🔍 useStableAuth: Verificando roles para', user.id);
      
      try {
        // Verificar admin global e admin_clinica em paralelo
        const [adminResult, clinicAdminResult, clinicIdResult] = await Promise.all([
          (supabase.rpc as any)('has_role', { _user_id: user.id, _role: 'admin' }),
          (supabase.rpc as any)('is_clinic_admin', { _user_id: user.id }),
          (supabase.rpc as any)('get_clinic_admin_cliente_id', { _user_id: user.id })
        ]);
        
        if (adminResult.error) {
          console.error('❌ useStableAuth: Erro ao verificar role admin:', adminResult.error);
        }
        
        if (clinicAdminResult.error) {
          console.error('❌ useStableAuth: Erro ao verificar role clinic_admin:', clinicAdminResult.error);
        }
        
        const isApprovedAdmin = adminResult.data === true && profile?.status === 'aprovado';
        const isApprovedClinicAdmin = clinicAdminResult.data === true && profile?.status === 'aprovado';
        
        console.log('✅ useStableAuth: Resultado -', {
          hasAdminRole: adminResult.data,
          hasClinicAdminRole: clinicAdminResult.data,
          clinicAdminClienteId: clinicIdResult.data,
          profileStatus: profile?.status,
          isApprovedAdmin,
          isApprovedClinicAdmin
        });
        
        setIsAdmin(isApprovedAdmin);
        setIsClinicAdmin(isApprovedClinicAdmin);
        setClinicAdminClienteId(clinicIdResult.data || null);
      } catch (err) {
        console.error('❌ useStableAuth: Exception ao verificar roles:', err);
        setIsAdmin(false);
        setIsClinicAdmin(false);
        setClinicAdminClienteId(null);
      }
    };
    
    checkRoles();
  }, [user?.id, profile?.status, loading]);

  // Criar valores estáveis para usar como dependências
  const stableValues = useMemo(() => {
    return {
      userId: user?.id || null,
      userRole: isAdmin ? 'admin' : isClinicAdmin ? 'admin_clinica' : 'user',
      userStatus: profile?.status || null,
      isAuthenticated: !!user,
      isApproved: profile?.status === 'aprovado',
      isAdmin,
      isClinicAdmin,
      clinicAdminClienteId,
      loading
    };
  }, [user?.id, isAdmin, isClinicAdmin, clinicAdminClienteId, profile?.status, loading]);

  return {
    ...stableValues,
    user,
    profile,
    signOut,
  };
};