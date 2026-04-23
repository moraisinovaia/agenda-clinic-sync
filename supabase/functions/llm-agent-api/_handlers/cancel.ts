import {
  CancelAppointmentUseCase,
  SupabaseAppointmentRepository,
  AppointmentNotFoundError,
  InvalidStatusTransitionError,
} from '../../_shared/scheduling-core/index.ts'
import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse, businessErrorResponse } from '../_lib/responses.ts'
import { getRequestScope, isAppointmentAllowed, getScopeSummary } from '../_lib/scope.ts'

export async function handleCancel(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    const { agendamento_id, motivo } = body;

    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Buscar dados completos (joins) para escopo check e shape de resposta
    // — separado do findById do use case que não carrega joins
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        status,
        data_agendamento,
        hora_agendamento,
        medico_id,
        atendimento_id,
        pacientes(nome_completo, celular),
        medicos(nome),
        atendimentos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .is('excluido_em', null)
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    if (!isAppointmentAllowed(agendamento.medico_id, agendamento.medicos?.nome, agendamento.atendimentos?.nome, scope)) {
      return businessErrorResponse({
        codigo_erro: 'AGENDAMENTO_FORA_DO_ESCOPO',
        mensagem_usuario: `❌ Este agendamento não pertence ao escopo deste canal.\n\nEscopo atual: ${getScopeSummary(scope)}.`,
        detalhes: {
          agendamento_id,
          medico_id: agendamento.medico_id,
          medico_nome: agendamento.medicos?.nome || null,
          atendimento_nome: agendamento.atendimentos?.nome || null
        }
      });
    }

    // Cancelar via use case — valida transição e persiste
    const cancelRepo = new SupabaseAppointmentRepository(supabase);
    try {
      await new CancelAppointmentUseCase(cancelRepo).execute({
        appointmentId: agendamento_id,
        clienteId,
        motivo,
        canceladoPor: 'LLM Agent WhatsApp',
      });
    } catch (err: any) {
      if (err instanceof AppointmentNotFoundError) {
        return errorResponse('Agendamento não encontrado');
      }
      if (err instanceof InvalidStatusTransitionError) {
        return errorResponse('Consulta já está cancelada');
      }
      throw err;
    }

    // ============= LER RESULTADO DO TRIGGER PG (FILA DE ESPERA) =============
    // O trigger processar_fila_cancelamento já processou a fila no UPDATE acima.
    // Aqui apenas lemos o resultado para incluir na resposta da API (para n8n/WhatsApp).
    let filaEsperaNotificado: any = null;
    try {
      console.log(`🔍 [FILA-ESPERA] Verificando se trigger PG notificou alguém da fila...`);

      const { data: notifCriada, error: notifError } = await supabase
        .from('fila_notificacoes')
        .select(`
          id,
          fila_id,
          data_agendamento,
          hora_agendamento,
          tempo_limite,
          fila_espera!inner(
            id,
            paciente_id,
            medico_id,
            atendimento_id,
            pacientes(nome_completo, celular)
          )
        `)
        .eq('data_agendamento', agendamento.data_agendamento)
        .eq('hora_agendamento', agendamento.hora_agendamento)
        .eq('fila_espera.medico_id', agendamento.medico_id)
        .eq('cliente_id', clienteId)
        .gte('created_at', new Date(Date.now() - 5000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (notifError) {
        console.error('⚠️ [FILA-ESPERA] Erro ao consultar resultado do trigger (ignorado):', notifError.message);
      } else if (notifCriada?.fila_espera) {
        const fe = notifCriada.fila_espera as any;
        console.log(`✅ [FILA-ESPERA] Trigger PG notificou: ${fe.pacientes?.nome_completo} (fila_id: ${notifCriada.fila_id})`);

        filaEsperaNotificado = {
          fila_id: notifCriada.fila_id,
          paciente_nome: fe.pacientes?.nome_completo,
          paciente_celular: fe.pacientes?.celular,
          medico_nome: agendamento.medicos?.nome,
          data_disponivel: notifCriada.data_agendamento,
          hora_disponivel: notifCriada.hora_agendamento,
          tempo_limite: notifCriada.tempo_limite,
          atendimento_id: fe.atendimento_id
        };

        // Webhook disparado pelo trigger PG (trigger_notificar_fila_webhook) no INSERT acima
      } else {
        console.log('ℹ️ [FILA-ESPERA] Trigger PG não encontrou candidato na fila');
      }
    } catch (filaErr: any) {
      console.error('⚠️ [FILA-ESPERA] Erro ao ler resultado do trigger (ignorado):', filaErr?.message);
      // NUNCA bloqueia — o cancelamento já foi feito com sucesso
    }

    const responseData: any = {
      message: `Consulta cancelada com sucesso`,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data: agendamento.data_agendamento,
      hora: agendamento.hora_agendamento,
      motivo,
      validado: true
    };

    // Adicionar dados da fila se alguém foi notificado
    if (filaEsperaNotificado) {
      responseData.fila_espera_notificado = filaEsperaNotificado;
      responseData.message += `. Paciente da fila de espera notificado: ${filaEsperaNotificado.paciente_nome}`;
    }

    return successResponse(responseData);

  } catch (error: any) {
    return errorResponse(`Erro ao cancelar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}
