// User Management Edge Function - v2.1
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserManagementRequest {
  action: 'confirm_email' | 'delete_user' | 'check_email_status' | 'batch_check_emails';
  user_email?: string;
  user_id?: string;
  user_ids?: string[];
  admin_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
  // Cliente admin com service role key - bypassa RLS automaticamente
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, user_email, user_id, user_ids, admin_id }: UserManagementRequest = await req.json();

    console.log('[DEBUG] Admin verification starting', { admin_id, action });

    // Usar função SQL com SECURITY DEFINER para verificar admin
    const { data: adminVerification, error: verifyError } = await supabaseAdmin
      .rpc('verify_admin_access', { p_profile_id: admin_id });

    console.log('[DEBUG] Admin verification result', { 
      success: adminVerification?.success,
      error: verifyError?.message || adminVerification?.error
    });

    if (verifyError) {
      console.error('[ERROR] Failed to verify admin', { error: verifyError, admin_id });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao verificar permissões: ' + verifyError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!adminVerification.success) {
      console.error('[ERROR] Admin verification failed', { 
        admin_id,
        reason: adminVerification.error 
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: adminVerification.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('[DEBUG] Admin verified successfully', {
      admin: adminVerification.nome,
      email: adminVerification.email,
      action
    });

    let result;

    switch (action) {
      case 'confirm_email': {
        if (!user_email) {
          throw new Error('user_email é obrigatório para confirm_email');
        }

        // Buscar user_id pelo email
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (userError) throw userError;

        const user = userData.users.find(u => u.email === user_email);
        
        if (!user) {
          return new Response(
            JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        // Confirmar email via Admin API
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { email_confirm: true }
        );

        if (confirmError) throw confirmError;

        // Log da confirmação
        await supabaseAdmin.from('system_logs').insert({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `[ADMIN] Email confirmado manualmente para ${user_email}`,
          context: 'EMAIL_CONFIRMATION',
          data: { user_email, admin_id, confirmed_at: new Date().toISOString() }
        });

        result = { success: true, message: 'Email confirmado com sucesso' };
        break;
      }

      case 'delete_user': {
        if (!user_id) {
          throw new Error('user_id é obrigatório para delete_user');
        }

        console.log('[DEBUG] Deleting user with profile_id:', user_id);

        // Buscar user_id do perfil usando função SEGURA (não verifica se ele é admin)
        const { data: profileData, error: profileRpcError } = await supabaseAdmin
          .rpc('get_profile_auth_id', { p_profile_id: user_id });

        if (profileRpcError || !profileData?.success || !profileData?.user_id) {
          console.error('[ERROR] Failed to get profile data', { profileRpcError, profileData });
          return new Response(
            JSON.stringify({ success: false, error: profileData?.error || 'Perfil não encontrado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        const authUserId = profileData.user_id;
        const userName = profileData.nome;
        const userEmail = profileData.email;

        console.log('[DEBUG] Found auth user_id:', authUserId, 'name:', userName);

        // Deletar usuário via Admin API (cascade deletará o profile automaticamente)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);

        if (deleteError) {
          console.error('[ERROR] Failed to delete user', deleteError);
          throw deleteError;
        }

        console.log('[DEBUG] User deleted successfully');

        // Log da exclusão
        await supabaseAdmin.from('system_logs').insert({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `[ADMIN] Usuário excluído: ${userName} (${userEmail})`,
          context: 'USER_DELETION',
          data: { profile_id: user_id, user_id: authUserId, admin_id, deleted_at: new Date().toISOString() }
        });

        result = { success: true, message: 'Usuário excluído com sucesso' };
        break;
      }

      case 'check_email_status': {
        if (!user_id) {
          throw new Error('user_id é obrigatório para check_email_status');
        }

        console.log('[DEBUG] Checking email status for profile_id:', user_id);

        // Buscar user_id do perfil
        const { data: profileData, error: profileRpcError } = await supabaseAdmin
          .rpc('get_profile_auth_id', { p_profile_id: user_id });

        if (profileRpcError || !profileData?.success || !profileData?.user_id) {
          console.error('[ERROR] Failed to get profile', { profileRpcError, profileData });
          return new Response(
            JSON.stringify({ success: false, error: profileData?.error || 'Perfil não encontrado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        const authUserId = profileData.user_id;

        // Buscar dados do usuário via Admin API
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(authUserId);

        if (userError) {
          console.error('[ERROR] Failed to get user by ID', userError);
          throw userError;
        }

        result = { 
          success: true, 
          email_confirmed: !!userData.user.email_confirmed_at,
          email_confirmed_at: userData.user.email_confirmed_at
        };
        break;
      }

      case 'batch_check_emails': {
        if (!user_ids || user_ids.length === 0) {
          throw new Error('user_ids é obrigatório para batch_check_emails');
        }

        console.log('[DEBUG] Batch check emails for profile IDs:', user_ids);

        // Mapear status de confirmação para cada profile_id
        const emailStatuses: Record<string, boolean> = {};

        for (const profile_id of user_ids) {
          try {
            // Buscar user_id do profile
            const { data: profileData } = await supabaseAdmin
              .rpc('get_profile_auth_id', { p_profile_id: profile_id });

            if (!profileData?.success || !profileData?.user_id) {
              console.warn('[WARN] Profile not found:', profile_id);
              emailStatuses[profile_id] = false;
              continue;
            }

            // Buscar dados do auth.users via Admin API
            const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(profileData.user_id);
            
            if (error) {
              console.error(`[ERROR] Failed to get user ${profile_id}:`, error);
              emailStatuses[profile_id] = false;
              continue;
            }

            emailStatuses[profile_id] = !!userData.user.email_confirmed_at;
          } catch (err) {
            console.error(`[ERROR] Exception checking user ${profile_id}:`, err);
            emailStatuses[profile_id] = false;
          }
        }

        console.log('[DEBUG] Email statuses checked for', Object.keys(emailStatuses).length, 'profiles');

        result = { success: true, email_statuses: emailStatuses };
        break;
      }

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ERROR] Exception in user-management:', error);
    console.error('[ERROR] Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno ao processar requisição',
        stack: error.stack
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
