import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

  try {
    const requestBody = await req.json();
    console.log("📨 Request body:", JSON.stringify(requestBody, null, 2));
    
    const { to, subject, message, alertType, data }: AlertEmail = requestBody;

    if (!to || !subject || !message) {
      throw new Error("Missing required fields: to, subject, or message");
    }

    // Por enquanto, apenas simular o envio de email
    console.log(`📧 [SIMULADO] Email para ${to}: ${subject}`);
    console.log(`📝 Conteúdo: ${message}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Alert simulated successfully (Resend temporarily disabled)",
        alertType,
        timestamp: new Date().toISOString(),
        to: to,
        simulated: true
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
    console.error("Error in gmail alerts:", error);
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

serve(handler);