import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse } from '../_lib/responses.ts'
import { getRequestScope, filterDoctorsByScope } from '../_lib/scope.ts'
import { normalizarPeriodo } from '../_lib/config.ts'

// ============= HANDLER: HORÁRIOS DOS MÉDICOS =============

/**
 * Retorna os dias e horários de atendimento dos médicos da clínica
 * Lê diretamente das business_rules para garantir dados sempre atualizados
 */
export async function handleDoctorSchedules(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    console.log('📥 [DOCTOR-SCHEDULES] Buscando horários para cliente:', clienteId);
    
    const { medico_nome, servico_nome } = body;
    
    // Buscar médicos ativos com convênios
    let query = supabase
      .from('medicos')
      .select('id, nome, especialidade, convenios_aceitos, ativo')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('nome');

    if (scope.doctorIds.length > 0) {
      query = query.in('id', scope.doctorIds);
    }
    
    // Filtrar por nome do médico se fornecido
    if (medico_nome) {
      const nomeBusca = medico_nome.toLowerCase().trim();
      query = query.ilike('nome', `%${nomeBusca}%`);
    }
    
    const { data: medicos, error } = await query;
    
    if (error) {
      console.error('❌ Erro ao buscar médicos:', error);
      return errorResponse(`Erro ao buscar médicos: ${error.message}`);
    }
    
    const medicosFiltrados = filterDoctorsByScope(medicos || [], scope);

    if (!medicosFiltrados || medicosFiltrados.length === 0) {
      return successResponse({
        success: true,
        medicos: [],
        message: medico_nome 
          ? `Nenhum médico encontrado com o nome "${medico_nome}"`
          : 'Nenhum médico ativo encontrado',
        mensagem_whatsapp: medico_nome
          ? `Não encontrei nenhum médico com o nome "${medico_nome}". Deseja ver a lista completa de médicos?`
          : 'Não há médicos ativos no momento.'
      });
    }
    
    // Função helper para formatar dias da semana
    const formatarDias = (diasArray: number[]): string => {
      if (!diasArray || diasArray.length === 0) return 'Não definido';
      
      const diasOrdenados = [...diasArray].sort((a, b) => a - b);
      const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const diasCompletos = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      // Verificar padrões comuns
      if (diasOrdenados.join(',') === '1,2,3,4,5') return 'Segunda a Sexta';
      if (diasOrdenados.join(',') === '1,2,3,4,5,6') return 'Segunda a Sábado';
      if (diasOrdenados.join(',') === '0,1,2,3,4,5,6') return 'Todos os dias';
      
      // Para 2 dias
      if (diasOrdenados.length === 2) {
        return `${diasCompletos[diasOrdenados[0]]} e ${diasCompletos[diasOrdenados[1]]}`;
      }
      
      // Para outros casos
      return diasOrdenados.map(d => diasNomes[d]).join(', ');
    };
    
    // Função helper para formatar dias abreviados (para WhatsApp)
    const formatarDiasAbreviado = (diasArray: number[]): string => {
      if (!diasArray || diasArray.length === 0) return '-';
      
      const diasOrdenados = [...diasArray].sort((a, b) => a - b);
      const diasAbrev = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      
      if (diasOrdenados.join(',') === '1,2,3,4,5') return 'Seg-Sex';
      if (diasOrdenados.join(',') === '1,2,3,4,5,6') return 'Seg-Sáb';
      if (diasOrdenados.join(',') === '0,1,2,3,4,5,6') return 'Todos';
      
      if (diasOrdenados.length === 2) {
        return `${diasAbrev[diasOrdenados[0]]}/${diasAbrev[diasOrdenados[1]]}`;
      }
      
      return diasOrdenados.map(d => diasAbrev[d]).join('/');
    };
    
    // Processar cada médico
    const medicosComHorarios = [];
    const mensagensWhatsApp: string[] = [];
    
    for (const medico of medicosFiltrados) {
      // Obter business_rules do médico
      const regras = config?.business_rules?.[medico.id]?.config;
      
      if (!regras) {
        console.log(`⚠️ Sem business_rules para médico ${medico.nome}`);
        continue;
      }
      
      const servicos = regras.servicos || {};
      const tipoAgendamento = regras.tipo_agendamento || 'hora_marcada';
      const especialidade = medico.especialidade || regras.especialidade || '';
      
      const servicosProcessados: any[] = [];
      let linhasServico: string[] = [];
      
      // Processar cada serviço
      for (const [servicoKey, servicoConfig] of Object.entries(servicos as Record<string, any>)) {
        // Filtrar por nome do serviço se fornecido
        if (servico_nome) {
          const nomeBusca = servico_nome.toLowerCase().trim();
          const nomeServico = servicoConfig.nome?.toLowerCase() || servicoKey.toLowerCase();
          if (!nomeServico.includes(nomeBusca) && !servicoKey.toLowerCase().includes(nomeBusca)) {
            continue;
          }
        }
        
        const diasSemana = servicoConfig.dias_semana || [];
        const periodos = servicoConfig.periodos || {};
        const permiteOnline = servicoConfig.permite_agendamento_online !== false;
        const mensagemPersonalizada = servicoConfig.mensagem_pos_agendamento || '';
        
        // Processar períodos ativos
        const periodosAtivos: any[] = [];
        const periodosTexto: string[] = [];
        
        for (const [periodoNome, periodoConfig] of Object.entries(periodos as Record<string, any>)) {
          if (!periodoConfig.ativo) continue;
          
          // Normalizar período para pegar horários
          const periodoNorm = normalizarPeriodo(periodoConfig);
          
          const horarioInicio = periodoNorm.inicio || periodoNorm.contagem_inicio || periodoNorm.horario_inicio || '';
          const horarioFim = periodoNorm.fim || periodoNorm.contagem_fim || periodoNorm.horario_fim || '';
          const limite = periodoConfig.limite || periodoConfig.limite_pacientes || null;
          
          const periodoNomeFormatado = periodoNome === 'manha' ? 'Manhã' : 
                                        periodoNome === 'tarde' ? 'Tarde' : 
                                        periodoNome === 'noite' ? 'Noite' : periodoNome;
          
          periodosAtivos.push({
            periodo: periodoNomeFormatado,
            horario_inicio: horarioInicio,
            horario_fim: horarioFim,
            limite_pacientes: limite,
            tipo: tipoAgendamento === 'ordem_chegada' ? 'ordem_chegada' : 'hora_marcada'
          });
          
          // Formatar para texto
          if (horarioInicio && horarioFim) {
            periodosTexto.push(`${periodoNomeFormatado.toLowerCase()} ${horarioInicio}-${horarioFim}`);
          } else {
            periodosTexto.push(periodoNomeFormatado.toLowerCase());
          }
        }
        
        if (periodosAtivos.length === 0) continue;
        
        const servicoProcessado = {
          nome: servicoConfig.nome || servicoKey.replace(/_/g, ' '),
          key: servicoKey,
          tipo: servicoConfig.tipo || 'consulta',
          permite_agendamento_online: permiteOnline,
          dias_atendimento: formatarDias(diasSemana),
          dias_semana: diasSemana,
          periodos: periodosAtivos,
          tipo_agendamento: tipoAgendamento,
          mensagem_personalizada: mensagemPersonalizada || null
        };
        
        servicosProcessados.push(servicoProcessado);
        
        // Linha para WhatsApp
        const diasAbrev = formatarDiasAbreviado(diasSemana);
        const horariosTexto = periodosTexto.join(', ');
        const tipoTexto = tipoAgendamento === 'ordem_chegada' ? '(ordem de chegada)' : '';
        linhasServico.push(`   • ${servicoProcessado.nome}: ${diasAbrev} ${horariosTexto} ${tipoTexto}`.trim());
      }
      
      if (servicosProcessados.length === 0) continue;
      
      // Processar convênios do médico
      const conveniosRaw = medico.convenios_aceitos || regras.convenios_aceitos || [];
      const convenios = Array.isArray(conveniosRaw) ? conveniosRaw : [];
      
      // Formatar convênios para exibição
      const formatarConvenios = (convs: string[]): string => {
        if (!convs || convs.length === 0) return 'Não informado';
        if (convs.length <= 3) return convs.join(', ');
        return `${convs.slice(0, 3).join(', ')} e mais ${convs.length - 3}`;
      };
      
      medicosComHorarios.push({
        id: medico.id,
        nome: medico.nome,
        especialidade: especialidade,
        tipo_agendamento: tipoAgendamento,
        convenios_aceitos: convenios,
        convenios_texto: formatarConvenios(convenios),
        servicos: servicosProcessados
      });
      
      // Adicionar bloco para mensagem WhatsApp
      const icone = tipoAgendamento === 'ordem_chegada' ? '🏥' : '👨‍⚕️';
      const conveniosLinha = convenios.length > 0 
        ? `\n   💳 Convênios: ${formatarConvenios(convenios)}`
        : '';
      mensagensWhatsApp.push(`${icone} ${medico.nome}${especialidade ? ` (${especialidade})` : ''}${conveniosLinha}\n${linhasServico.join('\n')}`);
    }
    
    // Montar mensagem WhatsApp final
    let mensagemWhatsApp = '📅 *Horários de atendimento:*\n\n';
    mensagemWhatsApp += mensagensWhatsApp.join('\n\n');
    
    if (medicosComHorarios.length > 0) {
      mensagemWhatsApp += '\n\n💡 Posso ajudar a agendar com algum deles?';
    }
    
    console.log(`✅ [DOCTOR-SCHEDULES] ${medicosComHorarios.length} médico(s) com horários processados`);
    
    return successResponse({
      medicos: medicosComHorarios,
      total: medicosComHorarios.length,
      message: `Horários de atendimento de ${medicosComHorarios.length} médico(s)`,
      mensagem_whatsapp: mensagemWhatsApp,
      filtros_aplicados: {
        medico_nome: medico_nome || null,
        servico_nome: servico_nome || null
      }
    });
    
  } catch (error: any) {
    console.error('❌ [DOCTOR-SCHEDULES] Erro:', error);
    return errorResponse(`Erro ao buscar horários: ${error?.message || 'Erro desconhecido'}`);
  }
}

