import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse, businessErrorResponse } from '../_lib/responses.ts'
import { getRequestScope, isServiceAllowed, filterDoctorsByScope } from '../_lib/scope.ts'
import { formatarConvenioParaBanco } from '../_lib/fuzzy-match.ts'

// ============= HANDLERS: FILA DE ESPERA INTELIGENTE =============

// Consultar fila de espera
export async function handleConsultarFila(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { medico_id, atendimento_id, status: statusFiltro } = body;
    
    console.log(`📋 [CONSULTAR-FILA] medico_id=${medico_id}, atendimento_id=${atendimento_id}, status=${statusFiltro || 'aguardando'}`);

    let query = supabase
      .from('fila_espera')
      .select(`
        id,
        status,
        prioridade,
        data_preferida,
        periodo_preferido,
        observacoes,
        tentativas_contato,
        ultimo_contato,
        created_at,
        pacientes(id, nome_completo, celular, convenio, data_nascimento),
        medicos(id, nome, especialidade),
        atendimentos(id, nome, tipo)
      `)
      .eq('cliente_id', clienteId)
      .eq('status', statusFiltro || 'aguardando')
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: true });

    if (medico_id) {
      query = query.eq('medico_id', medico_id);
    }
    if (atendimento_id) {
      query = query.eq('atendimento_id', atendimento_id);
    }

    const { data: filaItems, error } = await query;

    if (error) {
      console.error('❌ [CONSULTAR-FILA] Erro:', error.message);
      return errorResponse(`Erro ao consultar fila: ${error.message}`);
    }

    console.log(`✅ [CONSULTAR-FILA] ${filaItems?.length || 0} pacientes encontrados`);

    return successResponse({
      message: `Fila de espera: ${filaItems?.length || 0} paciente(s) encontrado(s)`,
      total: filaItems?.length || 0,
      fila: (filaItems || []).map((item: any) => ({
        fila_id: item.id,
        status: item.status,
        prioridade: item.prioridade,
        data_preferida: item.data_preferida,
        periodo_preferido: item.periodo_preferido,
        observacoes: item.observacoes,
        tentativas_contato: item.tentativas_contato,
        ultimo_contato: item.ultimo_contato,
        criado_em: item.created_at,
        paciente: {
          id: item.pacientes?.id,
          nome: item.pacientes?.nome_completo,
          celular: item.pacientes?.celular,
          convenio: item.pacientes?.convenio,
          data_nascimento: item.pacientes?.data_nascimento
        },
        medico: {
          id: item.medicos?.id,
          nome: item.medicos?.nome,
          especialidade: item.medicos?.especialidade
        },
        atendimento: {
          id: item.atendimentos?.id,
          nome: item.atendimentos?.nome,
          tipo: item.atendimentos?.tipo
        }
      }))
    });

  } catch (error: any) {
    return errorResponse(`Erro ao consultar fila: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Adicionar paciente à fila de espera
export async function handleAdicionarFila(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    // Normalização: aceita snake_case (padrão) e camelCase (retrocompatibilidade)
    const nomeCompleto = body.nome_completo || body.nomeCompleto;
    const dataNascimento = body.data_nascimento || body.dataNascimento;
    const convenio = body.convenio;
    const celular = body.celular;
    let medicoId = body.medico_id || body.medicoId;
    let atendimentoId = body.atendimento_id || body.atendimentoId;
    const medicoNome = body.medico_nome || body.medicoNome;
    const atendimentoNome = body.atendimento_nome || body.atendimentoNome;
    const dataPreferida = body.data_preferida || body.dataPreferida;
    const periodoPreferido = body.periodo_preferido || body.periodoPreferido;
    const observacoes = body.observacoes;
    const prioridade = body.prioridade;

    // Validações — aceita UUID ou nome para médico e atendimento
    if (!nomeCompleto || (!medicoId && !medicoNome) || (!atendimentoId && !atendimentoNome) || !dataPreferida) {
      return errorResponse('Campos obrigatórios: nome_completo, (medico_id ou medico_nome), (atendimento_id ou atendimento_nome), data_preferida');
    }

    if (!isServiceAllowed(atendimentoNome, scope)) {
      return businessErrorResponse({
        codigo_erro: 'SERVICO_FORA_DO_ESCOPO',
        mensagem_usuario: `❌ O serviço "${atendimentoNome}" não está disponível neste canal.\n\n✅ Serviços permitidos:\n${scope.serviceNames.map((service) => `   • ${service}`).join('\n')}`,
        detalhes: {
          servico_solicitado: atendimentoNome,
          servicos_permitidos: scope.serviceNames
        }
      });
    }

    // ============= RESOLVER MÉDICO POR NOME (se não veio UUID) =============
    let medicoNomeResolvido = '';
    if (!medicoId && medicoNome) {
      console.log(`🔍 [ADICIONAR-FILA] Resolvendo médico por nome: "${medicoNome}"`);
      const { data: todosMedicos, error: medicosError } = await supabase
        .from('medicos')
        .select('id, nome')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);

      if (medicosError || !todosMedicos || todosMedicos.length === 0) {
        return errorResponse('Erro ao buscar médicos ou nenhum médico ativo encontrado');
      }

      const normalizarNomeFuzzy = (texto: string): string =>
        texto.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[.,\-']/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const nomeNorm = normalizarNomeFuzzy(medicoNome);
      const medicosEncontrados = filterDoctorsByScope(todosMedicos, scope).filter((m: any) => {
        const nomeComplNorm = normalizarNomeFuzzy(m.nome);
        return nomeComplNorm.includes(nomeNorm) || nomeNorm.includes(nomeComplNorm);
      });

      if (medicosEncontrados.length === 0) {
        const sugestoes = todosMedicos.map((m: any) => m.nome).slice(0, 10);
        return errorResponse(`Médico "${medicoNome}" não encontrado. Disponíveis: ${sugestoes.join(', ')}`);
      }

      medicoId = medicosEncontrados[0].id;
      medicoNomeResolvido = medicosEncontrados[0].nome;
      console.log(`✅ [ADICIONAR-FILA] Médico resolvido: "${medicoNome}" → "${medicoNomeResolvido}" (${medicoId})`);
    }

    // ============= RESOLVER ATENDIMENTO POR NOME (se não veio UUID) =============
    let atendimentoNomeResolvido = '';
    if (!atendimentoId && atendimentoNome) {
      console.log(`🔍 [ADICIONAR-FILA] Resolvendo atendimento por nome: "${atendimentoNome}"`);
      const { data: atendimentos, error: atendError } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .eq('cliente_id', clienteId)
        .eq('medico_id', medicoId)
        .eq('ativo', true)
        .ilike('nome', `%${atendimentoNome}%`);

      if (atendError || !atendimentos || atendimentos.length === 0) {
        // Buscar lista de serviços disponíveis para sugerir
        const { data: servicosDisponiveis } = await supabase
          .from('atendimentos')
          .select('nome')
          .eq('cliente_id', clienteId)
          .eq('medico_id', medicoId)
          .eq('ativo', true);
        const sugestoes = servicosDisponiveis?.map((s: any) => s.nome) || [];
        return errorResponse(`Atendimento "${atendimentoNome}" não encontrado para este médico. Disponíveis: ${sugestoes.join(', ')}`);
      }

      atendimentoId = atendimentos[0].id;
      atendimentoNomeResolvido = atendimentos[0].nome;
      console.log(`✅ [ADICIONAR-FILA] Atendimento resolvido: "${atendimentoNome}" → "${atendimentoNomeResolvido}" (${atendimentoId})`);
    }

    console.log(`📥 [ADICIONAR-FILA] Paciente: ${nomeCompleto}, Médico: ${medicoId}, Atendimento: ${atendimentoId}`);

    // ============= RESOLVER PACIENTE_ID =============
    // Mesmo padrão do handleSchedule: buscar por nome + data_nascimento + celular
    const nomeNormalizado = nomeCompleto.toUpperCase().trim();
    let pacienteId: string | null = null;

    // Buscar paciente existente
    let queryPaciente = supabase
      .from('pacientes')
      .select('id, nome_completo, celular, data_nascimento')
      .eq('cliente_id', clienteId)
      .eq('nome_completo', nomeNormalizado);
    
    if (dataNascimento) {
      queryPaciente = queryPaciente.eq('data_nascimento', dataNascimento);
    }

    const { data: pacientesExistentes, error: searchError } = await queryPaciente;

    if (searchError) {
      console.error('⚠️ [ADICIONAR-FILA] Erro ao buscar paciente:', searchError.message);
    }

    if (pacientesExistentes && pacientesExistentes.length > 0) {
      // Paciente encontrado — usar o primeiro match
      pacienteId = pacientesExistentes[0].id;
      console.log(`✅ [ADICIONAR-FILA] Paciente existente: ${pacienteId}`);
    } else {
      // Criar novo paciente
      console.log(`🆕 [ADICIONAR-FILA] Criando novo paciente: ${nomeNormalizado}`);
      const { data: novoPaciente, error: createError } = await supabase
        .from('pacientes')
        .insert({
          cliente_id: clienteId,
          nome_completo: nomeNormalizado,
          data_nascimento: dataNascimento || null,
          convenio: formatarConvenioParaBanco(convenio || 'PARTICULAR'),
          celular: celular || '',
        })
        .select('id')
        .single();

      if (createError) {
        return errorResponse(`Erro ao criar paciente: ${createError.message}`);
      }
      pacienteId = novoPaciente.id;
      console.log(`✅ [ADICIONAR-FILA] Novo paciente criado: ${pacienteId}`);
    }

    // Verificar se já está na fila para o mesmo médico/atendimento
    const { data: jaExiste, error: checkError } = await supabase
      .from('fila_espera')
      .select('id, status')
      .eq('cliente_id', clienteId)
      .eq('paciente_id', pacienteId)
      .eq('medico_id', medicoId)
      .eq('atendimento_id', atendimentoId)
      .in('status', ['aguardando', 'notificado'])
      .maybeSingle();

    if (jaExiste) {
      return errorResponse(`Paciente ${nomeNormalizado} já está na fila de espera para este médico/atendimento (status: ${jaExiste.status})`);
    }

    // Inserir na fila de espera
    const { data: novaFila, error: insertError } = await supabase
      .from('fila_espera')
      .insert({
        cliente_id: clienteId,
        paciente_id: pacienteId,
        medico_id: medicoId,
        atendimento_id: atendimentoId,
        data_preferida: dataPreferida,
        periodo_preferido: periodoPreferido || 'qualquer',
        observacoes: observacoes || null,
        prioridade: prioridade || 1,
        status: 'aguardando'
      })
      .select('id')
      .single();

    if (insertError) {
      return errorResponse(`Erro ao adicionar na fila: ${insertError.message}`);
    }

    console.log(`✅ [ADICIONAR-FILA] Paciente adicionado à fila: ${novaFila.id}`);

    return successResponse({
      message: `Paciente ${nomeNormalizado} adicionado à fila de espera com sucesso`,
      fila_id: novaFila.id,
      paciente_id: pacienteId,
      paciente_nome: nomeNormalizado,
      medico_id: medicoId,
      medico_nome: medicoNomeResolvido || medicoNome || medicoId,
      atendimento_id: atendimentoId,
      atendimento_nome: atendimentoNomeResolvido || atendimentoNome || atendimentoId,
      data_preferida: dataPreferida,
      periodo_preferido: periodoPreferido || 'qualquer',
      prioridade: prioridade || 1,
      status: 'aguardando'
    });

  } catch (error: any) {
    return errorResponse(`Erro ao adicionar à fila: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Responder fila de espera (paciente aceita ou recusa a vaga)
export async function handleResponderFila(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const { fila_id, notif_id, resposta, data_agendamento, hora_agendamento } = body;

    if (!fila_id || !notif_id || !resposta) {
      return errorResponse('Campos obrigatórios: fila_id, notif_id, resposta (SIM/NAO)');
    }

    const respostaNormalizada = resposta.toUpperCase().trim();
    console.log(`📥 [RESPONDER-FILA] fila_id=${fila_id}, notif_id=${notif_id}, resposta=${respostaNormalizada}`);

    // ============= LOCK POR NOTIF_ID =============
    // Buscar notificação específica e validar antes de processar
    const { data: notif, error: notifErr } = await supabase
      .from('fila_notificacoes')
      .select('id, fila_id, tempo_limite, resposta_paciente, status_envio')
      .eq('id', notif_id)
      .eq('cliente_id', clienteId)
      .single();

    if (notifErr || !notif) {
      return errorResponse('Notificação não encontrada');
    }

    if (notif.fila_id !== fila_id) {
      return errorResponse('notif_id não pertence a este fila_id');
    }

    // Verificar se o tempo expirou
    if (new Date(notif.tempo_limite).getTime() < Date.now()) {
      return errorResponse('Tempo da vaga expirou. Aguarde a próxima oportunidade.');
    }

    // Verificar concorrência: já respondida por outra tentativa
    if (notif.resposta_paciente !== 'sem_resposta' || notif.status_envio !== 'pendente') {
      return errorResponse('Esta vaga já foi processada (respondida/expirada).');
    }

    // Buscar dados da fila
    const { data: filaItem, error: filaError } = await supabase
      .from('fila_espera')
      .select(`
        id, status, paciente_id, medico_id, atendimento_id, tentativas_contato,
        pacientes(id, nome_completo, celular, data_nascimento, convenio),
        medicos(id, nome),
        atendimentos(id, nome)
      `)
      .eq('id', fila_id)
      .eq('cliente_id', clienteId)
      .single();

    if (filaError || !filaItem) {
      return errorResponse('Item da fila não encontrado');
    }

    if (filaItem.status !== 'notificado') {
      return errorResponse(`Status atual da fila é "${filaItem.status}", esperado "notificado"`);
    }

    // ============= RESPOSTA SIM =============
    if (respostaNormalizada === 'SIM') {
      if (!data_agendamento || !hora_agendamento) {
        return errorResponse('Para aceitar a vaga, informe: data_agendamento e hora_agendamento');
      }

      console.log(`✅ [RESPONDER-FILA] Paciente ACEITOU. Agendando via RPC atômica...`);

      // Usar RPC criar_agendamento_atomico_externo (garante validação de conflito + atomicidade)
      const { data: result, error: agendamentoError } = await supabase
        .rpc('criar_agendamento_atomico_externo', {
          p_cliente_id: clienteId,
          p_nome_completo: filaItem.pacientes?.nome_completo?.toUpperCase(),
          p_data_nascimento: filaItem.pacientes?.data_nascimento,
          p_convenio: filaItem.pacientes?.convenio || 'PARTICULAR',
          p_telefone: null,
          p_celular: filaItem.pacientes?.celular || '',
          p_medico_id: filaItem.medico_id,
          p_atendimento_id: filaItem.atendimento_id,
          p_data_agendamento: data_agendamento,
          p_hora_agendamento: hora_agendamento,
          p_observacoes: 'AGENDAMENTO VIA FILA DE ESPERA - WHATSAPP',
          p_criado_por: 'Fila de Espera WhatsApp',
          p_force_conflict: false
        });

      if (agendamentoError) {
        console.error('❌ [RESPONDER-FILA] Erro na RPC:', agendamentoError.message);
        return errorResponse(`Erro ao agendar: ${agendamentoError.message}`);
      }

      if (!result?.success) {
        console.error('❌ [RESPONDER-FILA] RPC retornou erro:', result);
        return errorResponse(`Não foi possível agendar: ${result?.message || 'Horário pode estar ocupado'}`);
      }

      // Atualizar fila para 'agendado'
      await supabase
        .from('fila_espera')
        .update({ 
          status: 'agendado',
          agendamento_id: result.agendamento_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', fila_id)
        .eq('cliente_id', clienteId);

      // Atualizar notificação
      await supabase
        .from('fila_notificacoes')
        .update({ 
          resposta_paciente: 'aceito',
          status_envio: 'respondido'
        })
        .eq('id', notif_id)
        .eq('cliente_id', clienteId)
        .eq('resposta_paciente', 'sem_resposta');

      console.log(`✅ [RESPONDER-FILA] Agendamento criado: ${result.agendamento_id}`);

      return successResponse({
        message: `Vaga confirmada! Agendamento criado para ${filaItem.pacientes?.nome_completo}`,
        agendamento_id: result.agendamento_id,
        paciente: filaItem.pacientes?.nome_completo,
        medico: filaItem.medicos?.nome,
        data: data_agendamento,
        hora: hora_agendamento,
        fila_id,
        acao: 'agendado'
      });
    }

    // ============= RESPOSTA NÃO / TIMEOUT =============
    if (respostaNormalizada === 'NAO' || respostaNormalizada === 'NÃO' || respostaNormalizada === 'TIMEOUT') {
      console.log(`❌ [RESPONDER-FILA] Paciente RECUSOU/TIMEOUT. Buscando próximo da fila...`);

      // Voltar status da fila para 'aguardando'
      await supabase
        .from('fila_espera')
        .update({ 
          status: 'aguardando',
          tentativas_contato: (filaItem.tentativas_contato || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', fila_id)
        .eq('cliente_id', clienteId);

      // Atualizar notificação
      const respostaNotif = respostaNormalizada === 'TIMEOUT' ? 'sem_resposta' : 'recusado';
      await supabase
        .from('fila_notificacoes')
        .update({ 
          resposta_paciente: respostaNotif,
          status_envio: 'respondido'
        })
        .eq('id', notif_id)
        .eq('cliente_id', clienteId)
        .eq('resposta_paciente', 'sem_resposta');

      // ============= BUSCAR PRÓXIMO CANDIDATO (CASCATA) =============
      let proximoNotificado: any = null;
      try {
        const { data: proximoCandidato, error: proxError } = await supabase
          .from('fila_espera')
          .select(`
            id, paciente_id,
            pacientes(nome_completo, celular)
          `)
          .eq('medico_id', filaItem.medico_id)
          .eq('atendimento_id', filaItem.atendimento_id)
          .eq('status', 'aguardando')
          .eq('cliente_id', clienteId)
          .neq('id', fila_id) // Excluir o que acabou de recusar
          .order('prioridade', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (proxError) {
          console.error('⚠️ [RESPONDER-FILA] Erro ao buscar próximo (ignorado):', proxError.message);
        } else if (proximoCandidato && data_agendamento && hora_agendamento) {
          console.log(`🔄 [RESPONDER-FILA] Próximo candidato: ${proximoCandidato.pacientes?.nome_completo}`);

          // Atualizar próximo para 'notificado'
          await supabase
            .from('fila_espera')
            .update({ 
              status: 'notificado',
              ultimo_contato: new Date().toISOString(),
              tentativas_contato: 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', proximoCandidato.id)
            .eq('cliente_id', clienteId);

          // Criar notificação para o próximo
          const tempoLimite = new Date();
          tempoLimite.setHours(tempoLimite.getHours() + 2);

          const { data: notifNova, error: notifInsertErr } = await supabase
            .from('fila_notificacoes')
            .insert({
              fila_id: proximoCandidato.id,
              cliente_id: clienteId,
              data_agendamento,
              hora_agendamento,
              horario_disponivel: new Date().toISOString(),
              tempo_limite: tempoLimite.toISOString(),
              status_envio: 'pendente',
              resposta_paciente: 'sem_resposta',
              canal_notificacao: 'whatsapp'
            })
            .select('id')
            .single();

          if (notifInsertErr) {
            console.error('⚠️ [RESPONDER-FILA] Erro ao inserir notificação cascata:', notifInsertErr.message);
          }

          proximoNotificado = {
            fila_id: proximoCandidato.id,
            notif_id: notifNova?.id || '',
            paciente_nome: proximoCandidato.pacientes?.nome_completo,
            paciente_celular: proximoCandidato.pacientes?.celular,
            data_disponivel: data_agendamento,
            hora_disponivel: hora_agendamento,
            tempo_limite: tempoLimite.toISOString()
          };

          // Webhook disparado pelo trigger PG (trigger_notificar_fila_webhook) no INSERT acima

          console.log(`📱 [RESPONDER-FILA] Próximo notificado: ${proximoNotificado.paciente_nome}`);
        } else {
          console.log('ℹ️ [RESPONDER-FILA] Nenhum próximo candidato na fila');
        }
      } catch (cascataErr: any) {
        console.error('⚠️ [RESPONDER-FILA] Erro na cascata (ignorado):', cascataErr?.message);
      }

      const responseData: any = {
        message: `Resposta registrada: ${respostaNormalizada}`,
        fila_id,
        paciente: filaItem.pacientes?.nome_completo,
        acao: respostaNormalizada === 'TIMEOUT' ? 'timeout' : 'recusado'
      };

      if (proximoNotificado) {
        responseData.proximo_notificado = proximoNotificado;
        responseData.message += `. Próximo paciente da fila notificado: ${proximoNotificado.paciente_nome}`;
      } else {
        responseData.message += `. Nenhum outro paciente na fila.`;
      }

      return successResponse(responseData);
    }

    return errorResponse('Resposta inválida. Use: SIM, NAO ou TIMEOUT');

  } catch (error: any) {
    return errorResponse(`Erro ao processar resposta da fila: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Confirmar consulta
