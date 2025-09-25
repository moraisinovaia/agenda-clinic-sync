import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AvailabilityRequest {
  doctorId?: string;
  date?: string;
  specialty?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { doctorId, date, specialty }: AvailabilityRequest = await req.json();
    
    const requestedDate = date || new Date().toISOString().split('T')[0];
    
    // Buscar médicos ativos
    let doctorsQuery = supabase
      .from('medicos')
      .select('id, nome, especialidade, horarios')
      .eq('ativo', true);
    
    if (doctorId) {
      doctorsQuery = doctorsQuery.eq('id', doctorId);
    }
    
    if (specialty) {
      doctorsQuery = doctorsQuery.ilike('especialidade', `%${specialty}%`);
    }
    
    const { data: doctors, error: doctorsError } = await doctorsQuery;
    
    if (doctorsError) {
      throw new Error(`Erro ao buscar médicos: ${doctorsError.message}`);
    }

    if (!doctors || doctors.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Nenhum médico encontrado para os critérios especificados.",
          available: false,
          suggestions: "Tente com outro médico ou especialidade."
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Buscar agendamentos existentes para a data
    const { data: appointments, error: appointmentsError } = await supabase
      .from('agendamentos')
      .select('medico_id, hora_agendamento, status')
      .eq('data_agendamento', requestedDate)
      .in('status', ['agendado', 'confirmado']);

    if (appointmentsError) {
      throw new Error(`Erro ao buscar agendamentos: ${appointmentsError.message}`);
    }

    // Verificar bloqueios de agenda
    const { data: blocks, error: blocksError } = await supabase
      .from('bloqueios_agenda')
      .select('medico_id')
      .eq('status', 'ativo')
      .lte('data_inicio', requestedDate)
      .gte('data_fim', requestedDate);

    if (blocksError) {
      throw new Error(`Erro ao verificar bloqueios: ${blocksError.message}`);
    }

    const blockedDoctors = new Set(blocks?.map(b => b.medico_id) || []);
    const occupiedSlots = new Map();
    
    appointments?.forEach(apt => {
      if (!occupiedSlots.has(apt.medico_id)) {
        occupiedSlots.set(apt.medico_id, []);
      }
      occupiedSlots.get(apt.medico_id).push(apt.hora_agendamento);
    });

    // Horários padrão (8h às 18h, de hora em hora)
    const defaultHours = [
      '08:00', '09:00', '10:00', '11:00',
      '14:00', '15:00', '16:00', '17:00', '18:00'
    ];

    const availabilityInfo = doctors.map(doctor => {
      if (blockedDoctors.has(doctor.id)) {
        return {
          doctor: {
            id: doctor.id,
            nome: doctor.nome,
            especialidade: doctor.especialidade
          },
          available: false,
          reason: 'Agenda bloqueada',
          availableSlots: []
        };
      }

      const doctorHours = doctor.horarios?.horarios || defaultHours;
      const occupied = occupiedSlots.get(doctor.id) || [];
      const availableSlots = doctorHours.filter((hour: string) => !occupied.includes(hour));

      return {
        doctor: {
          id: doctor.id,
          nome: doctor.nome,
          especialidade: doctor.especialidade
        },
        available: availableSlots.length > 0,
        availableSlots: availableSlots.sort(),
        totalSlots: doctorHours.length,
        occupiedSlots: occupied.length
      };
    });

    const hasAvailability = availabilityInfo.some(info => info.available);

    // Gerar resposta amigável para WhatsApp
    let message = `📅 *Disponibilidade para ${new Date(requestedDate).toLocaleDateString('pt-BR')}*\n\n`;
    
    if (!hasAvailability) {
      message += "❌ *Não há horários disponíveis* para esta data.\n\n";
      message += "💡 *Sugestões:*\n";
      message += "• Tente outra data\n";
      message += "• Consulte a fila de espera\n";
      message += "• Entre em contato conosco: (11) 1234-5678";
    } else {
      availabilityInfo.forEach(info => {
        if (info.available) {
          message += `✅ *Dr(a). ${info.doctor.nome}* (${info.doctor.especialidade})\n`;
          message += `📍 Horários: ${info.availableSlots.join(', ')}\n\n`;
        } else if (info.reason) {
          message += `❌ *Dr(a). ${info.doctor.nome}* - ${info.reason}\n\n`;
        } else {
          message += `🔴 *Dr(a). ${info.doctor.nome}* - Sem horários disponíveis\n\n`;
        }
      });
      
      message += "\n📞 Para agendar, ligue: (11) 1234-5678";
    }

    return new Response(
      JSON.stringify({
        date: requestedDate,
        available: hasAvailability,
        message,
        details: availabilityInfo,
        totalDoctors: doctors.length,
        availableDoctors: availabilityInfo.filter(info => info.available).length
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in whatsapp-availability function:', error);
    
    return new Response(
      JSON.stringify({
        error: (error as any).message,
        message: "❌ Erro ao consultar disponibilidade. Tente novamente em alguns instantes ou entre em contato conosco.",
        available: false
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});