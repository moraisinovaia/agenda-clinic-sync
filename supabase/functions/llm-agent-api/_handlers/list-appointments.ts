import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse } from '../_lib/responses.ts'
import { getRequestScope, isAppointmentAllowed } from '../_lib/scope.ts'
import { getDataAtualBrasil } from '../_lib/tipo-agendamento.ts'

export async function handleListAppointments(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    const { medico_nome, data } = body;

    if (!medico_nome || !data) {
      return errorResponse('Campos obrigatórios: medico_nome, data (formato YYYY-MM-DD ou "CURRENT_DATE")');
    }

    // Normalizar data
    let dataFormatada = data;
    if (data === 'CURRENT_DATE' || data.toLowerCase() === 'hoje' || data.toLowerCase() === 'today') {
      dataFormatada = getDataAtualBrasil();
      console.log(`📅 Data convertida de "${data}" para ${dataFormatada}`);
    }

    // Validar formato de data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFormatada)) {
      return errorResponse('Data inválida. Use formato YYYY-MM-DD ou "CURRENT_DATE"');
    }

    console.log(`📋 Listando agendamentos: médico="${medico_nome}", data=${dataFormatada}`);

    // Chamar função do banco que retorna TODOS os médicos que correspondem à busca
    const { data: agendamentos, error } = await supabase
      .rpc('listar_agendamentos_medico_dia', {
        p_cliente_id: clienteId,
        p_nome_medico: medico_nome,
        p_data: dataFormatada
      });

    if (error) {
      console.error('❌ Erro ao listar agendamentos:', error);
      return errorResponse(`Erro ao buscar agendamentos: ${error.message}`);
    }

    const agendamentosFiltrados = (agendamentos || []).filter((agendamento: any) =>
      isAppointmentAllowed(
        agendamento.medico_id || agendamento.id_medico,
        agendamento.medico_nome || agendamento.nome_medico || agendamento['Médico'],
        agendamento.atendimento_nome || agendamento.tipo_atendimento || agendamento['Tipo de atendimento'],
        scope
      )
    );

    if (agendamentosFiltrados.length === 0) {
      const mensagem = `Não foi encontrado nenhum agendamento para o Dr. ${medico_nome} em ${dataFormatada}.`;
      return successResponse({
        encontrado: false,
        agendamentos: [],
        total: 0,
        message: mensagem,
        data_busca: dataFormatada,
        medico_busca: medico_nome
      });
    }

    // Agrupar por período e tipo de atendimento
    const manha = agendamentosFiltrados.filter((a: any) => a.periodo === 'manhã');
    const tarde = agendamentosFiltrados.filter((a: any) => a.periodo === 'tarde');

    // Contar tipos
    const tiposCount: Record<string, number> = {};
    agendamentosFiltrados.forEach((a: any) => {
      tiposCount[a.tipo_atendimento] = (tiposCount[a.tipo_atendimento] || 0) + 1;
    });

    // Formatar mensagem amigável
    const tiposLista = Object.entries(tiposCount)
      .map(([tipo, qtd]) => `${qtd} ${tipo}${qtd > 1 ? 's' : ''}`)
      .join(', ');

    const mensagem = `Encontrei ${agendamentosFiltrados.length} agendamento(s) para o Dr. ${medico_nome} em ${dataFormatada}:\n\n` +
      `📊 Resumo: ${tiposLista}\n\n` +
      (manha.length > 0 ? `☀️ Manhã: ${manha.length} agendamento(s)\n` : '') +
      (tarde.length > 0 ? `🌙 Tarde: ${tarde.length} agendamento(s)\n` : '');

    console.log(`✅ Encontrados ${agendamentosFiltrados.length} agendamentos (${manha.length} manhã, ${tarde.length} tarde)`);

    return successResponse({
      encontrado: true,
      agendamentos: agendamentosFiltrados,
      total: agendamentosFiltrados.length,
      resumo: {
        total: agendamentosFiltrados.length,
        manha: manha.length,
        tarde: tarde.length,
        tipos: tiposCount
      },
      message: mensagem,
      data_busca: dataFormatada,
      medico_busca: medico_nome
    });

  } catch (error: any) {
    console.error('❌ Erro ao processar list-appointments:', error);
    return errorResponse(`Erro ao processar requisição: ${error.message}`);
  }
}
