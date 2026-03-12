import { useAuth } from '@/hooks/useAuth';
import { useMemo, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook otimizado que fornece valores estáveis do auth
 * Usa RPC única get_user_auth_data para reduzir chamadas ao banco
 */
export const useStableAuth = () => {
  const auth = useAuth();
  const { user, profile, loading: authLoading, signOut } = auth;

  // Estados de roles
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isClinicAdmin, setIsClinicAdmin] = useState<boolean>(false);
  const [clinicAdminClienteId, setClinicAdminClienteId] = useState<string | null>(null);
  const [rolesLoading, setRolesLoading] = useState<boolean>(true);
  
  // Cache para evitar chamadas repetidas
  const authDataCacheRef = useRef<{
    userId: string;
    data: any;
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 60000; // 1 minuto

  useEffect(() => {
    const checkRoles = async () => {
      if (!user?.id) {
        console.log('🔒 useStableAuth: Sem usuário, roles = false');
        setIsAdmin(false);
        setIsClinicAdmin(false);
        setClinicAdminClienteId(null);
        setRolesLoading(false);
        return;
      }
      
      if (!profile?.status) {
        console.log('⏳ useStableAuth: Profile ainda não carregado, aguardando...');
        return;
      }

      // Verificar cache
      const now = Date.now();
      if (
        authDataCacheRef.current &&
        authDataCacheRef.current.userId === user.id &&
        (now - authDataCacheRef.current.timestamp) < CACHE_DURATION
      ) {
        console.log('♻️ useStableAuth: Usando cache de auth data');
        const cached = authDataCacheRef.current.data;
        setIsAdmin(cached.is_admin);
        setIsClinicAdmin(cached.is_clinic_admin);
        setClinicAdminClienteId(cached.cliente_id);
        setRolesLoading(false);
        return;
      }
      
      console.log('🔍 useStableAuth: Verificando roles via RPC única para', user.id);
      setRolesLoading(true);
      
      try {
        // ⚡ OTIMIZAÇÃO: Uma única RPC em vez de 3 separadas
        const { data: authData, error } = await supabase.rpc('get_user_auth_data', { 
          p_user_id: user.id 
        });
        
        if (error) {
          console.error('❌ useStableAuth: Erro na RPC get_user_auth_data:', error);
          // Fallback para método antigo
          const [adminResult, superAdminResult, clinicAdminResult, clinicIdResult] = await Promise.all([
            (supabase.rpc as any)('has_role', { _user_id: user.id, _role: 'admin' }),
            (supabase.rpc as any)('is_super_admin'),
            (supabase.rpc as any)('is_clinic_admin', { _user_id: user.id }),
            (supabase.rpc as any)('get_clinic_admin_cliente_id', { _user_id: user.id })
          ]);
          
          const isApprovedAdmin = (adminResult.data === true || superAdminResult.data === true) && profile?.status === 'aprovado';
          const isApprovedClinicAdmin = clinicAdminResult.data === true && profile?.status === 'aprovado';
          
          setIsAdmin(isApprovedAdmin);
          setIsClinicAdmin(isApprovedClinicAdmin);
          setClinicAdminClienteId(clinicIdResult.data || null);
        } else {
          // Usar dados da RPC otimizada
          const result = authData as any;
          console.log('✅ useStableAuth: RPC única retornou:', result);
          
          // Cachear resultado
          authDataCacheRef.current = {
            userId: user.id,
            data: result,
            timestamp: now
          };
          
          setIsAdmin(result?.is_admin || false);
          setIsClinicAdmin(result?.is_clinic_admin || false);
          setClinicAdminClienteId(result?.cliente_id || null);
        }
      } catch (err) {
        console.error('❌ useStableAuth: Exception ao verificar roles:', err);
        setIsAdmin(false);
        setIsClinicAdmin(false);
        setClinicAdminClienteId(null);
      } finally {
        setRolesLoading(false);
      }
    };
    
    checkRoles();
  }, [user?.id, profile?.status]);

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
      loading: authLoading || rolesLoading
    };
  }, [user?.id, isAdmin, isClinicAdmin, clinicAdminClienteId, profile?.status, authLoading, rolesLoading]);

  return {
    ...stableValues,
    user,
    profile,
    signOut,
  };
};