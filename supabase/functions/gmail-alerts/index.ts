import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertEmail {
  to: string;
  subject: string;
  message: string;
  alertType: 'system' | 'appointment' | 'critical';
  data?: any;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("📧 Gmail alerts function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- JWT Validation ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Não autorizado' }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  const jwtClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await jwtClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token inválido' }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  // --- End JWT Validation ---

  try {
    const requestBody = await req.json();
    console.log("📨 Request body:", JSON.stringify(requestBody, null, 2));
    
    const { to, subject, message, alertType, data }: AlertEmail = requestBody;

    if (!to || !subject || !message) {
      throw new Error("Missing required fields: to, subject, or message");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY não configurada");
      throw new Error("Resend API key not configured. Please configure RESEND_API_KEY in the edge function secrets.");
    }

    console.log("🔑 Resend API key found, initializing...");
    const resend = new Resend(resendApiKey);

    // Create email content with HTML formatting
    const htmlContent = generateEmailHTML(subject, message, alertType, data);
    
    console.log("📧 Sending email to:", to);
    
    // Send email via Resend
    const response = await resend.emails.send({
      from: "Endogastro Alertas <onboarding@resend.dev>",
      to: [to],
      subject: `[Endogastro] ${subject}`,
      html: htmlContent,
    });

    console.log("✅ Email sent successfully:", response);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Alert sent successfully",
        alertType,
        timestamp: new Date().toISOString(),
        emailId: response.data?.id,
        to: to
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
    console.error("Error sending alert email:", error);
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

function generateEmailHTML(subject: string, message: string, alertType: string, data?: any): string {
  const alertColors = {
    system: '#3b82f6',
    appointment: '#10b981', 
    critical: '#ef4444'
  };

  const color = alertColors[alertType as keyof typeof alertColors] || '#6b7280';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: ${color}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        .data-box { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .timestamp { color: #888; font-size: 12px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🏥 Sistema Endogastro</h2>
          <h3>${subject}</h3>
        </div>
        <div class="content">
          <p>${message}</p>
          ${data ? `
            <div class="data-box">
              <h4>Detalhes:</h4>
              <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
          ` : ''}
          <div class="timestamp">
            📅 ${new Date().toLocaleString('pt-BR')}
          </div>
        </div>
        <div class="footer">
          <p>Sistema de Alertas Endogastro | Desenvolvido com ❤️</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(handler);