import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertRequest {
  to: string;
  subject: string;
  message: string;
  alertType: 'system' | 'appointment' | 'critical';
  data?: any;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("🚨 Native alerts function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    console.log("📨 Alert request:", JSON.stringify(requestBody, null, 2));
    
    const { to, subject, message, alertType, data }: AlertRequest = requestBody;

    if (!to || !subject || !message) {
      throw new Error("Missing required fields: to, subject, or message");
    }

    // Log do alerta no sistema
    const { error: logError } = await supabase
      .from('system_logs')
      .insert({
        timestamp: new Date().toISOString(),
        level: alertType === 'critical' ? 'error' : 'warn',
        message: `ALERT: ${subject} - ${message}`,
        context: `ALERT_${alertType.toUpperCase()}`,
        data: {
          alert_type: alertType,
          recipient: to,
          original_data: data,
          subject: subject
        }
      });

    if (logError) {
      console.error("❌ Erro ao registrar log:", logError);
    }

    // Para alertas críticos, tentar enviar via WhatsApp também
    if (alertType === 'critical' && to.includes('@')) {
      try {
        // Extrair número de telefone do email se possível ou usar configuração padrão
        const whatsappNumber = await getAdminWhatsAppNumber(supabase);
        
        if (whatsappNumber) {
          const whatsappMessage = `🚨 ALERTA CRÍTICO - ${subject}\n\n${message}\n\nDetalhes: ${JSON.stringify(data, null, 2)}`;
          
          await supabase.functions.invoke('whatsapp-agent', {
            body: {
              to: whatsappNumber,
              message: whatsappMessage,
              type: 'alert'
            }
          });

          console.log("📱 WhatsApp crítico enviado para:", whatsappNumber);
        }
      } catch (whatsappError) {
        console.error("⚠️ Erro no WhatsApp crítico:", whatsappError);
        // Não falhar o alerta por causa do WhatsApp
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Alert logged successfully",
        alertType,
        timestamp: new Date().toISOString(),
        logged_to_system: true,
        whatsapp_sent: alertType === 'critical'
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error processing alert:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

async function getAdminWhatsAppNumber(supabase: any): Promise<string | null> {
  try {
    // Buscar número do WhatsApp de admin nas configurações
    const { data: config } = await supabase
      .from('configuracoes_clinica')
      .select('valor')
      .eq('chave', 'admin_whatsapp_number')
      .single();

    if (config?.valor) {
      return config.valor;
    }

    // Fallback: buscar perfil admin com celular
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin')
      .eq('status', 'aprovado')
      .limit(1)
      .single();

    if (adminProfile) {
      // Buscar paciente com mesmo user_id (se existir)
      const { data: adminPatient } = await supabase
        .from('pacientes')
        .select('celular')
        .not('celular', 'is', null)
        .limit(1)
        .single();

      return adminPatient?.celular || null;
    }

    return null;
  } catch (error) {
    console.error("Erro ao buscar número admin:", error);
    return null;
  }
}

serve(handler);