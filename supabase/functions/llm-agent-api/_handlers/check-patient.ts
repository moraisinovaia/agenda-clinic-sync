import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse } from '../_lib/responses.ts'
import { getRequestScope, isAppointmentAllowed } from '../_lib/scope.ts'
import { getClinicPhone } from '../_lib/limites.ts'
import { sanitizarCampoOpcional, normalizarDataNascimento, normalizarTelefone, normalizarNome } from '../_lib/normalizacao.ts'
import { formatarConsultaComContexto } from '../_lib/tipo-agendamento.ts'

export async function handleCheckPatient(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    // Sanitizar dados de busca
    const celularRaw = sanitizarCampoOpcional(body.celular);
    const dataNascimentoNormalizada = normalizarDataNascimento(
      sanitizarCampoOpcional(body.data_nascimento)
    );
    const pacienteNomeNormalizado = normalizarNome(
      sanitizarCampoOpcional(body.paciente_nome)
    );

    // 🔍 VERIFICAR CELULAR MASCARADO ANTES DE NORMALIZAR
    const isCelularMascarado = celularRaw ? celularRaw.includes('*') : false;
    const celularNormalizado = isCelularMascarado ? null : normalizarTelefone(celularRaw);

    // Log de busca
    console.log('🔍 Buscando paciente:', {
      nome: pacienteNomeNormalizado,
      nascimento: dataNascimentoNormalizada,
      celular: isCelularMascarado ? `${celularRaw} (MASCARADO - IGNORADO)` : (celularNormalizado ? `${celularNormalizado.substring(0, 4)}****` : null)
    });

    if (!pacienteNomeNormalizado && !dataNascimentoNormalizada && !celularNormalizado) {
      return errorResponse('Informe pelo menos: paciente_nome, data_nascimento ou celular para busca');
    }

    // 🔍 PASSO 1: Buscar TODOS os pacientes candidatos (BUSCA FUZZY MELHORADA)
    // Estratégia: Buscar por NOME + NASCIMENTO como filtros principais
    // O celular será usado apenas como filtro opcional em memória (não na query)
    let pacienteQuery = supabase
      .from('pacientes')
      .select('id, nome_completo, data_nascimento, celular, telefone, convenio, created_at, updated_at')
      .eq('cliente_id', clienteId);

    // Filtros principais: NOME + NASCIMENTO (sem celular)
    if (pacienteNomeNormalizado) {
      pacienteQuery = pacienteQuery.ilike('nome_completo', `%${pacienteNomeNormalizado}%`);
    }
    if (dataNascimentoNormalizada) {
      pacienteQuery = pacienteQuery.eq('data_nascimento', dataNascimentoNormalizada);
    }
    
    // 📝 Log de estratégia de busca
    if (celularNormalizado) {
      console.log('📞 Celular fornecido será usado para filtro fuzzy em memória:', celularNormalizado);
    } else if (isCelularMascarado) {
      console.log('⚠️ Celular mascarado detectado - buscando apenas por nome + nascimento:', celularRaw);
    }

    const { data: pacientesEncontrados, error: pacienteError } = await pacienteQuery;

    if (pacienteError) {
      return errorResponse(`Erro ao buscar paciente: ${pacienteError.message}`);
    }

    // Se não encontrou NENHUM paciente com esses dados
    if (!pacientesEncontrados || pacientesEncontrados.length === 0) {
      console.log('❌ Paciente não encontrado no sistema');
      const clinicPhone = getClinicPhone(config);
      return successResponse({
        encontrado: false,
        consultas: [],
        message: `Não encontrei agendamentos para este paciente. Para mais informações, entre em contato: ${clinicPhone}`,
        contato: clinicPhone,
        total: 0
      });
    }

    console.log(`🔍 Encontrados ${pacientesEncontrados.length} registros de pacientes antes do filtro de celular`);

    // 🎯 FILTRO FUZZY DE CELULAR (em memória, após busca)
    // Se celular foi fornecido, aplicar tolerância nos últimos dígitos
    // IMPORTANTE: Se houve match por nome + nascimento, NÃO eliminar — apenas ordenar
    let pacientesFiltrados = pacientesEncontrados;
    
    if (celularNormalizado && celularNormalizado.length >= 10) {
      const sufixoFornecido = celularNormalizado.slice(-4);
      const temMatchNomeNascimento = !!(pacienteNomeNormalizado && dataNascimentoNormalizada);
      
      if (temMatchNomeNascimento) {
        // Match por nome + nascimento: celular é apenas critério de ORDENAÇÃO, não eliminação
        console.log('🔍 Match por nome+nascimento detectado — celular usado apenas para ordenação (não elimina)');
        
        pacientesFiltrados = [...pacientesEncontrados].sort((a: any, b: any) => {
          const celA = normalizarTelefone(a.celular);
          const celB = normalizarTelefone(b.celular);
          const diffA = celA && celA.length >= 4 ? Math.abs(parseInt(celA.slice(-4)) - parseInt(sufixoFornecido)) : 9999;
          const diffB = celB && celB.length >= 4 ? Math.abs(parseInt(celB.slice(-4)) - parseInt(sufixoFornecido)) : 9999;
          return diffA - diffB;
        });
        
        // Log informativo sobre diferenças de celular
        pacientesFiltrados.forEach((p: any) => {
          const celP = normalizarTelefone(p.celular);
          if (celP && celP.length >= 4) {
            const sufP = celP.slice(-4);
            const diff = Math.abs(parseInt(sufP) - parseInt(sufixoFornecido));
            if (diff > 5) {
              console.log(`📱 Celular diferente mas MANTIDO por match nome+nascimento: ${sufP} vs ${sufixoFornecido} (diff=${diff}) - Paciente: ${p.nome_completo}`);
            }
          }
        });
      } else {
        // Sem match nome+nascimento: manter filtro rigoroso original
        console.log('🔍 Aplicando filtro fuzzy de celular RIGOROSO (sem match nome+nascimento)...');
        
        pacientesFiltrados = pacientesEncontrados.filter((p: any) => {
          if (!p.celular) return true;
          const celularPaciente = normalizarTelefone(p.celular);
          if (!celularPaciente || celularPaciente.length < 10) return true;
          const sufixoPaciente = celularPaciente.slice(-4);
          const diff = Math.abs(parseInt(sufixoPaciente) - parseInt(sufixoFornecido));
          const tolerado = diff <= 5;
          if (!tolerado) {
            console.log(`⚠️ Celular rejeitado por diferença: ${sufixoPaciente} vs ${sufixoFornecido} (diff=${diff})`);
          }
          return tolerado;
        });
      }
      
      console.log(`🔍 Após filtro fuzzy: ${pacientesFiltrados.length} de ${pacientesEncontrados.length} pacientes mantidos`);
    }

    console.log(`🔍 Total de registros após filtragem: ${pacientesFiltrados.length}`);

    // 🔄 PASSO 2: CONSOLIDAR DUPLICATAS
    // Buscar último convênio usado em agendamentos para cada paciente
    const pacienteIds = pacientesFiltrados.map((p: any) => p.id);
    const { data: ultimosAgendamentos } = await supabase
      .from('agendamentos')
      .select('paciente_id, convenio, data_agendamento, hora_agendamento')
      .eq('cliente_id', clienteId)
      .in('paciente_id', pacienteIds)
      .order('data_agendamento', { ascending: false })
      .order('hora_agendamento', { ascending: false });

    // Mapear último convênio por chave (nome + nascimento)
    const lastConvenios: Record<string, string> = {};
    if (ultimosAgendamentos) {
      const patientToKeyMap: Record<string, string> = {};
      pacientesFiltrados.forEach((p: any) => {
        patientToKeyMap[p.id] = `${p.nome_completo.toLowerCase().trim()}-${p.data_nascimento}`;
      });

      ultimosAgendamentos.forEach((apt: any) => {
        const patientKey = patientToKeyMap[apt.paciente_id];
        if (patientKey && !lastConvenios[patientKey] && apt.convenio) {
          lastConvenios[patientKey] = apt.convenio;
        }
      });
    }

    // Consolidar pacientes duplicados
    const pacientesConsolidados = consolidatePatients(pacientesFiltrados, lastConvenios);
    
    console.log(`✅ Consolidação concluída: ${pacientesFiltrados.length} registros → ${pacientesConsolidados.length} pacientes únicos`);
    
    if (pacientesConsolidados.length !== pacientesFiltrados.length) {
      console.log('🔄 Duplicatas detectadas e consolidadas:', {
        antes: pacientesFiltrados.length,
        depois: pacientesConsolidados.length,
        duplicatasRemovidas: pacientesFiltrados.length - pacientesConsolidados.length
      });
    }

    // 🎯 PASSO 3: Buscar agendamentos FUTUROS de TODOS os IDs (incluindo duplicatas)
    // Isso garante que encontramos agendamentos mesmo se estiverem vinculados a duplicatas
    const paciente_ids = pacientesConsolidados.flatMap(p => p.all_ids);
    console.log(`🔍 Buscando agendamentos para ${pacientesConsolidados.length} paciente(s) consolidado(s) (${paciente_ids.length} IDs totais)`, {
      pacientes_unicos: pacientesConsolidados.length,
      ids_totais: paciente_ids.length,
      nomes: pacientesConsolidados.map(p => p.nome_completo)
    });

    let agendamentosQuery = supabase
      .from('agendamentos')
      .select(`
        id,
        medico_id,
        data_agendamento,
        hora_agendamento,
        status,
        observacoes,
        pacientes(nome_completo, data_nascimento, celular, convenio),
        medicos(nome, especialidade),
        atendimentos(nome, tipo)
      `)
      .eq('cliente_id', clienteId)
      .in('paciente_id', paciente_ids)
      .in('status', ['agendado', 'confirmado'])
      .gte('data_agendamento', new Date().toISOString().split('T')[0])
      .order('data_agendamento', { ascending: true });

    if (scope.doctorIds.length > 0) {
      agendamentosQuery = agendamentosQuery.in('medico_id', scope.doctorIds);
    }

    const { data: agendamentos, error: agendamentoError } = await agendamentosQuery;

    const agendamentosFiltrados = (agendamentos || []).filter((agendamento: any) =>
      isAppointmentAllowed(
        agendamento.medico_id,
        agendamento.medicos?.nome,
        agendamento.atendimentos?.nome,
        scope
      )
    );

    if (agendamentoError) {
      return errorResponse(`Erro ao buscar agendamentos: ${agendamentoError.message}`);
    }

    // Se não tem agendamentos FUTUROS, informar que existe mas sem consultas futuras
    if (agendamentosFiltrados.length === 0) {
      console.log('ℹ️ Paciente existe mas não tem agendamentos futuros');
      return successResponse({
        encontrado: true,
        paciente_cadastrado: true,
        consultas: [],
        message: `Paciente ${pacientesEncontrados[0].nome_completo} está cadastrado(a) no sistema, mas não possui consultas futuras agendadas`,
        observacao: 'Paciente pode agendar nova consulta',
        total: 0
      });
    }

    // 📋 PASSO 3: Montar resposta com agendamentos futuros formatados contextualmente
    const consultas = agendamentosFiltrados.map((a: any) => {
      const consultaBase = {
        id: a.id,
        paciente_nome: a.pacientes?.nome_completo,
        medico_id: a.medico_id,
        medico_nome: a.medicos?.nome,
        especialidade: a.medicos?.especialidade,
        atendimento_nome: a.atendimentos?.nome,
        data_agendamento: a.data_agendamento,
        hora_agendamento: a.hora_agendamento,
        status: a.status,
        convenio: a.pacientes?.convenio,
        observacoes: a.observacoes
      };
      
      // ✅ Aplicar formatação contextual com regras de negócio (passando config dinâmica)
      return formatarConsultaComContexto(consultaBase, config);
    });

    // Construir mensagem geral com todas as consultas formatadas
    const mensagensConsultas = consultas.map((c, i) => 
      `${i + 1}. ${c.mensagem}`
    ).join('\n\n');

    console.log(`✅ ${consultas.length} consulta(s) futura(s) encontrada(s)`);
    return successResponse({
      encontrado: true,
      message: consultas.length === 1 
        ? consultas[0].mensagem 
        : `${consultas.length} consulta(s) encontrada(s):\n\n${mensagensConsultas}`,
      consultas,
      total: consultas.length
    });

  } catch (error: any) {
    return errorResponse(`Erro ao verificar paciente: ${error?.message || 'Erro desconhecido'}`);
  }
}

function consolidatePatients(patients: any[], lastConvenios: Record<string, string>): Array<{
  id: string; all_ids: string[]; nome_completo: string; data_nascimento: string;
  celular: string | null; telefone: string | null; ultimo_convenio: string;
  updated_at: string; created_at: string;
}> {
  const consolidated = new Map<string, ReturnType<typeof consolidatePatients>[number]>();

  patients.forEach(patient => {
    const key = `${patient.nome_completo.toLowerCase().trim()}-${patient.data_nascimento}`;

    if (consolidated.has(key)) {
      const existing = consolidated.get(key)!;
      existing.all_ids.push(patient.id);
      if (new Date(patient.updated_at) > new Date(existing.updated_at)) {
        existing.id = patient.id;
        existing.celular = patient.celular;
        existing.telefone = patient.telefone;
        existing.updated_at = patient.updated_at;
      }
    } else {
      const ultimoConvenio = lastConvenios[key] || patient.convenio;
      consolidated.set(key, {
        id: patient.id,
        all_ids: [patient.id],
        nome_completo: patient.nome_completo,
        data_nascimento: patient.data_nascimento,
        celular: patient.celular,
        telefone: patient.telefone,
        ultimo_convenio: ultimoConvenio,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
      });
    }
  });

  return Array.from(consolidated.values());
}
