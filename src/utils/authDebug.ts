/**
 * Utilitários para debug do sistema de autenticação
 * Use para diagnosticar problemas de auth.uid() retornando null
 */

import { supabase } from '@/integrations/supabase/client';

export const debugAuthState = async () => {
  console.log('🔍 === DEBUG ESTADO DE AUTENTICAÇÃO ===');
  
  try {
    // 1. Verificar sessão atual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('📋 Sessão atual:', {
      hasSession: !!session,
      userId: session?.user?.id || 'NULL',
      expires: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
      error: sessionError?.message || 'Nenhum erro'
    });

    // 2. Verificar usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('👤 Usuário atual:', {
      hasUser: !!user,
      userId: user?.id || 'NULL',
      email: user?.email || 'NULL',
      error: userError?.message || 'Nenhum erro'
    });

    // 3. Testar auth.uid() via RPC
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('is_admin_safe');
      console.log('🛡️ Teste is_admin_safe():', {
        result: rpcResult,
        error: rpcError?.message || 'Nenhum erro'
      });
    } catch (rpcErr: any) {
      console.log('❌ Erro no RPC is_admin_safe:', rpcErr.message);
    }

    // 4. Testar consulta direta na tabela profiles
    try {
      const { data: profileDirect, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, role, status')
        .eq('user_id', session?.user?.id || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      console.log('👥 Profile direto:', {
        found: !!profileDirect,
        profile: profileDirect || 'Não encontrado',
        error: profileError?.message || 'Nenhum erro'
      });
    } catch (profileErr: any) {
      console.log('❌ Erro na consulta de profile:', profileErr.message);
    }

    // 5. Testar função get_current_user_profile
    try {
      const { data: functionProfile, error: functionError } = await supabase
        .rpc('get_current_user_profile');

      console.log('🔧 Profile via função:', {
        found: !!functionProfile && functionProfile.length > 0,
        profile: functionProfile?.[0] || 'Não encontrado',
        error: functionError?.message || 'Nenhum erro'
      });
    } catch (functionErr: any) {
      console.log('❌ Erro na função get_current_user_profile:', functionErr.message);
    }

    // 6. Verificar storage local
    const storageKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || key.includes('auth')
    );
    console.log('💾 Chaves de autenticação no localStorage:', {
      count: storageKeys.length,
      keys: storageKeys
    });

    // 7. Testar função get_clientes_for_admin se houver user_id
    if (session?.user?.id) {
      try {
        const { data: clientesData, error: clientesError } = await supabase
          .rpc('get_clientes_admin');

        console.log('🏢 Teste get_clientes_admin:', {
          success: !!clientesData,
          count: Array.isArray(clientesData) ? clientesData.length : 0,
          error: clientesError?.message || 'Nenhum erro'
        });
      } catch (clientesErr: any) {
        console.log('❌ Erro em get_clientes_admin:', clientesErr.message);
      }
    }

  } catch (error: any) {
    console.error('❌ Erro geral no debug:', error.message);
  }
  
  console.log('🔍 === FIM DEBUG AUTENTICAÇÃO ===');
};

// Executar debug automaticamente quando necessário
if (typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuthState;
  console.log('🐛 Para debugar autenticação, execute: debugAuth() no console do navegador');
}