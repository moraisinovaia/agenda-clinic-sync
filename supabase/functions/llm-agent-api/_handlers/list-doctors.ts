import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse } from '../_lib/responses.ts'
import { getRequestScope, filterDoctorsByScope } from '../_lib/scope.ts'

export async function handleListDoctors(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    console.log('📥 [LIST-DOCTORS] Buscando médicos para cliente:', clienteId);

    let query = supabase
      .from('medicos')
      .select('id, nome, especialidade, convenios_aceitos, horarios, ativo, crm, rqe')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('nome');

    if (scope.doctorIds.length > 0) {
      query = query.in('id', scope.doctorIds);
    }

    const { data: medicos, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar médicos:', error);
      return errorResponse(`Erro ao buscar médicos: ${error.message}`);
    }

    // Enriquecer com business_rules se disponíveis
    const medicosNoEscopo = filterDoctorsByScope(medicos || [], scope);

    const medicosEnriquecidos = medicosNoEscopo.map((medico: any) => {
      const rules = config?.business_rules?.[medico.id]?.config;
      return {
        id: medico.id,
        nome: medico.nome,
        especialidade: medico.especialidade || rules?.especialidade,
        convenios_aceitos: medico.convenios_aceitos,
        tipo_agendamento: rules?.tipo_agendamento || 'hora_marcada',
        servicos: rules?.servicos ? Object.keys(rules.servicos) : [],
        ativo: medico.ativo,
        crm: medico.crm,
        rqe: medico.rqe
      };
    });

    console.log(`✅ [LIST-DOCTORS] ${medicosEnriquecidos.length} médico(s) encontrado(s)`);

    return successResponse({
      message: `${medicosEnriquecidos.length} médico(s) disponível(is)`,
      medicos: medicosEnriquecidos,
      total: medicosEnriquecidos.length,
      cliente_id: clienteId
    });

  } catch (error: any) {
    console.error('❌ [LIST-DOCTORS] Erro:', error);
    return errorResponse(`Erro ao listar médicos: ${error?.message || 'Erro desconhecido'}`);
  }
}
