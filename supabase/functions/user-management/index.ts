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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obter JWT do header Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação não fornecido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Extrair token do header "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    // Verificar usuário autenticado usando Admin API
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou usuário não autenticado', details: userError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('[USER-MGMT] Verificando perfil do usuário autenticado:', user.id);
    
    // Verificar perfil do usuário
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id, status')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminProfile) {
      console.error('[USER-MGMT] Erro ao buscar perfil:', adminError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Perfil do usuário não encontrado',
          details: adminError?.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verificar role na tabela user_roles
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    console.log('[USER-MGMT] Role verificado:', roleData?.role, 'Status:', adminProfile.status);

    if (roleError || !roleData || adminProfile.status !== 'aprovado') {
      console.error('[USER-MGMT] Usuário não é admin ou não aprovado:', {
        role: roleData?.role,
        status: adminProfile.status,
        error: roleError?.message
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Apenas administradores aprovados podem realizar esta ação',
          user_role: roleData?.role || 'none',
          user_status: adminProfile.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { action, user_email, user_id, user_ids }: Omit<UserManagementRequest, 'admin_id'> = await req.json();
    const admin_id = adminProfile.id;

    let result;

    console.log('[USER-MGMT] Processando ação:', action);
    
    switch (action) {
      case 'confirm_email': {
        console.log('[USER-MGMT] Confirmando email:', user_email);
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
        console.log('[USER-MGMT] Deletando usuário:', user_id);
        if (!user_id) {
          throw new Error('user_id é obrigatório para delete_user');
        }

        // Buscar profile para pegar o user_id correto
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('user_id, nome, email')
          .eq('id', user_id)
          .single();

        if (profileError || !profile) {
          console.error('[USER-MGMT] Perfil não encontrado:', profileError);
          return new Response(
            JSON.stringify({ success: false, error: 'Perfil não encontrado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        console.log('[USER-MGMT] Deletando roles do usuário:', profile.user_id);
        // Deletar roles do usuário primeiro
        const { error: roleDeleteError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', profile.user_id);
        
        if (roleDeleteError) {
          console.error('[USER-MGMT] Erro ao deletar roles:', roleDeleteError);
        }

        console.log('[USER-MGMT] Deletando perfil do usuário:', user_id);
        // Deletar perfil do usuário
        const { error: profileDeleteError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', user_id);
        
        if (profileDeleteError) {
          console.error('[USER-MGMT] Erro ao deletar perfil:', profileDeleteError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Erro ao deletar perfil do usuário',
              details: profileDeleteError.message 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log('[USER-MGMT] Deletando usuário do Auth:', profile.user_id);
        // Deletar o usuário do Auth
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
        
        if (deleteError) {
          console.error('[USER-MGMT] Erro ao deletar usuário do Auth:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: deleteError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log('[USER-MGMT] Usuário deletado com sucesso:', user_id);

        // Log da exclusão
        await supabaseAdmin.from('system_logs').insert({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `[ADMIN] Usuário excluído: ${profile.nome} (${profile.email})`,
          context: 'USER_DELETION',
          data: { profile_id: user_id, user_id: profile.user_id, admin_id, deleted_at: new Date().toISOString() }
        });

        result = { success: true, message: 'Usuário excluído com sucesso' };
        break;
      }

      case 'check_email_status': {
        if (!user_id) {
          throw new Error('user_id é obrigatório para check_email_status');
        }

        // Buscar profile para pegar o user_id correto
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('id', user_id)
          .single();

        if (!profile) {
          return new Response(
            JSON.stringify({ success: false, error: 'Perfil não encontrado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        // Buscar dados do usuário via Admin API
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);

        if (userError) throw userError;

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

        // Buscar profiles para pegar os user_ids corretos
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, user_id')
          .in('id', user_ids);

        if (profilesError) throw profilesError;

        // Buscar todos os usuários
        const { data: userData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (usersError) throw usersError;

        // Mapear status de confirmação
        const emailStatuses = profiles.map(profile => {
          const user = userData.users.find(u => u.id === profile.user_id);
          return {
            profile_id: profile.id,
            email_confirmed: !!user?.email_confirmed_at,
            email_confirmed_at: user?.email_confirmed_at
          };
        });

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
    console.error('Erro em user-management:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno ao processar requisição' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
