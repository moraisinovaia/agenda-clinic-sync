import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ⚠️ SEGURANÇA: WhatsApp é processado via n8n (não diretamente nesta função)
// Esta função apenas prepara as notificações e salva no banco para n8n processar

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationTemplate {
  type: '48h' | '24h' | '2h' | '15min' | 'confirmacao' | 'followup';
  subject: string;
  message: string;
  includePreparos?: boolean;
  includeLocation?: boolean;
}

const templates: Record<string, NotificationTemplate> = {
  '48h': {
    type: '48h',
    subject: 'Lembrete: Consulta em 48h',
    message: `🗓️ *Lembrete de Consulta*

Olá {paciente_nome}! 

Sua consulta está marcada para *{data_consulta}* às *{hora_consulta}* com Dr(a). {medico_nome}.

📋 *{atendimento_nome}*
🏥 *Local:* Endogastro - Clínica de Gastroenterologia
📍 *Endereço:* [Inserir endereço da clínica]

{preparos_info}

Para confirmar sua presença, responda *SIM*.
Para cancelar ou remarcar, responda *NÃO*.

Qualquer dúvida, estamos à disposição! 😊`,
    includePreparos: true
  },
  '24h': {
    type: '24h',
    subject: 'Confirmação: Consulta amanhã',
    message: `⏰ *Confirmação de Presença*

Olá {paciente_nome}! 

Sua consulta é *AMANHÃ* ({data_consulta}) às *{hora_consulta}* com Dr(a). {medico_nome}.

📋 *{atendimento_nome}*

Por favor, confirme sua presença:
✅ Responda *SIM* para confirmar
❌ Responda *NÃO* para cancelar/remarcar

⚠️ *Importante:* Chegue 15 minutos antes do horário marcado.

{preparos_info}`,
    includePreparos: true
  },
  '2h': {
    type: '2h',
    subject: 'Sua consulta é em 2 horas',
    message: `🚨 *Consulta em 2 horas!*

Olá {paciente_nome}! 

Sua consulta é *HOJE* às *{hora_consulta}* com Dr(a). {medico_nome}.

📋 *{atendimento_nome}*
🏥 *Endogastro - Clínica de Gastroenterologia*
📍 *Endereço:* [Inserir endereço da clínica]
🗺️ *Google Maps:* [Inserir link do Maps]

⏰ *Chegue 15 minutos antes!*

Nos vemos em breve! 😊`,
    includeLocation: true
  },
  '15min': {
    type: '15min',
    subject: 'Paciente chegando em 15min',
    message: `🔔 *ALERTA PARA RECEPÇÃO*

O paciente *{paciente_nome}* tem consulta às *{hora_consulta}* com Dr(a). {medico_nome}.

📋 *{atendimento_nome}*
📱 *Celular:* {paciente_celular}

⏰ *Consulta em 15 minutos!*

Preparar:
- Ficha do paciente
- Sala de consulta
- Equipamentos necessários`,
    includeLocation: false
  },
  'confirmacao': {
    type: 'confirmacao',
    subject: 'Consulta confirmada',
    message: `✅ *Consulta Confirmada!*

Obrigado, {paciente_nome}! 

Sua presença foi confirmada para *{data_consulta}* às *{hora_consulta}*.

📋 *{atendimento_nome}*
👨‍⚕️ *Dr(a). {medico_nome}*

Nos vemos em breve! 😊

⚠️ *Lembre-se:* Chegue 15 minutos antes do horário marcado.`,
    includeLocation: false
  },
  'followup': {
    type: 'followup',
    subject: 'Como foi sua consulta?',
    message: `💙 *Obrigado por escolher a Endogastro!*

Olá {paciente_nome}! 

Esperamos que sua consulta com Dr(a). {medico_nome} tenha sido proveitosa.

Sua opinião é muito importante para nós! 

⭐ *Avalie nossa clínica:*
Digite de 1 a 5 estrelas ⭐

📝 *Deixe um comentário:*
Digite sua experiência (opcional)

Agradecemos sua confiança! 😊`
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'process';
    
    console.log(`📅 Notification Scheduler: ${action}`);

    if (action === 'process') {
      return await processScheduledNotifications(supabase);
    } else if (action === 'schedule') {
      const body = await req.json();
      return await scheduleNotification(supabase, body);
    } else if (action === 'analytics') {
      return await getNotificationAnalytics(supabase);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na API:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

async function processScheduledNotifications(supabase: any) {
  console.log('⚡ Iniciando processamento de notificações agendadas...');
  
  const currentTime = new Date();
  const notifications = [];

  // 1. BUSCAR AGENDAMENTOS PARA LEMBRETES
  const { data: appointments, error: appointmentsError } = await supabase
    .from('agendamentos')
    .select(`
      id,
      data_agendamento,
      hora_agendamento,
      status,
      convenio,
      observacoes,
      pacientes:paciente_id(nome_completo, celular, data_nascimento),
      medicos:medico_id(nome, especialidade),
      atendimentos:atendimento_id(nome, tipo)
    `)
    .in('status', ['agendado', 'confirmado'])
    .gte('data_agendamento', new Date().toISOString().split('T')[0]);

  if (appointmentsError) {
    throw appointmentsError;
  }

  // 2. PROCESSAR CADA TIPO DE NOTIFICAÇÃO
  for (const appointment of appointments || []) {
    const appointmentDateTime = new Date(`${appointment.data_agendamento}T${appointment.hora_agendamento}`);
    const timeDiff = appointmentDateTime.getTime() - currentTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Verificar se já foi enviada esta notificação
    const { data: existingNotif } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('agendamento_id', appointment.id)
      .single();

    // 48h antes (46-50h de antecedência)
    if (hoursDiff >= 46 && hoursDiff <= 50 && !existingNotif) {
      notifications.push({
        ...appointment,
        type: '48h',
        scheduledFor: new Date(appointmentDateTime.getTime() - 48 * 60 * 60 * 1000)
      });
    }

    // 24h antes (22-26h de antecedência)
    if (hoursDiff >= 22 && hoursDiff <= 26) {
      const { data: exists } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('agendamento_id', appointment.id)
        .eq('type', '24h')
        .single();

      if (!exists) {
        notifications.push({
          ...appointment,
          type: '24h',
          scheduledFor: new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000)
        });
      }
    }

    // 2h antes (1.5-2.5h de antecedência)
    if (hoursDiff >= 1.5 && hoursDiff <= 2.5) {
      const { data: exists } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('agendamento_id', appointment.id)
        .eq('type', '2h')
        .single();

      if (!exists) {
        notifications.push({
          ...appointment,
          type: '2h',
          scheduledFor: new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000)
        });
      }
    }

    // 15min antes (para a recepção)
    if (hoursDiff >= 0.2 && hoursDiff <= 0.3) {
      const { data: exists } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('agendamento_id', appointment.id)
        .eq('type', '15min')
        .single();

      if (!exists) {
        notifications.push({
          ...appointment,
          type: '15min',
          scheduledFor: new Date(appointmentDateTime.getTime() - 15 * 60 * 1000),
          isForStaff: true
        });
      }
    }
  }

  // 3. SALVAR NOTIFICAÇÕES NO BANCO PARA N8N PROCESSAR
  let saved = 0;
  let errors = 0;

  for (const notification of notifications) {
    try {
      await saveNotificationForN8N(supabase, notification);
      saved++;
    } catch (error) {
      console.error(`❌ Erro ao salvar notificação para ${notification.pacientes.nome_completo}:`, error);
      errors++;
    }
  }

  console.log(`✅ Processamento concluído: ${saved} salvas para n8n, ${errors} erros`);

  return new Response(
    JSON.stringify({
      success: true,
      processed: notifications.length,
      saved,
      errors,
      message: `${saved} notificações salvas para processamento via n8n`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function saveNotificationForN8N(supabase: any, notification: any) {
  const template = templates[notification.type];
  if (!template) {
    throw new Error(`Template não encontrado para tipo: ${notification.type}`);
  }

  // Buscar preparos se necessário
  let preparosInfo = '';
  if (template.includePreparos) {
    const { data: preparos } = await supabase
      .from('preparos')
      .select('*')
      .eq('atendimento_id', notification.atendimentos.id)
      .single();

    if (preparos) {
      preparosInfo = `\n\n📋 *PREPAROS NECESSÁRIOS:*\n${preparos.instrucoes}`;
    }
  }

  // Montar mensagem personalizada
  const message = template.message
    .replace(/{paciente_nome}/g, notification.pacientes.nome_completo)
    .replace(/{data_consulta}/g, new Date(notification.data_agendamento).toLocaleDateString('pt-BR'))
    .replace(/{hora_consulta}/g, notification.hora_agendamento.slice(0, 5))
    .replace(/{medico_nome}/g, notification.medicos.nome)
    .replace(/{atendimento_nome}/g, notification.atendimentos.nome)
    .replace(/{paciente_celular}/g, notification.pacientes.celular || 'Não informado')
    .replace(/{preparos_info}/g, preparosInfo);

  // Determinar destinatário
  const recipient = notification.isForStaff 
    ? '5511999999999' // Número da recepção - será configurado via n8n
    : notification.pacientes.celular;

  if (!recipient) {
    throw new Error('Destinatário não encontrado');
  }

  // ⚠️ SEGURANÇA: Apenas salva no banco - n8n é responsável por enviar via WhatsApp
  // Status 'pending_n8n' indica que n8n deve processar esta notificação
  await supabase
    .from('notification_logs')
    .insert({
      agendamento_id: notification.id,
      type: notification.type,
      recipient,
      message,
      status: 'pending_n8n', // n8n monitora esta tabela e envia via Evolution API
      sent_at: null, // Será preenchido pelo n8n após envio
      is_for_staff: notification.isForStaff || false
    });

  console.log(`📋 Notificação ${notification.type} salva para n8n processar: ${notification.pacientes.nome_completo}`);
}

async function scheduleNotification(supabase: any, body: any) {
  // Implementar agendamento manual de notificações
  const { agendamento_id, type, scheduled_for } = body;

  // Buscar dados do agendamento
  const { data: appointment, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      pacientes:paciente_id(*),
      medicos:medico_id(*),
      atendimentos:atendimento_id(*)
    `)
    .eq('id', agendamento_id)
    .single();

  if (error || !appointment) {
    throw new Error('Agendamento não encontrado');
  }

  // Agendar notificação
  await supabase
    .from('scheduled_notifications')
    .insert({
      agendamento_id,
      type,
      scheduled_for,
      status: 'pending'
    });

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Notificação agendada com sucesso'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getNotificationAnalytics(supabase: any) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Métricas de notificações
  const { data: analytics, error } = await supabase
    .from('notification_logs')
    .select('type, status, sent_at, is_for_staff')
    .gte('sent_at', thirtyDaysAgo.toISOString());

  if (error) {
    throw error;
  }

  // Processar analytics
  const stats: any = {
    total_sent: analytics?.length || 0,
    by_type: {} as any,
    by_status: {} as any,
    success_rate: 0,
    daily_stats: {} as any
  };

  analytics?.forEach((log: any) => {
    // Por tipo
    stats.by_type[log.type] = (stats.by_type[log.type] || 0) + 1;
    
    // Por status
    stats.by_status[log.status] = (stats.by_status[log.status] || 0) + 1;
    
    // Por dia
    if (log.sent_at) {
      const day = log.sent_at.split('T')[0];
      stats.daily_stats[day] = (stats.daily_stats[day] || 0) + 1;
    }
  });

  stats.success_rate = stats.total_sent > 0 
    ? Math.round((stats.by_status['sent'] || 0) / stats.total_sent * 100)
    : 0;

  return new Response(
    JSON.stringify({
      success: true,
      analytics: stats
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
