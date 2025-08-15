import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AppointmentWebhookData {
  agendamento_id: string;
  paciente_id: string;
  medico_id: string;
  atendimento_id: string;
  data_agendamento: string;
  hora_agendamento: string;
  status: string;
  observacoes?: string;
  convenio: string;
  criado_por: string;
  criado_por_user_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData: AppointmentWebhookData = await req.json();
    console.log('📧 N8N Webhook triggered for appointment:', webhookData.agendamento_id);

    // Buscar configuração do webhook N8N
    const { data: config, error: configError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'n8n_webhook_url')
      .single();

    if (configError || !config?.value) {
      console.log('⚠️ N8N webhook URL not configured, using default');
    }

    const webhookUrl = config?.value || 'https://n8n.inovaia.online/webhook-test/whatsapp-webhook';

    // Buscar dados completos do agendamento
    const { data: fullData, error: dataError } = await supabase
      .from('agendamentos')
      .select(`
        *,
        pacientes (*),
        medicos (*),
        atendimentos (*)
      `)
      .eq('id', webhookData.agendamento_id)
      .single();

    if (dataError || !fullData) {
      throw new Error(`Falha ao buscar dados do agendamento: ${dataError?.message}`);
    }

    // Formatar dados para N8N
    const n8nPayload = {
      event: 'appointment_created',
      timestamp: new Date().toISOString(),
      appointment: {
        id: fullData.id,
        data_agendamento: fullData.data_agendamento,
        hora_agendamento: fullData.hora_agendamento,
        status: fullData.status,
        observacoes: fullData.observacoes || '',
        created_at: fullData.created_at
      },
      patient: {
        id: fullData.pacientes.id,
        nome_completo: fullData.pacientes.nome_completo,
        celular: fullData.pacientes.celular,
        telefone: fullData.pacientes.telefone,
        convenio: fullData.pacientes.convenio,
        data_nascimento: fullData.pacientes.data_nascimento
      },
      doctor: {
        id: fullData.medicos.id,
        nome: fullData.medicos.nome,
        especialidade: fullData.medicos.especialidade
      },
      attendance: {
        id: fullData.atendimentos.id,
        nome: fullData.atendimentos.nome,
        tipo: fullData.atendimentos.tipo
      },
      created_by: {
        nome: fullData.criado_por,
        user_id: fullData.criado_por_user_id,
        method: 'manual'
      }
    };

    // Buscar configuração de tentativas
    const { data: retriesConfig } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'n8n_webhook_retries')
      .single();

    const maxRetries = parseInt(retriesConfig?.value || '3');
    let lastError: Error | null = null;

    // Tentar enviar para N8N com retry
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Tentativa ${attempt}/${maxRetries} - Enviando para N8N:`, webhookUrl);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Supabase-N8N-Webhook/1.0'
          },
          body: JSON.stringify(n8nPayload)
        });

        if (response.ok) {
          const responseText = await response.text();
          console.log('✅ N8N webhook enviado com sucesso:', response.status);

          // Log de sucesso
          await supabase
            .from('system_logs')
            .insert({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `N8N webhook enviado com sucesso para agendamento ${webhookData.agendamento_id}`,
              context: 'N8N_WEBHOOK',
              data: {
                agendamento_id: webhookData.agendamento_id,
                attempt,
                status: response.status,
                response: responseText.substring(0, 500)
              }
            });

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Webhook N8N enviado com sucesso',
              attempt,
              status: response.status
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        } else {
          const errorText = await response.text();
          lastError = new Error(`HTTP ${response.status}: ${errorText}`);
          console.log(`❌ Tentativa ${attempt} falhou:`, lastError.message);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff
          }
        }
      } catch (error) {
        lastError = error as Error;
        console.log(`❌ Tentativa ${attempt} falhou:`, lastError.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    console.log('💥 Todas as tentativas falharam');

    // Log de erro
    await supabase
      .from('system_logs')
      .insert({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Falha ao enviar N8N webhook para agendamento ${webhookData.agendamento_id}`,
        context: 'N8N_WEBHOOK_ERROR',
        data: {
          agendamento_id: webhookData.agendamento_id,
          error: lastError?.message,
          attempts: maxRetries,
          webhook_url: webhookUrl
        }
      });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Falha após ${maxRetries} tentativas: ${lastError?.message}`,
        agendamento_id: webhookData.agendamento_id
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Erro na função N8N webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});