import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse, businessErrorResponse } from '../_lib/responses.ts'
import { getRequestScope, isAppointmentAllowed, getScopeSummary } from '../_lib/scope.ts'
import { getMedicoRules } from '../_lib/limites.ts'
import { BUSINESS_RULES } from '../_lib/tipo-agendamento.ts'

export async function handleConfirm(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    const { agendamento_id, observacoes } = body;

    // Validação
    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Buscar agendamento
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        status,
        data_agendamento,
        hora_agendamento,
        observacoes,
        medico_id,
        atendimento_id,
        pacientes(nome_completo, celular),
        medicos(nome),
        atendimentos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
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

    // Validar status atual
    if (agendamento.status === 'cancelado') {
      return errorResponse('Não é possível confirmar consulta cancelada');
    }

    if (agendamento.status === 'confirmado') {
      return successResponse({
        message: 'Consulta já está confirmada',
        agendamento_id,
        paciente: agendamento.pacientes?.nome_completo,
        medico: agendamento.medicos?.nome,
        data: agendamento.data_agendamento,
        hora: agendamento.hora_agendamento,
        already_confirmed: true,
        validado: true
      });
    }

    if (agendamento.status === 'realizado') {
      return errorResponse('Consulta já foi realizada');
    }

    // Validar se a data não passou
    const dataAgendamento = new Date(agendamento.data_agendamento + 'T' + agendamento.hora_agendamento);
    const agora = new Date();

    if (dataAgendamento < agora) {
      return errorResponse('Não é possível confirmar consulta que já passou');
    }

    // Preparar observações
    const observacoes_confirmacao = observacoes
      ? `${agendamento.observacoes || ''}\nConfirmado via LLM Agent: ${observacoes}`.trim()
      : `${agendamento.observacoes || ''}\nConfirmado via LLM Agent WhatsApp`.trim();

    // Atualizar para confirmado
    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        status: 'confirmado',
        observacoes: observacoes_confirmacao,
        confirmado_em: new Date().toISOString(),
        confirmado_por: 'whatsapp_automatico',
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId);

    if (updateError) {
      return errorResponse(`Erro ao confirmar: ${updateError.message}`);
    }

    console.log(`✅ Agendamento ${agendamento_id} confirmado com sucesso`);

    // Mensagem dinâmica baseada nas business_rules do médico
    let mensagemConfirmacao = 'Consulta confirmada com sucesso';

    // Buscar regras dinâmicas do médico (usar config + hardcoded fallback)
    const regrasConfirmar = getMedicoRules(config, agendamento.medico_id, BUSINESS_RULES.medicos[agendamento.medico_id]);
    console.log(`🔍 [CONFIRM] Regras encontradas: ${regrasConfirmar ? 'SIM' : 'NÃO'}, tipo: ${regrasConfirmar?.tipo_agendamento || 'N/A'}`);

    if (regrasConfirmar && regrasConfirmar.tipo_agendamento === 'ordem_chegada') {
      const servicosConf = regrasConfirmar.servicos || {};
      // Buscar primeiro serviço com periodos definidos
      const primeiroServicoConf = Object.values(servicosConf).find((s: any) => s.periodos && Object.keys(s.periodos).length > 0) as any;
      console.log(`🔍 [CONFIRM] Primeiro serviço com períodos: ${primeiroServicoConf ? 'ENCONTRADO' : 'NÃO'}`);

      if (primeiroServicoConf?.periodos) {
        const periodosConf = primeiroServicoConf.periodos;
        const [horaConf] = agendamento.hora_agendamento.split(':').map(Number);
        console.log(`🔍 [CONFIRM] Hora: ${horaConf}, Períodos: manha=${!!periodosConf.manha}, tarde=${!!periodosConf.tarde}`);

        let periodoConfigConf: any = null;
        let periodoNomeConf = '';

        // Detectar período (usar contagem_inicio/fim para range amplo)
        const manhaConf = periodosConf.manha;
        const tardeConf = periodosConf.tarde;

        if (manhaConf) {
          const hIniConf = parseInt((manhaConf.contagem_inicio || manhaConf.inicio || manhaConf.horario_inicio || '00:00').split(':')[0]);
          const hFimConf = parseInt((manhaConf.contagem_fim || manhaConf.fim || manhaConf.horario_fim || '12:00').split(':')[0]);
          console.log(`🔍 [CONFIRM] Manha range: ${hIniConf}-${hFimConf}, hora=${horaConf}`);
          if (horaConf >= hIniConf && horaConf < hFimConf) {
            periodoConfigConf = manhaConf;
            periodoNomeConf = 'manhã';
          }
        }
        if (tardeConf && !periodoConfigConf) {
          const hIniConf = parseInt((tardeConf.contagem_inicio || tardeConf.inicio || tardeConf.horario_inicio || '12:00').split(':')[0]);
          const hFimConf = parseInt((tardeConf.contagem_fim || tardeConf.fim || tardeConf.horario_fim || '18:00').split(':')[0]);
          console.log(`🔍 [CONFIRM] Tarde range: ${hIniConf}-${hFimConf}, hora=${horaConf}`);
          if (horaConf >= hIniConf && horaConf < hFimConf) {
            periodoConfigConf = tardeConf;
            periodoNomeConf = 'tarde';
          }
        }

        console.log(`🔍 [CONFIRM] Período detectado: ${periodoNomeConf || 'NENHUM'}`);

        if (periodoConfigConf) {
          const horaInicioConf = periodoConfigConf.inicio || periodoConfigConf.horario_inicio || '';
          const horaFimConf = periodoConfigConf.fim || periodoConfigConf.horario_fim || '';
          const distribuicaoFichasConf = periodoConfigConf.distribuicao_fichas ||
            `${horaInicioConf.substring(0,5)} às ${horaFimConf.substring(0,5)}`;
          const atendimentoInicioConf = periodoConfigConf.atendimento_inicio;

          const dataFormatadaConf = new Date(agendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });

          mensagemConfirmacao = `✅ Consulta confirmada para ${dataFormatadaConf} no período da ${periodoNomeConf} (${distribuicaoFichasConf})`;

          if (atendimentoInicioConf) {
            mensagemConfirmacao += `. Dr. começa a atender às ${atendimentoInicioConf}`;
          }

          mensagemConfirmacao += `, por ordem de chegada.`;
          console.log(`💬 Confirmação com período: ${periodoNomeConf} (${distribuicaoFichasConf})`);
        }
      }
    }

    return successResponse({
      message: mensagemConfirmacao,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      celular: agendamento.pacientes?.celular,
      medico: agendamento.medicos?.nome,
      data: agendamento.data_agendamento,
      hora: agendamento.hora_agendamento,
      status: 'confirmado',
      confirmado_em: new Date().toISOString(),
      validado: true
    });

  } catch (error: any) {
    console.error('❌ Erro ao confirmar agendamento:', error);
    return errorResponse(`Erro ao confirmar: ${error?.message || 'Erro desconhecido'}`);
  }
}
