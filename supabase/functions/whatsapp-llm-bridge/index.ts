import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppMessage {
  from: string;
  message: string;
  name?: string;
}

interface LLMResponse {
  role: string;
  content: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("🤖 WhatsApp LLM Bridge function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("📨 Request body:", JSON.stringify(requestBody, null, 2));
    
    const { from, message, name }: WhatsAppMessage = requestBody;

    if (!from || !message) {
      throw new Error("Missing required fields: from or message");
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("❌ OPENAI_API_KEY não configurada");
      throw new Error("OpenAI API key not configured");
    }

    console.log("🔑 OpenAI API key found, processing message...");

    // Definir as tools disponíveis baseadas na llm-agent-api
    const tools = [
      {
        type: "function",
        function: {
          name: "schedule_appointment",
          description: "Agendar uma consulta ou exame para o paciente",
          parameters: {
            type: "object",
            properties: {
              patient_name: { type: "string", description: "Nome completo do paciente" },
              birth_date: { type: "string", description: "Data de nascimento no formato YYYY-MM-DD" },
              insurance: { type: "string", description: "Convênio do paciente" },
              phone: { type: "string", description: "Telefone do paciente" },
              cell_phone: { type: "string", description: "Celular do paciente" },
              doctor_name: { type: "string", description: "Nome do médico" },
              service_name: { type: "string", description: "Nome do exame/consulta" },
              appointment_date: { type: "string", description: "Data do agendamento YYYY-MM-DD" },
              appointment_time: { type: "string", description: "Horário no formato HH:MM" },
              observations: { type: "string", description: "Observações adicionais" }
            },
            required: ["patient_name", "birth_date", "insurance", "cell_phone", "doctor_name", "service_name", "appointment_date", "appointment_time"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_patient_appointments",
          description: "Consultar agendamentos existentes de um paciente",
          parameters: {
            type: "object",
            properties: {
              patient_name: { type: "string", description: "Nome do paciente" },
              birth_date: { type: "string", description: "Data de nascimento YYYY-MM-DD" },
              phone: { type: "string", description: "Telefone do paciente" }
            },
            required: ["patient_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "reschedule_appointment",
          description: "Remarcar um agendamento existente",
          parameters: {
            type: "object",
            properties: {
              appointment_id: { type: "string", description: "ID do agendamento" },
              new_date: { type: "string", description: "Nova data YYYY-MM-DD" },
              new_time: { type: "string", description: "Novo horário HH:MM" },
              reason: { type: "string", description: "Motivo da remarcação" }
            },
            required: ["appointment_id", "new_date", "new_time"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "cancel_appointment",
          description: "Cancelar um agendamento",
          parameters: {
            type: "object",
            properties: {
              appointment_id: { type: "string", description: "ID do agendamento" },
              reason: { type: "string", description: "Motivo do cancelamento" }
            },
            required: ["appointment_id", "reason"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_availability",
          description: "Consultar horários disponíveis",
          parameters: {
            type: "object",
            properties: {
              doctor_name: { type: "string", description: "Nome do médico" },
              date: { type: "string", description: "Data para consultar YYYY-MM-DD" },
              service_name: { type: "string", description: "Nome do exame/consulta" }
            },
            required: ["doctor_name", "date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_patient",
          description: "Buscar informações de um paciente",
          parameters: {
            type: "object",
            properties: {
              search_term: { type: "string", description: "Nome, telefone ou data de nascimento" }
            },
            required: ["search_term"]
          }
        }
      }
    ];

    // Chamar OpenAI com o contexto da mensagem
    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente virtual da clínica Endogastro especializado em agendamentos médicos.
            
MÉDICOS DISPONÍVEIS:
- Dr. Alessandro Costa (Colonoscopia, Endoscopia)
- Dr. Dilson Barreto (Colonoscopia, Endoscopia, Videolaparoscopia)
- Dra. Carla Simões (Ultrassom, Ecocardiograma)

CONVÊNIOS ACEITOS:
- Unimed (todos os médicos)
- SulAmérica (todos os médicos)
- Particular (todos os médicos)

INSTRUÇÕES:
1. Seja sempre educado e profissional
2. Extraia informações da mensagem do paciente
3. Para agendamentos, você PRECISA de: nome, data nascimento, convênio, celular, médico, exame, data e horário
4. Se faltar informação, pergunte de forma amigável
5. Use as funções disponíveis para processar solicitações
6. Sempre confirme os dados antes de agendar
7. Em caso de erro, explique claramente e ofereça alternativas

Responda sempre em português de forma clara e amigável.`
          },
          {
            role: 'user',
            content: `Mensagem do WhatsApp:
De: ${from}${name ? ` (${name})` : ''}
Mensagem: ${message}`
          }
        ],
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    const llmData = await llmResponse.json();
    console.log("🤖 LLM Response:", JSON.stringify(llmData, null, 2));

    if (llmData.error) {
      throw new Error(`OpenAI Error: ${llmData.error.message}`);
    }

    const assistantMessage = llmData.choices[0].message;
    let finalResponse = assistantMessage.content;

    // Se o LLM decidiu usar uma função
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      console.log(`🔧 Calling function: ${functionName}`, functionArgs);

      // Mapear para o endpoint correto da llm-agent-api
      let endpoint = '';
      let payload = {};

      switch (functionName) {
        case 'schedule_appointment':
          endpoint = '/schedule';
          payload = {
            patient_name: functionArgs.patient_name,
            birth_date: functionArgs.birth_date,
            insurance: functionArgs.insurance,
            phone: functionArgs.phone || '',
            cell_phone: functionArgs.cell_phone,
            doctor_name: functionArgs.doctor_name,
            service_name: functionArgs.service_name,
            appointment_date: functionArgs.appointment_date,
            appointment_time: functionArgs.appointment_time,
            observations: functionArgs.observations || ''
          };
          break;

        case 'check_patient_appointments':
          endpoint = '/check-patient';
          payload = {
            patient_name: functionArgs.patient_name,
            birth_date: functionArgs.birth_date,
            phone: functionArgs.phone
          };
          break;

        case 'reschedule_appointment':
          endpoint = '/reschedule';
          payload = {
            appointment_id: functionArgs.appointment_id,
            new_date: functionArgs.new_date,
            new_time: functionArgs.new_time,
            reason: functionArgs.reason
          };
          break;

        case 'cancel_appointment':
          endpoint = '/cancel';
          payload = {
            appointment_id: functionArgs.appointment_id,
            reason: functionArgs.reason
          };
          break;

        case 'check_availability':
          endpoint = '/availability';
          payload = {
            doctor_name: functionArgs.doctor_name,
            date: functionArgs.date,
            service_name: functionArgs.service_name
          };
          break;

        case 'search_patient':
          endpoint = '/patient-search';
          payload = {
            search_term: functionArgs.search_term
          };
          break;

        default:
          throw new Error(`Unknown function: ${functionName}`);
      }

      // Chamar a LLM Agent API
      console.log(`📞 Calling LLM Agent API: ${endpoint}`);
      const agentResponse = await fetch(`https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify(payload)
      });

      const agentData = await agentResponse.json();
      console.log("📋 Agent API Response:", JSON.stringify(agentData, null, 2));

      // Processar resposta do agente e gerar resposta amigável
      if (agentData.success) {
        switch (functionName) {
          case 'schedule_appointment':
            finalResponse = `✅ *Agendamento realizado com sucesso!*\n\n📅 *Detalhes:*\n• Paciente: ${functionArgs.patient_name}\n• Médico: ${functionArgs.doctor_name}\n• Exame: ${functionArgs.service_name}\n• Data: ${new Date(functionArgs.appointment_date).toLocaleDateString('pt-BR')}\n• Horário: ${functionArgs.appointment_time}\n• Convênio: ${functionArgs.insurance}\n\n${agentData.message || ''}`;
            break;
          
          case 'check_patient_appointments':
            if (agentData.appointments && agentData.appointments.length > 0) {
              finalResponse = `📅 *Agendamentos encontrados:*\n\n`;
              agentData.appointments.forEach((apt: any, index: number) => {
                finalResponse += `${index + 1}. *${apt.service_name || apt.atendimento_nome}*\n`;
                finalResponse += `   📅 ${new Date(apt.appointment_date || apt.data_agendamento).toLocaleDateString('pt-BR')} às ${apt.appointment_time || apt.hora_agendamento}\n`;
                finalResponse += `   👨‍⚕️ ${apt.doctor_name || apt.medico_nome}\n`;
                finalResponse += `   📋 Status: ${apt.status}\n\n`;
              });
            } else {
              finalResponse = `❌ Nenhum agendamento encontrado para ${functionArgs.patient_name}.`;
            }
            break;

          case 'reschedule_appointment':
            finalResponse = `✅ *Agendamento remarcado com sucesso!*\n\n📅 *Nova data:* ${new Date(functionArgs.new_date).toLocaleDateString('pt-BR')} às ${functionArgs.new_time}\n\n${agentData.message || ''}`;
            break;

          case 'cancel_appointment':
            finalResponse = `✅ *Agendamento cancelado com sucesso.*\n\n📝 *Motivo:* ${functionArgs.reason}\n\n${agentData.message || ''}`;
            break;

          case 'check_availability':
            if (agentData.available_slots && agentData.available_slots.length > 0) {
              finalResponse = `⏰ *Horários disponíveis para ${functionArgs.doctor_name}:*\n\n`;
              agentData.available_slots.forEach((slot: string) => {
                finalResponse += `• ${slot}\n`;
              });
            } else {
              finalResponse = `❌ Não há horários disponíveis para ${functionArgs.doctor_name} na data ${new Date(functionArgs.date).toLocaleDateString('pt-BR')}.`;
            }
            break;

          case 'search_patient':
            if (agentData.patients && agentData.patients.length > 0) {
              finalResponse = `👥 *Pacientes encontrados:*\n\n`;
              agentData.patients.forEach((patient: any, index: number) => {
                finalResponse += `${index + 1}. *${patient.nome_completo}*\n`;
                finalResponse += `   📞 ${patient.celular || patient.telefone}\n`;
                finalResponse += `   📅 Nascimento: ${new Date(patient.data_nascimento).toLocaleDateString('pt-BR')}\n`;
                finalResponse += `   🏥 Convênio: ${patient.convenio}\n\n`;
              });
            } else {
              finalResponse = `❌ Nenhum paciente encontrado com "${functionArgs.search_term}".`;
            }
            break;
        }
      } else {
        finalResponse = `❌ *Erro:* ${agentData.error || agentData.message || 'Erro desconhecido'}\n\nPor favor, verifique as informações e tente novamente.`;
      }
    }

    // Adicionar informações de contato da clínica
    finalResponse += `\n\n---\n🏥 *Clínica Endogastro*\n📞 Para mais informações, entre em contato conosco.`;

    console.log("✅ Final response:", finalResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        response: finalResponse,
        from: from,
        timestamp: new Date().toISOString()
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
    console.error("❌ Error in whatsapp-llm-bridge:", error);
    
    const errorResponse = "❌ *Desculpe, ocorreu um erro interno.*\n\nPor favor, tente novamente em alguns minutos ou entre em contato diretamente com a clínica.\n\n🏥 *Clínica Endogastro*";
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        response: errorResponse,
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