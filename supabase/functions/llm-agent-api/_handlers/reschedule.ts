import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse, businessErrorResponse } from '../_lib/responses.ts'
import { getRequestScope, isAppointmentAllowed, getScopeSummary } from '../_lib/scope.ts'
import { getMedicoRules, verificarLimitesCompartilhados, verificarSublimiteConvenio } from '../_lib/limites.ts'
import { BUSINESS_RULES, getDataHoraAtualBrasil, validarDataHoraFutura } from '../_lib/tipo-agendamento.ts'
import { sanitizarCampoOpcional, formatarDataPorExtenso } from '../_lib/normalizacao.ts'
import { normalizarServicoPeriodos } from '../_lib/config.ts'

export async function handleReschedule(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body, config);
    console.log('🔄 Iniciando remarcação de consulta');
    console.log('📥 [RESCHEDULE] Dados recebidos:', {
      keys: Object.keys(body || {}),
      has_agendamento_id: !!body?.agendamento_id,
      has_nova_data: !!body?.nova_data,
      has_nova_hora: !!body?.nova_hora,
      has_observacoes: !!body?.observacoes,
    });
    console.log('🏥 Cliente ID:', clienteId);
    
    // 🆕 Sanitizar campos opcionais antes de processar
    const { 
      agendamento_id,
      nova_data: novaDataRaw,
      nova_hora: novaHoraRaw,
      observacoes
    } = body;

    const nova_data = sanitizarCampoOpcional(novaDataRaw);
    const nova_hora = sanitizarCampoOpcional(novaHoraRaw);

    // Validação detalhada
    const camposFaltando = [];
    if (!agendamento_id) camposFaltando.push('agendamento_id');
    if (!nova_data) camposFaltando.push('nova_data');
    if (!nova_hora) camposFaltando.push('nova_hora');
    
    if (camposFaltando.length > 0) {
      const erro = `Campos obrigatórios faltando: ${camposFaltando.join(', ')}`;
      console.error('❌ Validação falhou:', erro);
      console.error('📦 [RESCHEDULE] Payload inválido:', {
        keys: Object.keys(body || {}),
        has_agendamento_id: !!body?.agendamento_id,
        has_nova_data: !!body?.nova_data,
        has_nova_hora: !!body?.nova_hora,
      });
      return errorResponse(erro);
    }
    
    console.log('✅ Validação inicial OK');
    console.log(`📝 Remarcando agendamento ${agendamento_id} para ${nova_data} às ${nova_hora}`);

    // Verificar se agendamento existe COM filtro de cliente
    console.log(`🔍 Buscando agendamento ${agendamento_id}...`);
    // [F4.3] Filtrar soft-deletes consistentemente: agendamentos cancelados/
    // excluídos não podem ser remarcados. Antes faltavam estes filtros e
    // dependíamos só do `status` no fluxo, mas existe drift em produção
    // (cancelado_em set mas status='agendado' — vimos 338 desses no Dr. Marcelo).
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        medico_id,
        atendimento_id,
        data_agendamento,
        hora_agendamento,
        status,
        convenio,
        pacientes(nome_completo),
        medicos(nome),
        atendimentos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .is('cancelado_em', null)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado'])
      .maybeSingle();

    if (checkError) {
      console.error('❌ Erro ao buscar agendamento:', checkError);
      return errorResponse(`Erro ao buscar agendamento: ${checkError.message}`);
    }
    
    if (!agendamento) {
      console.error('❌ Agendamento não encontrado');
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

    console.log('✅ Agendamento encontrado:', {
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data_atual: agendamento.data_agendamento,
      hora_atual: agendamento.hora_agendamento,
      status: agendamento.status
    });

    if (agendamento.status === 'cancelado') {
      console.error('❌ Tentativa de remarcar consulta cancelada');
      return errorResponse('Não é possível remarcar consulta cancelada');
    }

    // 🚫 VALIDAR: Nova data/hora não pode ser no passado
    const validacaoDataReschedule = validarDataHoraFutura(nova_data, nova_hora);
    if (!validacaoDataReschedule.valido) {
      const { data: dataAtualBrasil } = getDataHoraAtualBrasil();
      
      return businessErrorResponse({
        codigo_erro: validacaoDataReschedule.erro ?? 'DATA_INVALIDA',
        mensagem_usuario: validacaoDataReschedule.erro === 'DATA_PASSADA'
          ? `❌ Não é possível remarcar para ${formatarDataPorExtenso(nova_data)} pois essa data já passou.\n\n📅 A data de hoje é ${formatarDataPorExtenso(dataAtualBrasil)}.\n\n💡 Por favor, escolha uma data futura.`
          : `❌ Não é possível remarcar para ${nova_hora} hoje pois esse horário já passou ou está muito próximo.\n\n⏰ Horário mínimo: ${validacaoDataReschedule.horaMinima}\n\n💡 Escolha um horário posterior ou remarque para outro dia.`,
        detalhes: { 
          nova_data,
          nova_hora,
          data_atual: dataAtualBrasil
        }
      });
    }

    // 🚫 VALIDAR: dia da semana suportado pelo serviço (dias_especificos)
    // Mesma lógica do /schedule — se algum período declara dias_especificos,
    // pelo menos um período ativo deve cobrir o weekday de nova_data.
    {
      const regrasDS = getMedicoRules(config, agendamento.medico_id, BUSINESS_RULES.medicos[agendamento.medico_id]);
      const atendNome = (agendamento as any).atendimentos?.nome || '';
      const servicoDS: any = regrasDS?.servicos
        ? regrasDS.servicos[Object.keys(regrasDS.servicos).find((k: string) =>
            k.toLowerCase().includes(atendNome.toLowerCase()) ||
            atendNome.toLowerCase().includes(k.toLowerCase())
          ) ?? '']
        : null;
      const periodosDS: any = servicoDS?.periodos || {};
      const weekday = new Date(nova_data + 'T00:00:00').getDay();
      const anyPeriodoDeclaraDia = Object.values(periodosDS).some(
        (p: any) => Array.isArray(p?.dias_especificos),
      );
      if (anyPeriodoDeclaraDia) {
        const atende = Object.values(periodosDS).some((p: any) =>
          p && p.ativo !== false && Array.isArray(p.dias_especificos) && p.dias_especificos.includes(weekday)
        );
        if (!atende) {
          const diasSemanaPT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
          console.log(`❌ [RESCHEDULE/DIA_NAO_ATENDIDO] ${agendamento.medicos?.nome} não atende em ${diasSemanaPT[weekday]}`);
          return businessErrorResponse({
            codigo_erro: 'DIA_NAO_ATENDIDO',
            mensagem_usuario:
              `❌ ${agendamento.medicos?.nome} não atende ${atendNome} ${diasSemanaPT[weekday]}-feira.\n\n` +
              `💡 Por favor, escolha outro dia da semana.`,
            detalhes: { medico: agendamento.medicos?.nome, servico: atendNome, data: nova_data, dia_semana: diasSemanaPT[weekday] },
          });
        }
      }
    }

    // 🔒 VERIFICAR SE A NOVA DATA ESTÁ BLOQUEADA
    console.log(`🔒 [RESCHEDULE] Verificando bloqueios para ${nova_data}...`);
    const { data: bloqueiosReschedule, error: bloqueioRescheduleError } = await supabase
      .from('bloqueios_agenda')
      .select('id, motivo')
      .eq('medico_id', agendamento.medico_id)
      .eq('status', 'ativo')
      .eq('cliente_id', clienteId)
      .lte('data_inicio', nova_data)
      .gte('data_fim', nova_data);

    if (!bloqueioRescheduleError && bloqueiosReschedule && bloqueiosReschedule.length > 0) {
      console.log(`⛔ [RESCHEDULE] Data ${nova_data} bloqueada:`, bloqueiosReschedule[0].motivo);
      return businessErrorResponse({
        codigo_erro: 'DATA_BLOQUEADA',
        mensagem_usuario: `❌ A agenda do(a) ${agendamento.medicos?.nome} está bloqueada em ${formatarDataPorExtenso(nova_data)}.\n\n📋 Motivo: ${bloqueiosReschedule[0].motivo}\n\n💡 Por favor, escolha outra data para remarcar.`,
        detalhes: {
          nova_data,
          motivo_bloqueio: bloqueiosReschedule[0].motivo
        }
      });
    }

    // 🔢 VERIFICAR LIMITE DE VAGAS NO PERÍODO (evitar overbooking)
    const regrasRescheduleValidacao = getMedicoRules(config, agendamento.medico_id, BUSINESS_RULES.medicos[agendamento.medico_id]);
    if (regrasRescheduleValidacao && regrasRescheduleValidacao.servicos) {
      console.log(`📋 [RESCHEDULE] Verificando limites de vagas...`);
      
      // Classificar período pela hora
      const [horaReschedule] = nova_hora.split(':').map(Number);
      const periodoReschedule = horaReschedule < 12 ? 'manha' : 'tarde';
      
      // Verificar dia da semana permitido
      const dataObjReschedule = new Date(nova_data + 'T00:00:00');
      const diaSemanaReschedule = dataObjReschedule.getDay();
      const diasSemanaNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const diaSemanaNameReschedule = diasSemanaNames[diaSemanaReschedule];
      
      // Buscar serviço correspondente ao atendimento atual
      const atendimentoNomeReschedule = agendamento.atendimentos?.nome;
      let servicoKeyReschedule: string | null = null;
      let servicoConfigReschedule: any = null;
      
      if (atendimentoNomeReschedule) {
        const normalizarNomeResch = (texto: string): string =>
          texto.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\b(de|da|do|das|dos)\b/g, '')
            .replace(/[_\-\s]+/g, '')
            .replace(/oi/g, 'o')
            .replace(/ai/g, 'a');
        
        const atendNorm = normalizarNomeResch(atendimentoNomeReschedule);
        servicoKeyReschedule = Object.keys(regrasRescheduleValidacao.servicos).find(s => {
          const sNorm = normalizarNomeResch(s);
          return sNorm.includes(atendNorm) || atendNorm.includes(sNorm) || sNorm === atendNorm;
        }) || null;
        
        if (servicoKeyReschedule) {
          servicoConfigReschedule = regrasRescheduleValidacao.servicos[servicoKeyReschedule];
        }
      }
      
      // Se não encontrou serviço específico, usar o primeiro
      if (!servicoKeyReschedule) {
        servicoKeyReschedule = Object.keys(regrasRescheduleValidacao.servicos)[0];
        servicoConfigReschedule = regrasRescheduleValidacao.servicos[servicoKeyReschedule];
      }
      
      if (servicoConfigReschedule) {
        // Verificar dia permitido
        if (servicoConfigReschedule.dias_permitidos && !servicoConfigReschedule.dias_permitidos.includes(diaSemanaNameReschedule)) {
          const diasPermitidos = servicoConfigReschedule.dias_permitidos.join(', ');
          return businessErrorResponse({
            codigo_erro: 'DIA_NAO_PERMITIDO',
            mensagem_usuario: `❌ ${regrasRescheduleValidacao.nome} não atende ${servicoKeyReschedule} no dia escolhido.\n\n✅ Dias disponíveis: ${diasPermitidos}\n\n💡 Escolha uma data em um dos dias disponíveis.`,
            detalhes: {
              medico: regrasRescheduleValidacao.nome,
              servico: servicoKeyReschedule,
              dia_solicitado: diaSemanaNameReschedule,
              dias_permitidos: servicoConfigReschedule.dias_permitidos
            }
          });
        }
        
        // Verificar limites compartilhados/sublimites
        if (servicoConfigReschedule.compartilha_limite_com || servicoConfigReschedule.limite_proprio) {
          const resultadoLimitesResch = await verificarLimitesCompartilhados(
            supabase, clienteId, agendamento.medico_id, nova_data,
            servicoKeyReschedule, servicoConfigReschedule, regrasRescheduleValidacao
          );
          
          if (!resultadoLimitesResch.permitido) {
            return businessErrorResponse({
              codigo_erro: resultadoLimitesResch.erro_codigo || 'LIMITE_ATINGIDO',
              mensagem_usuario: `❌ ${resultadoLimitesResch.mensagem}\n\n💡 Por favor, escolha outra data para remarcar.`,
              detalhes: resultadoLimitesResch.detalhes
            });
          }
        }
        
        // Verificar limite de vagas do período
        const servicoNormalizado = normalizarServicoPeriodos(servicoConfigReschedule);
        if (servicoNormalizado?.periodos?.[periodoReschedule]) {
          const configPeriodoResch = servicoNormalizado.periodos[periodoReschedule];
          if (configPeriodoResch.limite) {
            const inicioContagem = configPeriodoResch.contagem_inicio || configPeriodoResch.inicio;
            const fimContagem = configPeriodoResch.contagem_fim || configPeriodoResch.fim;
            
            let queryLimite = supabase
              .from('agendamentos')
              .select('id', { count: 'exact', head: true })
              .eq('medico_id', agendamento.medico_id)
              .eq('data_agendamento', nova_data)
              .eq('cliente_id', clienteId)
              .is('excluido_em', null)
              .is('cancelado_em', null)
              .in('status', ['agendado', 'confirmado'])
              .neq('id', agendamento_id); // Excluir o próprio agendamento sendo remarcado
            
            if (inicioContagem && fimContagem) {
              queryLimite = queryLimite
                .gte('hora_agendamento', inicioContagem)
                .lt('hora_agendamento', fimContagem);
            }
            
            const { count: vagasOcupadasResch } = await queryLimite;
            const ocupadas = vagasOcupadasResch || 0;
            
            if (ocupadas >= configPeriodoResch.limite) {
              console.log(`❌ [RESCHEDULE] Limite atingido: ${ocupadas}/${configPeriodoResch.limite}`);
              return businessErrorResponse({
                codigo_erro: 'LIMITE_VAGAS_ATINGIDO',
                mensagem_usuario: `❌ Não há mais vagas para ${regrasRescheduleValidacao.nome} no período da ${periodoReschedule === 'manha' ? 'manhã' : 'tarde'} em ${formatarDataPorExtenso(nova_data)}.\n\n📊 Status: ${ocupadas}/${configPeriodoResch.limite} vagas ocupadas\n\n💡 Por favor, escolha outra data ou período para remarcar.`,
                detalhes: {
                  medico: regrasRescheduleValidacao.nome,
                  data_solicitada: nova_data,
                  limite_vagas: configPeriodoResch.limite,
                  vagas_ocupadas: ocupadas
                }
              });
            }
            console.log(`✅ [RESCHEDULE] Vagas disponíveis: ${configPeriodoResch.limite - ocupadas}/${configPeriodoResch.limite}`);
          }
        }
      }
      // 🆕 VERIFICAR SUBLIMITE POR CONVÊNIO NO RESCHEDULE
      if (agendamento.convenio && regrasRescheduleValidacao?.convenio_sublimites) {
        const resultadoConvSublimResch = await verificarSublimiteConvenio(
          supabase, clienteId, agendamento.medico_id, nova_data, agendamento.convenio,
          regrasRescheduleValidacao, periodoReschedule, servicoConfigReschedule, agendamento_id
        );
        
        if (!resultadoConvSublimResch.permitido) {
          console.log(`❌ [RESCHEDULE CONVENIO SUBLIMITE] Bloqueado: ${resultadoConvSublimResch.mensagem}`);
          return businessErrorResponse({
            codigo_erro: 'SUBLIMITE_CONVENIO_ATINGIDO',
            mensagem_usuario: `❌ ${resultadoConvSublimResch.mensagem}\n\n💡 Por favor, escolha outra data para remarcar.`,
            detalhes: resultadoConvSublimResch.detalhes
          });
        }
      }
    }

    // [F4.2] Remarcação atômica via RPC. Antes era SELECT-conflitos →
    // UPDATE em duas chamadas, vulnerável a race entre 2 workers
    // remarcando pacientes diferentes pro mesmo slot livre. Agora a RPC
    // faz tudo numa transação com guard NOT EXISTS + handler de
    // unique_violation (idx_agendamentos_unique_slot_ativo).
    console.log(`🔍 Remarcando atomicamente para ${nova_data} às ${nova_hora}...`);
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'remarcar_agendamento_atomico_externo',
      {
        p_cliente_id:     clienteId,
        p_agendamento_id: agendamento_id,
        p_nova_data:      nova_data,
        p_nova_hora:      nova_hora,
        p_observacoes:    observacoes ?? null,
        p_remarcado_por:  'LLM Agent WhatsApp',
      },
    );

    if (rpcError) {
      console.error('❌ Erro RPC remarcação:', rpcError);
      return errorResponse(`Erro ao remarcar: ${rpcError.message}`);
    }

    if (!rpcResult?.success) {
      const code = rpcResult?.error;
      if (code === 'CONFLICT') {
        // Buscar info do paciente que está no slot conflitante (apenas para mensagem)
        const { data: conflito } = await supabase
          .from('agendamentos')
          .select('pacientes(nome_completo)')
          .eq('medico_id', agendamento.medico_id)
          .eq('data_agendamento', nova_data)
          .eq('hora_agendamento', nova_hora)
          .eq('cliente_id', clienteId)
          .in('status', ['agendado', 'confirmado'])
          .is('cancelado_em', null)
          .is('excluido_em', null)
          .neq('id', agendamento_id)
          .limit(1)
          .maybeSingle();
        const ocupanteNome = (conflito as any)?.pacientes?.nome_completo;
        return errorResponse(
          ocupanteNome
            ? `Horário já ocupado para este médico (${ocupanteNome})`
            : 'Horário já ocupado por outro paciente',
        );
      }
      console.error('❌ RPC remarcação retornou erro:', rpcResult);
      return errorResponse(rpcResult?.message ?? `Erro ao remarcar: ${code ?? 'desconhecido'}`);
    }

    console.log('✅ Agendamento remarcado com sucesso!');

    // Mensagem dinâmica baseada nas business_rules do médico
    let mensagem = `Consulta remarcada com sucesso`;

    // Buscar regras dinâmicas do médico (usar config + hardcoded fallback)
    const regrasRemarcar = getMedicoRules(config, agendamento.medico_id, BUSINESS_RULES.medicos[agendamento.medico_id]);
    console.log(`🔍 [RESCHEDULE] Regras encontradas: ${regrasRemarcar ? 'SIM' : 'NÃO'}, tipo: ${regrasRemarcar?.tipo_agendamento || 'N/A'}`);
    
    if (regrasRemarcar && regrasRemarcar.tipo_agendamento === 'ordem_chegada') {
      const servicos = regrasRemarcar.servicos || {};
      // Buscar primeiro serviço com periodos definidos
      const primeiroServico = Object.values(servicos).find((s: any) => s.periodos && Object.keys(s.periodos).length > 0) as any;
      console.log(`🔍 [RESCHEDULE] Primeiro serviço com períodos: ${primeiroServico ? 'ENCONTRADO' : 'NÃO'}`);
      
      if (primeiroServico?.periodos) {
        const periodos = primeiroServico.periodos;
        const [hora] = nova_hora.split(':').map(Number);
        console.log(`🔍 [RESCHEDULE] Hora: ${hora}, Períodos: manha=${!!periodos.manha}, tarde=${!!periodos.tarde}`);
        
        // Normalizar campos (aceitar inicio/fim OU horario_inicio/horario_fim)
        const manha = periodos.manha;
        const tarde = periodos.tarde;
        
        let periodoConfig: any = null;
        let periodoNome = '';
        
        // Detectar período baseado na hora (usar contagem_inicio/contagem_fim para range amplo)
        if (manha) {
          // Usar contagem_inicio/fim se disponível, senão inicio/fim
          const hIni = parseInt((manha.contagem_inicio || manha.inicio || manha.horario_inicio || '00:00').split(':')[0]);
          const hFim = parseInt((manha.contagem_fim || manha.fim || manha.horario_fim || '12:00').split(':')[0]);
          console.log(`🔍 [RESCHEDULE] Manha range: ${hIni}-${hFim}, hora=${hora}`);
          if (hora >= hIni && hora < hFim) {
            periodoConfig = manha;
            periodoNome = 'manhã';
          }
        }
        if (tarde && !periodoConfig) {
          const hIni = parseInt((tarde.contagem_inicio || tarde.inicio || tarde.horario_inicio || '12:00').split(':')[0]);
          const hFim = parseInt((tarde.contagem_fim || tarde.fim || tarde.horario_fim || '18:00').split(':')[0]);
          console.log(`🔍 [RESCHEDULE] Tarde range: ${hIni}-${hFim}, hora=${hora}`);
          if (hora >= hIni && hora < hFim) {
            periodoConfig = tarde;
            periodoNome = 'tarde';
          }
        }
        
        console.log(`🔍 [RESCHEDULE] Período detectado: ${periodoNome || 'NENHUM'}`);
        
        if (periodoConfig) {
          // Verificar mensagem personalizada do serviço
          if (primeiroServico.mensagem_apos_agendamento) {
            mensagem = `✅ ${primeiroServico.mensagem_apos_agendamento}`;
            console.log(`💬 Usando mensagem personalizada do serviço`);
          } else {
            // Priorizar distribuicao_fichas, fallback para inicio/fim
            const horaInicio = periodoConfig.inicio || periodoConfig.horario_inicio || '';
            const horaFim = periodoConfig.fim || periodoConfig.horario_fim || '';
            const distribuicaoFichas = periodoConfig.distribuicao_fichas || 
              `${horaInicio.substring(0,5)} às ${horaFim.substring(0,5)}`;
            const atendimentoInicio = periodoConfig.atendimento_inicio;
            
            // Formatar data
            const dataFormatadaRemar = new Date(nova_data + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
            
            // Montar mensagem dinâmica
            mensagem = `✅ Consulta remarcada para ${agendamento.pacientes?.nome_completo} em ${dataFormatadaRemar} no período da ${periodoNome} (${distribuicaoFichas})`;
            
            if (atendimentoInicio) {
              mensagem += `. Dr. começa a atender às ${atendimentoInicio}`;
            }
            
            mensagem += `, por ordem de chegada.`;
            console.log(`💬 Mensagem dinâmica ordem_chegada: ${periodoNome} (${distribuicaoFichas})`);
          }
        }
      }
    }

    return successResponse({
      message: mensagem,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data_anterior: agendamento.data_agendamento,
      hora_anterior: agendamento.hora_agendamento,
      nova_data,
      nova_hora,
      validado: true
    });

  } catch (error: any) {
    console.error('💥 Erro inesperado ao remarcar:', error);
    console.error('Stack:', error?.stack);
    return errorResponse(`Erro ao remarcar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}


// Cancelar consulta
