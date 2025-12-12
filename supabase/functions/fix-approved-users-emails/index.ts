import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  console.log('🔧 Fix approved users emails - Starting function');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📊 Querying approved users via RPC (bypassing RLS)');

    // Usar RPC com SECURITY DEFINER para contornar RLS
    const { data: usersToFix, error: queryError } = await supabase
      .rpc('get_approved_users_for_email_fix');

    if (queryError) {
      console.error('❌ Error querying profiles via RPC:', queryError);
      throw queryError;
    }

    console.log(`📋 Found ${usersToFix?.length || 0} approved users to check`);

    if (!usersToFix || usersToFix.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum usuário aprovado encontrado',
          fixed: 0
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const fixedUsers = [];
    const errors = [];

    // Check and fix each user's email confirmation
    for (const user of usersToFix) {
      try {
        console.log(`🔍 Checking user: ${user.email} (user_id: ${user.user_id})`);

        // Get user auth data
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.user_id);
        
        if (authError) {
          console.error(`❌ Error getting auth user ${user.email}:`, authError);
          errors.push(`${user.email}: ${authError.message}`);
          continue;
        }

        if (!authUser.user) {
          console.error(`❌ Auth user not found for ${user.email}`);
          errors.push(`${user.email}: Auth user not found`);
          continue;
        }

        console.log(`📧 Auth user ${user.email}: email_confirmed_at = ${authUser.user.email_confirmed_at}`);

        if (!authUser.user.email_confirmed_at) {
          console.log(`🔧 Fixing email confirmation for: ${user.email}`);
          
          // Update user to confirm email
          const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
            user.user_id,
            {
              email_confirm: true
            }
          );

          if (updateError) {
            console.error(`❌ Error updating user ${user.email}:`, updateError);
            errors.push(`${user.email}: ${updateError.message}`);
          } else {
            console.log(`✅ Fixed email confirmation for: ${user.email}`, updateData);
            fixedUsers.push({
              email: user.email,
              nome: user.nome,
              fixed_at: new Date().toISOString()
            });
          }
        } else {
          console.log(`✅ Email already confirmed for: ${user.email}`);
        }
      } catch (userError: any) {
        console.error(`❌ Error processing user ${user.email}:`, userError);
        errors.push(`${user.email}: ${userError.message}`);
      }
    }

    // Log the fix operation
    try {
      await supabase
        .from('system_logs')
        .insert({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Fixed email confirmations for ${fixedUsers.length} approved users`,
          context: 'EMAIL_FIX_BATCH',
          data: {
            fixed_users: fixedUsers,
            errors: errors,
            total_processed: usersToFix.length
          }
        });
    } catch (logError) {
      console.error('⚠️ Error logging operation:', logError);
    }

    const response = {
      success: true,
      message: `Processados ${usersToFix.length} usuários aprovados`,
      fixed: fixedUsers.length,
      errors: errors.length,
      fixed_users: fixedUsers,
      error_details: errors
    };

    console.log('✅ Fix operation completed:', response);

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('❌ Critical error in fix function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Erro crítico ao corrigir emails'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
