import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse } from '../_lib/responses.ts'
import { getClinicPhone, getDiasBuscaInicial, getDiasBuscaExpandida } from '../_lib/limites.ts'

export async function handleClinicInfo(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    console.log('📥 [CLINIC-INFO] Buscando informações da clínica:', clienteId);

    // Usar principalmente a config dinâmica (llm_clinic_config)
    // Isso evita problemas de RLS com a tabela clientes
    if (config?.clinic_info) {
      const clinicInfo = {
        id: clienteId,
        nome: config.clinic_info.nome_clinica || 'Clínica',
        telefone: config.clinic_info.telefone,
        whatsapp: config.clinic_info.whatsapp,
        endereco: config.clinic_info.endereco,
        data_minima_agendamento: config.clinic_info.data_minima_agendamento || null,
        dias_busca_inicial: config.clinic_info.dias_busca_inicial || getDiasBuscaInicial(config),
        dias_busca_expandida: config.clinic_info.dias_busca_expandida || getDiasBuscaExpandida(config)
      };

      console.log(`✅ [CLINIC-INFO] Informações retornadas (via config): ${clinicInfo.nome}`);

      return successResponse({
        message: `Informações da clínica ${clinicInfo.nome}`,
        clinica: clinicInfo,
        cliente_id: clienteId,
        fonte: 'llm_clinic_config'
      });
    }

    // Fallback: tentar buscar da tabela clientes
    console.log('⚠️ [CLINIC-INFO] Config não disponível, tentando tabela clientes...');

    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('id, nome, telefone, whatsapp, endereco')
      .eq('id', clienteId)
      .single();

    if (error) {
      console.warn('⚠️ Erro ao buscar cliente (retornando dados mínimos):', error.message);
      // Retornar dados mínimos em vez de erro
      return successResponse({
        message: 'Informações básicas da clínica',
        clinica: {
          id: clienteId,
          nome: 'Clínica',
          telefone: getClinicPhone(config),
          data_minima_agendamento: null,
          dias_busca_inicial: getDiasBuscaInicial(config),
          dias_busca_expandida: getDiasBuscaExpandida(config)
        },
        cliente_id: clienteId,
        fonte: 'fallback'
      });
    }

    const clinicInfo = {
      id: cliente?.id || clienteId,
      nome: cliente?.nome || 'Clínica',
      telefone: cliente?.telefone,
      whatsapp: cliente?.whatsapp,
      endereco: cliente?.endereco,
      data_minima_agendamento: null,
      dias_busca_inicial: getDiasBuscaInicial(config),
      dias_busca_expandida: getDiasBuscaExpandida(config)
    };

    console.log(`✅ [CLINIC-INFO] Informações retornadas (via clientes): ${clinicInfo.nome}`);

    return successResponse({
      message: `Informações da clínica ${clinicInfo.nome}`,
      clinica: clinicInfo,
      cliente_id: clienteId,
      fonte: 'clientes'
    });

  } catch (error: any) {
    console.error('❌ [CLINIC-INFO] Erro:', error);
    return errorResponse('Erro ao buscar informações. Tente novamente mais tarde.', 'CLINIC_INFO_ERROR');
  }
}
