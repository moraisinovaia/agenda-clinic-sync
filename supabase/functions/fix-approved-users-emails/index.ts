import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FixEmailsRequest {
  adminUserId?: string;
}

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

    console.log('📊 Querying approved users with unconfirmed emails');

    // Get all approved users with unconfirmed emails
    const { data: usersToFix, error: queryError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        nome,
        email,
        status,
        data_aprovacao
      `)
      .eq('status', 'aprovado');

    if (queryError) {
      console.error('❌ Error querying profiles:', queryError);
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
        console.log(`🔍 Checking user: ${user.email}`);

        // Get user auth data
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.user_id);
        
        if (authError) {
          console.error(`❌ Error getting auth user ${user.email}:`, authError);
          errors.push(`${user.email}: ${authError.message}`);
          continue;
        }

        if (!authUser.user?.email_confirmed_at) {
          console.log(`🔧 Fixing email confirmation for: ${user.email}`);
          
          // Update user to confirm email
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.user_id,
            {
              email_confirmed_at: new Date().toISOString()
            }
          );

          if (updateError) {
            console.error(`❌ Error updating user ${user.email}:`, updateError);
            errors.push(`${user.email}: ${updateError.message}`);
          } else {
            console.log(`✅ Fixed email confirmation for: ${user.email}`);
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
    const { error: logError } = await supabase
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

    if (logError) {
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