import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  console.log('🔧 Create test user - Starting function');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const testEmail = 'teste.clinica@teste.com';
    const testPassword = 'Teste123!';
    const testNome = 'Usuário Teste Clínica';
    const testUsername = 'teste_clinica';
    const clienteId = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a'; // CLINICA TESTE

    // Verificar se usuário já existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === testEmail);

    if (existingUser) {
      console.log('⚠️ Usuário teste já existe:', testEmail);
      
      // Verificar se profile existe
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', existingUser.id)
        .single();

      if (profile) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Usuário teste já existe',
            user: {
              email: testEmail,
              nome: profile.nome,
              status: profile.status,
              cliente_id: profile.cliente_id
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Criar usuário via Admin API
    console.log('📧 Criando usuário teste:', testEmail);
    
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Já confirma o email
      user_metadata: {
        nome: testNome,
        username: testUsername
      }
    });

    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
      throw createError;
    }

    console.log('✅ Usuário criado:', authUser.user.id);

    // Criar profile aprovado via RPC (bypass RLS)
    const { data: profileResult, error: profileError } = await supabase
      .rpc('create_test_user_profile', {
        p_user_id: authUser.user.id,
        p_nome: testNome,
        p_email: testEmail,
        p_username: testUsername,
        p_cliente_id: clienteId
      });

    if (profileError) {
      console.error('❌ Erro ao criar profile:', profileError);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    if (!profileResult?.success) {
      console.error('❌ Falha ao criar profile:', profileResult?.error);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw new Error(profileResult?.error || 'Erro ao criar profile');
    }

    console.log('✅ Profile criado com sucesso');

    // Log
    await supabase.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[TEST] Usuário teste criado: ${testEmail}`,
      context: 'TEST_USER_CREATION',
      data: {
        user_id: authUser.user.id,
        email: testEmail,
        cliente_id: clienteId
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário teste criado com sucesso',
        user: {
          email: testEmail,
          password: testPassword,
          nome: testNome,
          username: testUsername,
          cliente_id: clienteId,
          status: 'aprovado'
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
