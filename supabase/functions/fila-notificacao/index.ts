import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar notificações pendentes
    const { data: notificacoesPendentes, error: errorNotif } = await supabaseClient
      .from('fila_notificacoes')
      .select(`
        *,
        fila_espera!inner(
          *,
          pacientes(*),
          medicos(*),
          atendimentos(*)
        )
      `)
      .eq('status_envio', 'pendente')
      .gt('tempo_limite', new Date().toISOString())

    if (errorNotif) {
      console.error('Erro ao buscar notificações:', errorNotif)
      throw errorNotif
    }

    console.log(`📱 Processando ${notificacoesPendentes?.length || 0} notificações`)

    for (const notificacao of notificacoesPendentes || []) {
      try {
        const fila = notificacao.fila_espera
        const paciente = fila.pacientes
        const medico = fila.medicos
        const atendimento = fila.atendimentos

        const mensagem = `🏥 *VAGA DISPONÍVEL - ENDOGASTRO*

Olá ${paciente.nome_completo}! 

Uma vaga ficou disponível:
📅 *Data:* ${new Date(notificacao.data_agendamento).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${notificacao.hora_agendamento}
👨‍⚕️ *Médico:* ${medico.nome}
🔬 *Exame:* ${atendimento.nome}

⚡ *RESPONDA RAPIDAMENTE!*
Você tem até ${new Date(notificacao.tempo_limite).toLocaleString('pt-BR')} para confirmar.

Digite:
✅ *SIM* - Para aceitar a vaga
❌ *NÃO* - Para recusar

_Esta é uma oportunidade única da fila de espera._`

        // Enviar WhatsApp via Evolution API
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.inovaia.online'
        const apiKey = Deno.env.get('EVOLUTION_API_KEY') || 'grozNCsxwy32iYir20LRw7dfIRNPI8UZ'
        const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'Endogastro'

        const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          body: JSON.stringify({
            number: paciente.celular,
            text: mensagem
          })
        })

        if (response.ok) {
          // Marcar como enviado
          await supabaseClient
            .from('fila_notificacoes')
            .update({ status_envio: 'enviado' })
            .eq('id', notificacao.id)

          console.log(`✅ Notificação enviada para ${paciente.nome_completo}`)
        } else {
          // Marcar como erro
          await supabaseClient
            .from('fila_notificacoes')
            .update({ status_envio: 'erro' })
            .eq('id', notificacao.id)

          console.error(`❌ Erro ao enviar para ${paciente.celular}`)
        }

      } catch (error) {
        console.error('Erro ao processar notificação:', error)
        
        // Marcar como erro
        await supabaseClient
          .from('fila_notificacoes')
          .update({ status_envio: 'erro' })
          .eq('id', notificacao.id)
      }
    }

    // Processar notificações expiradas
    const { data: notificacoesExpiradas, error: errorExp } = await supabaseClient
      .from('fila_notificacoes')
      .select('*, fila_espera(*)')
      .eq('status_envio', 'enviado')
      .eq('resposta_paciente', 'sem_resposta')
      .lt('tempo_limite', new Date().toISOString())

    if (notificacoesExpiradas?.length) {
      console.log(`⏰ Processando ${notificacoesExpiradas.length} notificações expiradas`)
      
      for (const exp of notificacoesExpiradas) {
        // Voltar para aguardando na fila
        await supabaseClient
          .from('fila_espera')
          .update({ status: 'aguardando' })
          .eq('id', exp.fila_id)

        // Marcar resposta como sem_resposta
        await supabaseClient
          .from('fila_notificacoes')
          .update({ resposta_paciente: 'sem_resposta' })
          .eq('id', exp.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: notificacoesPendentes?.length || 0,
        expired: notificacoesExpiradas?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ error: (error as any).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})