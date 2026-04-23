import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse } from '../_lib/responses.ts'
import { getMinimumBookingDate } from '../_lib/limites.ts'

export async function handlePatientSearch(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { busca, tipo } = body;

    if (!busca) {
      return errorResponse('Campo obrigatório: busca (nome, telefone ou data de nascimento)');
    }

    let query = supabase
      .from('pacientes')
      .select('id, nome_completo, data_nascimento, celular, telefone, convenio')
      .eq('cliente_id', clienteId)
      .limit(10);

    switch (tipo) {
      case 'nome':
        query = query.ilike('nome_completo', `%${busca}%`);
        break;
      case 'telefone':
        // Remover formatação e buscar apenas os dígitos
        const telefoneLimpo = busca.replace(/\D/g, '');
        if (telefoneLimpo.length < 8) {
          return errorResponse('Telefone deve ter pelo menos 8 dígitos');
        }
        // Buscar pelos últimos 8 dígitos para pegar tanto fixo quanto celular
        const ultimos8 = telefoneLimpo.slice(-8);
        query = query.or(`celular.ilike.%${ultimos8}%,telefone.ilike.%${ultimos8}%`);
        break;
      case 'nascimento':
        query = query.eq('data_nascimento', busca);
        break;
      default:
        // Busca geral - detectar tipo automaticamente
        const telefoneGeral = busca.replace(/\D/g, '');
        const isDataFormat = /^\d{4}-\d{2}-\d{2}$/.test(busca);
        
        if (isDataFormat) {
          // Se parece uma data, buscar por data E nome
          query = query.or(`nome_completo.ilike.%${busca}%,data_nascimento.eq.${busca}`);
        } else if (telefoneGeral.length >= 8) {
          // Se tem números suficientes, buscar por nome E telefone (últimos 8 dígitos)
          const ultimos8Geral = telefoneGeral.slice(-8);
          query = query.or(`nome_completo.ilike.%${busca}%,celular.ilike.%${ultimos8Geral}%,telefone.ilike.%${ultimos8Geral}%`);
        } else {
          // Apenas buscar por nome
          query = query.ilike('nome_completo', `%${busca}%`);
        }
    }

    const { data: pacientes, error } = await query;

    if (error) {
      return errorResponse(`Erro ao buscar pacientes: ${error.message}`);
    }

    return successResponse({
      message: `${pacientes?.length || 0} paciente(s) encontrado(s)`,
      pacientes: pacientes || [],
      total: pacientes?.length || 0
    });

  } catch (error: any) {
    return errorResponse(`Erro ao buscar pacientes: ${error?.message || 'Erro desconhecido'}`);
  }
}

/**
 * 🆕 FUNÇÃO AUXILIAR: Buscar próximas datas com período específico disponível
 */
async function buscarProximasDatasComPeriodo(
  supabase: any,
  medico: any,
  servico: any,
  periodo: 'manha' | 'tarde' | 'noite',
  dataInicial: string,
  clienteId: string,
  quantidade: number = 5,
  config: DynamicConfig | null = null
) {
  const datasEncontradas = [];
  const periodoMap = {
    'manha': 'manha',
    'tarde': 'tarde',
    'noite': 'noite'
  };
  const periodoKey = periodoMap[periodo];
  
  // Verificar se o serviço tem configuração para este período
  if (!servico.periodos?.[periodoKey]) {
    console.log(`⚠️ Serviço não atende no período: ${periodoKey}`);
    return [];
  }
  
  const configPeriodo = servico.periodos[periodoKey];
  
  console.log(`🔍 Buscando próximas ${quantidade} datas com ${periodo} disponível a partir de ${dataInicial}`);
  
  // Buscar próximos 30 dias (para garantir encontrar pelo menos 'quantidade' datas)
  for (let diasAdiantados = 1; diasAdiantados <= 30; diasAdiantados++) {
    const dataCheck = new Date(dataInicial + 'T00:00:00');
    dataCheck.setDate(dataCheck.getDate() + diasAdiantados);
    const dataCheckStr = dataCheck.toISOString().split('T')[0];
    const diaSemanaNum = dataCheck.getDay();
    
    // Verificar se data é válida (>= data mínima)
    const minBookingDate = getMinimumBookingDate(config);
    if (dataCheckStr < minBookingDate) {
      continue;
    }
    
    // Pular finais de semana (se aplicável)
    if (diaSemanaNum === 0 || diaSemanaNum === 6) {
      continue;
    }
    
    // Verificar disponibilidade APENAS do período específico
    const { data: agendados, error } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', medico.id)
      .eq('data_agendamento', dataCheckStr)
      .eq('cliente_id', clienteId)
      .gte('hora_agendamento', configPeriodo.inicio)
      .lte('hora_agendamento', configPeriodo.fim)
      .gte('data_agendamento', getMinimumBookingDate(config))
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado']);
    
    if (error) {
      console.error(`❌ Erro ao verificar ${dataCheckStr}:`, error);
      continue;
    }
    
    const ocupadas = agendados?.length || 0;
    const disponiveis = configPeriodo.limite - ocupadas;
    
    if (disponiveis > 0) {
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const periodoNomes = { 'manha': 'Manhã', 'tarde': 'Tarde', 'noite': 'Noite' };
      
      datasEncontradas.push({
        data: dataCheckStr,
        dia_semana: diasSemana[diaSemanaNum],
        periodos: [{
          periodo: periodoNomes[periodo],
          horario_distribuicao: configPeriodo.distribuicao_fichas || `${configPeriodo.inicio} às ${configPeriodo.fim}`,
          vagas_disponiveis: disponiveis,
          total_vagas: configPeriodo.limite,
          tipo: 'ordem_chegada'
        }]
      });
      
      console.log(`✅ Encontrada: ${dataCheckStr} - ${disponiveis} vagas no período ${periodo}`);
      
      // Parar quando encontrar quantidade suficiente
      if (datasEncontradas.length >= quantidade) {
        break;
      }
    }
  }
  
  console.log(`📊 Total de datas encontradas com ${periodo}: ${datasEncontradas.length}`);
  return datasEncontradas;
}

