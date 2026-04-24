import {
  CheckAvailabilityUseCase,
  BookAppointmentUseCase,
  SupabaseAppointmentRepository,
  SupabaseScheduleRepository,
  DynamicConfigBusinessRulesRepository,
  SlotAlreadyTakenError,
} from '../../_shared/scheduling-core/index.ts'
import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, errorResponse, businessErrorResponse } from '../_lib/responses.ts'
import { getRequestScope, isDoctorAllowed, isServiceAllowed, filterDoctorsByScope, getDoctorScopeSummary, hasDoctorScope } from '../_lib/scope.ts'
import { getMedicoRules, getMensagemPersonalizada, verificarLimitesCompartilhados, calcularVagasDisponiveisComLimites, verificarSublimiteConvenio } from '../_lib/limites.ts'
import { normalizarServicoPeriodos, buscarAgendaDedicada } from '../_lib/config.ts'
import { mapSchedulingData, sanitizarCampoOpcional, normalizarNome, formatarDataPorExtenso, normalizarConvenioParaComparacao } from '../_lib/normalizacao.ts'
import { getTipoAgendamentoEfetivo, isOrdemChegada, isEstimativaHorario, getMensagemEstimativa, getDataHoraAtualBrasil, validarDataHoraFutura, calcularIdade, BUSINESS_RULES } from '../_lib/tipo-agendamento.ts'
import { fuzzyMatchMedicos, formatarConvenioParaBanco } from '../_lib/fuzzy-match.ts'

export async function handleSchedule(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    console.log('📥 [SCHEDULE] Dados recebidos:', {
      keys: Object.keys(body || {}),
      doctor_scope_count: scope.doctorIds.length,
      has_paciente_nome: !!(body?.paciente_nome || body?.nome_paciente || body?.nome_completo),
      has_data_nascimento: !!(body?.data_nascimento || body?.paciente_nascimento || body?.birth_date || body?.nascimento),
      has_celular: !!(body?.celular || body?.mobile || body?.whatsapp || body?.telefone_celular),
      has_medico_id: !!body?.medico_id,
      has_medico_nome: !!body?.medico_nome,
      has_atendimento_nome: !!body?.atendimento_nome,
      has_data_consulta: !!(body?.data_consulta || body?.data_agendamento || body?.appointment_date || body?.data),
      has_hora_consulta: !!(body?.hora_consulta || body?.hora_agendamento || body?.appointment_time || body?.hora),
    });
    
    // 🛡️ SANITIZAÇÃO AUTOMÁTICA: Remover "=" do início dos valores (problema comum do N8N)
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('=')) {
        const cleaned = value.substring(1);
        console.log(`🧹 Sanitizado: "${value}" → "${cleaned}"`);
        return cleaned;
      }
      return value;
    };
    
    // Sanitizar todos os campos do body antes do mapeamento
    const sanitizedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, sanitizeValue(value)])
    );
    
    // 🆕 Aplicar sanitização robusta em campos opcionais
    const robustSanitizedBody = {
      ...sanitizedBody,
      data_nascimento: sanitizarCampoOpcional(sanitizedBody.data_nascimento),
      telefone: sanitizarCampoOpcional(sanitizedBody.telefone),
      celular: sanitizarCampoOpcional(sanitizedBody.celular)
    };
    
    // Mapear dados flexivelmente (aceitar diferentes formatos)
    const mappedData = mapSchedulingData(robustSanitizedBody);
    console.log('🔄 [SCHEDULE] Dados mapeados:', {
      has_paciente_nome: !!mappedData.paciente_nome,
      data_nascimento: mappedData.data_nascimento,
      celular_masked: mappedData.celular ? `${mappedData.celular.substring(0, 4)}****` : null,
      has_medico_nome: !!mappedData.medico_nome,
      has_medico_id: !!mappedData.medico_id,
      atendimento_nome: mappedData.atendimento_nome || null,
      data_consulta: mappedData.data_consulta || null,
      hora_consulta: mappedData.hora_consulta || null,
    });
    
    const { 
      paciente_nome, 
      data_nascimento, 
      convenio, 
      telefone, 
      celular, 
      medico_nome, 
      medico_id,
      atendimento_nome, 
      data_consulta, 
      hora_consulta, 
      observacoes 
    } = mappedData;

    if (!isServiceAllowed(atendimento_nome, scope)) {
      return businessErrorResponse({
        codigo_erro: 'SERVICO_FORA_DO_ESCOPO',
        mensagem_usuario: `❌ O serviço "${atendimento_nome}" não está disponível neste canal.\n\n✅ Serviços permitidos:\n${scope.serviceNames.map((service) => `   • ${service}`).join('\n')}`,
        detalhes: {
          servico_solicitado: atendimento_nome,
          servicos_permitidos: scope.serviceNames
        }
      });
    }

    // Validar campos obrigatórios
    if (!paciente_nome || !data_nascimento || !convenio || !celular || (!medico_nome && !medico_id) || !data_consulta || !hora_consulta) {
      const missingFields = [];
      if (!paciente_nome) missingFields.push('paciente_nome');
      if (!data_nascimento) missingFields.push('data_nascimento');
      if (!convenio) missingFields.push('convenio');
      if (!celular) missingFields.push('celular');
      if (!medico_nome && !medico_id) missingFields.push('medico_nome ou medico_id');
      if (!data_consulta) missingFields.push('data_consulta');
      if (!hora_consulta) missingFields.push('hora_consulta');
      
      return businessErrorResponse({
        codigo_erro: 'DADOS_INCOMPLETOS',
        mensagem_usuario: `❌ Faltam informações obrigatórias para o agendamento:\n\n${missingFields.map(f => `   • ${f}`).join('\n')}\n\n💡 Por favor, forneça todos os dados necessários.`,
        detalhes: {
          campos_faltando: missingFields
        }
      });
    }

    // 🚫 VALIDAR: Data/hora não pode ser no passado
    const validacaoDataSchedule = validarDataHoraFutura(data_consulta, hora_consulta);
    if (!validacaoDataSchedule.valido) {
      const { data: dataAtualBrasil } = getDataHoraAtualBrasil();
      
      if (validacaoDataSchedule.erro === 'DATA_PASSADA') {
        return businessErrorResponse({
          codigo_erro: 'DATA_PASSADA',
          mensagem_usuario: `❌ Não é possível agendar para ${formatarDataPorExtenso(data_consulta)} pois essa data já passou.\n\n📅 A data de hoje é ${formatarDataPorExtenso(dataAtualBrasil)}.\n\n💡 Por favor, escolha uma data a partir de hoje.`,
          detalhes: { 
            data_solicitada: data_consulta,
            data_atual: dataAtualBrasil
          }
        });
      }
      
      if (validacaoDataSchedule.erro === 'HORARIO_PASSADO') {
        return businessErrorResponse({
          codigo_erro: 'HORARIO_PASSADO',
          mensagem_usuario: `❌ Não é possível agendar para ${hora_consulta} hoje pois esse horário já passou ou está muito próximo.\n\n⏰ Horário mínimo para agendamento hoje: ${validacaoDataSchedule.horaMinima}\n\n💡 Escolha um horário posterior ou agende para outro dia.`,
          detalhes: { 
            data_solicitada: data_consulta,
            hora_solicitada: hora_consulta,
            hora_minima: validacaoDataSchedule.horaMinima
          }
        });
      }
    }

    // 🗓️ Calcular dia da semana (necessário para validações)
    const dataObj = new Date(data_consulta + 'T00:00:00');
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dia_semana = diasSemana[dataObj.getDay()];
    
    // Função simples para classificar período baseado na hora
    const classificarPeriodoSimples = (hora: string): string => {
      const [h] = hora.split(':').map(Number);
      return h < 12 ? 'manha' : 'tarde';
    };
    const periodo = classificarPeriodoSimples(hora_consulta);

    // Buscar médico por ID ou nome (COM filtro de cliente)
    let medico;
    console.log('🔍 Iniciando busca de médico...');
    if (medico_id) {
      console.log(`🔍 Buscando médico por ID: ${medico_id}`);
      let medicoQuery = supabase
        .from('medicos')
        .select('id, nome, ativo, crm, rqe')
        .eq('id', medico_id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true);

      if (scope.doctorIds.length > 0) {
        medicoQuery = medicoQuery.in('id', scope.doctorIds);
      }

      const { data, error } = await medicoQuery.single();
      
      medico = data;
      if (error || !medico) {
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico com ID "${medico_id}" não foi encontrado ou está inativo.\n\n💡 Verifique se o código do médico está correto ou entre em contato com a clínica.`,
          detalhes: { medico_id }
        });
      }
      console.log(`✅ Médico encontrado por ID: ${medico.nome}`);
      
      // 🆕 VERIFICAR AGENDA DEDICADA PARA O SERVIÇO (busca por ID)
      if (atendimento_nome) {
        const agendaDedicada = await buscarAgendaDedicada(supabase, clienteId, medico.nome, atendimento_nome);
        if (agendaDedicada) {
          console.log(`🔄 [SCHEDULE] Redirecionando para agenda dedicada "${agendaDedicada.nome}" (ID: ${agendaDedicada.id})`);
          medico = { id: agendaDedicada.id, nome: agendaDedicada.nome, ativo: true };
          console.log(`✅ [SCHEDULE] Agendamento será criado na agenda: ${medico.nome}`);
        }
      }
    } else {
      console.log(`🔍 Buscando médico por nome: ${medico_nome}`);
      
      // Buscar TODOS os médicos ativos do cliente (mesma lógica do handleAvailability)
      const { data: todosMedicos, error: medicosError } = await supabase
        .from('medicos')
        .select('id, nome, ativo, crm, rqe')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      
      if (medicosError || !todosMedicos || todosMedicos.length === 0) {
        console.error(`❌ Erro ao buscar médicos:`, medicosError);
        return businessErrorResponse({
          codigo_erro: 'ERRO_BUSCA_MEDICOS',
          mensagem_usuario: '❌ Não foi possível buscar médicos disponíveis.',
          detalhes: { erro: medicosError?.message }
        });
      }

      const medicosDentroDoEscopo = filterDoctorsByScope(todosMedicos, scope);

      if (hasDoctorScope(scope) && medicosDentroDoEscopo.length === 0) {
        return businessErrorResponse({
          codigo_erro: 'ESCOPO_SEM_MEDICOS',
          mensagem_usuario: `❌ Este canal não possui médicos autorizados para agendamento.\n\nEscopo atual: ${getDoctorScopeSummary(scope)}.`,
          detalhes: {
            doctor_scope_ids: scope.doctorIds,
            doctor_scope_names: scope.doctorNames
          }
        });
      }
      
      console.log(`📋 Total de médicos ativos encontrados: ${todosMedicos.length}`);
      console.log(`📋 Médicos disponíveis no escopo: ${medicosDentroDoEscopo.map(m => m.nome).join(', ')}`);
      
      // Matching inteligente com fuzzy fallback
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      const medicosEncontrados = fuzzyMatchMedicos(medico_nome, medicosDentroDoEscopo);
      
      if (medicosEncontrados.length === 0) {
        console.log(`❌ Nenhum médico encontrado para: "${medico_nome}"`);
        const sugestoes = medicosDentroDoEscopo.map(m => m.nome).slice(0, 10);
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico "${medico_nome}" não encontrado.\n\n✅ Médicos disponíveis:\n${sugestoes.map(m => `   • ${m}`).join('\n')}`,
          detalhes: { medico_solicitado: medico_nome, medicos_disponiveis: sugestoes }
        });
      }
      
      medico = medicosEncontrados[0];
      console.log(`✅ Médico encontrado por nome inteligente: "${medico_nome}" → "${medico.nome}" (ID: ${medico.id})`);
      
      // 🆕 VERIFICAR AGENDA DEDICADA PARA O SERVIÇO (busca por nome)
      if (atendimento_nome) {
        const agendaDedicada = await buscarAgendaDedicada(supabase, clienteId, medico.nome, atendimento_nome);
        if (agendaDedicada) {
          console.log(`🔄 [SCHEDULE] Redirecionando para agenda dedicada "${agendaDedicada.nome}" (ID: ${agendaDedicada.id})`);
          medico = { id: agendaDedicada.id, nome: agendaDedicada.nome, ativo: true };
          console.log(`✅ [SCHEDULE] Agendamento será criado na agenda: ${medico.nome}`);
        }
      }
    }

    if (!isDoctorAllowed(medico?.id, medico?.nome, scope)) {
      return businessErrorResponse({
        codigo_erro: 'MEDICO_FORA_DO_ESCOPO',
        mensagem_usuario: `❌ ${medico?.nome || 'Este médico'} não está disponível neste canal.\n\nEscopo atual: ${getDoctorScopeSummary(scope)}.`,
        detalhes: {
          medico_id: medico?.id || null,
          medico_nome: medico?.nome || null,
          doctor_scope_ids: scope.doctorIds,
          doctor_scope_names: scope.doctorNames
        }
      });
    }

    // 🏥 VALIDAR CONVÊNIO ANTES DE PROSSEGUIR
    console.log('🔍 Validando convênio do paciente...');
    if (convenio) {
      // Buscar convênios aceitos do médico (da tabela medicos)
      const { data: medicoConvenios } = await supabase
        .from('medicos')
        .select('convenios_aceitos')
        .eq('id', medico.id)
        .eq('cliente_id', clienteId)
        .single();
      
      const conveniosAceitosMedico: string[] = medicoConvenios?.convenios_aceitos || [];
      
      // Também verificar nas business_rules
      const regrasConvenio = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
      const conveniosRegras: string[] = regrasConvenio?.convenios_aceitos || [];
      
      // Unir convênios de ambas as fontes
      const todosConveniosAceitos = [...new Set([...conveniosAceitosMedico, ...conveniosRegras])];
      
      if (todosConveniosAceitos.length > 0) {
        // Normalizar espelhando o regexp do banco: regexp_replace(upper(trim(c)), '[^A-Z0-9%]+', '', 'g')
        const convenioNorm = normalizarConvenioParaComparacao(convenio);
        const convenioAceito = todosConveniosAceitos.some(c => {
          const cNorm = normalizarConvenioParaComparacao(c);
          return cNorm === convenioNorm ||
                 cNorm.includes(convenioNorm) ||
                 convenioNorm.includes(cNorm);
        });
        
        if (!convenioAceito) {
          console.log(`❌ [CONVENIO] "${convenio}" não aceito por ${medico.nome}. Aceitos: ${todosConveniosAceitos.join(', ')}`);
          return businessErrorResponse({
            codigo_erro: 'CONVENIO_NAO_ACEITO',
            mensagem_usuario: `❌ O convênio "${convenio}" não é aceito pelo(a) ${medico.nome}.\n\n✅ Convênios aceitos:\n${todosConveniosAceitos.map(c => `   • ${c}`).join('\n')}\n\n💡 Verifique se o convênio está correto ou escolha outro profissional.`,
            detalhes: {
              convenio_solicitado: convenio,
              convenios_aceitos: todosConveniosAceitos,
              medico: medico.nome
            }
          });
        }
        console.log(`✅ [CONVENIO] "${convenio}" aceito por ${medico.nome}`);
      } else {
        console.log(`ℹ️ [CONVENIO] Médico ${medico.nome} sem restrições de convênio configuradas`);
      }
    }

    console.log('🔍 Buscando regras de negócio...');
    // ===== VALIDAÇÕES DE REGRAS DE NEGÓCIO (APENAS PARA N8N) =====
    const regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    // Aviso de idade para appending em observacoes quando bloquear_por_idade=false
    let ageWarning = '';
    console.log(`📋 Regras encontradas para médico ID ${medico.id}: ${regras ? 'SIM' : 'NÃO'}`);
    
    if (regras) {
      console.log(`✅ Regras válidas para ${regras.nome}`);
      console.log(`📋 Tipo de regras.servicos: ${typeof regras.servicos}`);
      console.log(`📋 Regras.servicos é null/undefined: ${!regras.servicos}`);
      
      // Validar se regras.servicos existe e é um objeto
      if (!regras.servicos || typeof regras.servicos !== 'object') {
        console.error(`❌ ERRO: regras.servicos inválido para ${regras.nome}`);
        console.error(`📋 Estrutura de regras:`, JSON.stringify(regras, null, 2));
        // Não bloquear o agendamento, apenas pular validações
        console.log(`⚠️ Prosseguindo sem validações de serviço para ${medico.nome}`);
      } else {
        console.log(`✅ regras.servicos válido, contém ${Object.keys(regras.servicos).length} serviço(s)`);
        
        // 1. Validar idade mínima
        // bloquear_por_idade controla o comportamento:
        //   true (padrão): bloqueia o agendamento — adequado para o bot WhatsApp
        //   false: apenas anota aviso em observacoes — mesmo comportamento do portal/recepção
        if (regras.idade_minima && regras.idade_minima > 0) {
          const idade = calcularIdade(data_nascimento);
          if (idade < regras.idade_minima) {
            if (regras.bloquear_por_idade !== false) {
              const mensagemIdadeMinima = regras.mensagem_idade_minima ||
                `❌ ${regras.nome} atende apenas pacientes com ${regras.idade_minima}+ anos.\n\n📋 Idade informada: ${idade} anos\n\n💡 Por favor, consulte outro profissional adequado para a faixa etária.`;

              console.log(`🚫 [IDADE] Paciente com ${idade} anos bloqueado (mínimo: ${regras.idade_minima})`);

              return businessErrorResponse({
                codigo_erro: 'IDADE_INCOMPATIVEL',
                mensagem_usuario: mensagemIdadeMinima,
                detalhes: {
                  medico: regras.nome,
                  idade_minima: regras.idade_minima,
                  idade_paciente: idade
                }
              });
            } else {
              ageWarning = ` [ATENÇÃO: idade ${idade} anos abaixo do mínimo ${regras.idade_minima} anos]`;
              console.log(`⚠️ [IDADE] ${idade} anos abaixo do mínimo ${regras.idade_minima} — bloquear_por_idade=false, anotando em observacoes`);
            }
          }
          console.log(`✅ Validação de idade OK: ${idade} anos (mínimo: ${regras.idade_minima})`);
        }
        
        // 2. Validar serviço específico
        if (atendimento_nome) {
          try {
            // 🔧 CORREÇÃO: Normalizar nomes para matching correto
            // "Ligadura de Hemorroidas" → "ligadurahemorrodas" = "ligadura_hemorroidas"
            const normalizarNome = (texto: string): string => 
              texto.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
                .replace(/\b(de|da|do|das|dos)\b/g, '') // Remove preposições conectivas
                .replace(/[_\-\s]+/g, '')         // Remove underscores, hífens, espaços
                .replace(/oi/g, 'o')              // hemorroidas → hemorrodos (normaliza variações)
                .replace(/ai/g, 'a');             // variações comuns
            
            const atendimentoNorm = normalizarNome(atendimento_nome);
            const servicoChaves = Object.keys(regras.servicos);
            console.log(`🔍 [handleSchedule] Buscando serviço: "${atendimento_nome}" → normalizado: "${atendimentoNorm}"`);
            console.log(`🔍 [handleSchedule] Chaves normalizadas: [${servicoChaves.map(s => `${s}→${normalizarNome(s)}`).join(', ')}]`);
            
            const servicoKeyValidacao = Object.keys(regras.servicos).find(s => {
              const servicoNorm = normalizarNome(s);
              const match = servicoNorm.includes(atendimentoNorm) || 
                           atendimentoNorm.includes(servicoNorm) ||
                           servicoNorm === atendimentoNorm;
              if (match) {
                console.log(`✅ [handleSchedule] Match encontrado: "${s}" (${servicoNorm}) ← "${atendimento_nome}" (${atendimentoNorm})`);
              }
              return match;
            });
            
            if (servicoKeyValidacao) {
              const servicoLocal = regras.servicos[servicoKeyValidacao];
              console.log(`🔍 Validando serviço: ${servicoKeyValidacao}`);
              
              
              // 2.1 Verificar se permite agendamento online (multi-nível: serviço, raiz, config nested)
              const permiteOnline = 
                servicoLocal.permite_online || 
                servicoLocal.permite_agendamento_online ||
                regras?.permite_agendamento_online ||      // Nível raiz das regras (agendas dedicadas)
                (regras as any)?.config?.permite_agendamento_online;  // Fallback config nested
              if (!permiteOnline) {
                console.log(`❌ Serviço ${servicoKeyValidacao} não permite agendamento online`);
                return businessErrorResponse({
                  codigo_erro: 'SERVICO_NAO_DISPONIVEL_ONLINE',
                  mensagem_usuario: servicoLocal.mensagem || `❌ O serviço "${servicoKeyValidacao}" não pode ser agendado online.\n\n📞 Por favor, entre em contato com a clínica para agendar este procedimento.`,
                  detalhes: {
                    servico: servicoKeyValidacao,
                    medico: regras.nome
                  }
                });
              }
              
              // 🆕 2.1.1 VERIFICAR LIMITES COMPARTILHADOS E SUBLIMITES
              if (servicoLocal.compartilha_limite_com || servicoLocal.limite_proprio) {
                console.log(`🔐 Serviço "${servicoKeyValidacao}" tem limites especiais configurados`);
                
                const resultadoLimites = await verificarLimitesCompartilhados(
                  supabase,
                  clienteId,
                  medico.id,
                  data_consulta,
                  servicoKeyValidacao,
                  servicoLocal,
                  regras
                );
                
                if (!resultadoLimites.permitido) {
                  console.log(`❌ Limites compartilhados/sublimite bloquearam agendamento: ${resultadoLimites.erro_codigo}`);
                  
                  // Buscar próximas datas disponíveis para este serviço
                  const proximasDatasDisponiveis: Array<{data: string; dia_semana: string; vagas_disponiveis: number}> = [];
                  const diasSemanaArr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  
                  for (let dias = 1; dias <= 30; dias++) {
                    const dataFutura = new Date(data_consulta + 'T00:00:00');
                    dataFutura.setDate(dataFutura.getDate() + dias);
                    const dataFuturaStr = dataFutura.toISOString().split('T')[0];
                    const diaSemanaNum = dataFutura.getDay();
                    
                    // Pular finais de semana
                    if (diaSemanaNum === 0 || diaSemanaNum === 6) continue;
                    
                    // Verificar se o dia é permitido para o serviço
                    if (servicoLocal.dias && !servicoLocal.dias.includes(diaSemanaNum)) continue;
                    
                    // Verificar vagas disponíveis considerando limites
                    const vagasDisponiveis = await calcularVagasDisponiveisComLimites(
                      supabase,
                      clienteId,
                      medico.id,
                      dataFuturaStr,
                      servicoKeyValidacao,
                      servicoLocal,
                      regras
                    );
                    
                    if (vagasDisponiveis > 0) {
                      proximasDatasDisponiveis.push({
                        data: dataFuturaStr,
                        dia_semana: diasSemanaArr[diaSemanaNum],
                        vagas_disponiveis: vagasDisponiveis
                      });
                      
                      if (proximasDatasDisponiveis.length >= 5) break;
                    }
                  }
                  
                  let mensagemUsuario = `❌ ${resultadoLimites.mensagem}\n\n`;
                  
                  if (proximasDatasDisponiveis.length > 0) {
                    mensagemUsuario += `✅ Próximas datas disponíveis:\n\n`;
                    proximasDatasDisponiveis.forEach(d => {
                      mensagemUsuario += `📅 ${formatarDataPorExtenso(d.data)} (${d.dia_semana}) - ${d.vagas_disponiveis} vaga(s)\n`;
                    });
                    mensagemUsuario += `\n💡 Gostaria de agendar em uma destas datas?`;
                  } else {
                    mensagemUsuario += `⚠️ Não encontramos vagas nos próximos 30 dias.\n`;
                    mensagemUsuario += `📞 Por favor, entre em contato com a clínica para mais opções.`;
                  }
                  
                  return businessErrorResponse({
                    codigo_erro: resultadoLimites.erro_codigo || 'LIMITE_ATINGIDO',
                    mensagem_usuario: mensagemUsuario,
                    detalhes: {
                      ...resultadoLimites.detalhes,
                      medico: regras.nome,
                      servico: servicoKeyValidacao,
                      data_solicitada: data_consulta
                    },
                    sugestoes: proximasDatasDisponiveis.length > 0 ? {
                      proximas_datas: proximasDatasDisponiveis,
                      acao_sugerida: 'reagendar_data_alternativa'
                    } : null
                  });
                }
                
                console.log(`✅ Limites compartilhados/sublimite OK para "${servicoKeyValidacao}"`);
              }
              
              // 2.2 Verificar dias permitidos
              if (servicoLocal.dias_permitidos && dia_semana && !servicoLocal.dias_permitidos.includes(dia_semana)) {
                const diasPermitidos = servicoLocal.dias_permitidos.join(', ');
                console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} às ${dia_semana}s`);
                return businessErrorResponse({
                  codigo_erro: 'DIA_NAO_PERMITIDO',
                  mensagem_usuario: `❌ ${regras.nome} não atende ${servicoKeyValidacao} no dia escolhido.\n\n✅ Dias disponíveis: ${diasPermitidos}\n\n💡 Escolha uma data em um dos dias disponíveis.`,
                  detalhes: {
                    medico: regras.nome,
                    servico: servicoKeyValidacao,
                    dia_solicitado: dia_semana,
                    dias_permitidos: servicoLocal.dias_permitidos
                  }
                });
              }
              
              // 2.3 Verificar períodos específicos por dia
              if (servicoLocal.periodos_por_dia && periodo && dia_semana) {
                const periodosPermitidos = servicoLocal.periodos_por_dia[dia_semana];
                if (periodosPermitidos && !periodosPermitidos.includes(periodo)) {
                  console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodo} às ${dia_semana}s`);
                  const periodoTexto = periodo === 'manha' ? 'Manhã' : periodo === 'tarde' ? 'Tarde' : 'Noite';
                  return businessErrorResponse({
                    codigo_erro: 'PERIODO_NAO_PERMITIDO',
                    mensagem_usuario: `❌ ${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodoTexto} às ${dia_semana}s.\n\n✅ Períodos disponíveis neste dia: ${periodosPermitidos.map(p => p === 'manha' ? 'Manhã' : p === 'tarde' ? 'Tarde' : 'Noite').join(', ')}\n\n💡 Escolha um dos períodos disponíveis.`,
                    detalhes: {
                      medico: regras.nome,
                      servico: servicoKeyValidacao,
                      dia_semana: dia_semana,
                      periodo_solicitado: periodo,
                      periodos_disponiveis: periodosPermitidos
                    }
                  });
                }
                
                if (!periodosPermitidos && servicoLocal.periodos_por_dia) {
                  const diasDisponiveis = Object.keys(servicoLocal.periodos_por_dia);
                  const diasPermitidos = diasDisponiveis.join(', ');
                  console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} às ${dia_semana}s no período da ${periodo}`);
                  const periodoTexto = periodo === 'manha' ? 'Manhã' : periodo === 'tarde' ? 'Tarde' : 'Noite';
                  return businessErrorResponse({
                    codigo_erro: 'DIA_PERIODO_NAO_PERMITIDO',
                    mensagem_usuario: `❌ ${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodoTexto} no dia escolhido.\n\n✅ Dias disponíveis para este período: ${diasPermitidos}\n\n💡 Escolha uma data em um dos dias disponíveis.`,
                    detalhes: {
                      medico: regras.nome,
                      servico: servicoKeyValidacao,
                      dia_solicitado: dia_semana,
                      periodo: periodo,
                      dias_com_periodo: diasDisponiveis
                    }
                  });
                }
              }
              
              // 2.4 Verificar limite de vagas
              if (servicoLocal.periodos && periodo && data_consulta) {
                const configPeriodo = servicoLocal.periodos[periodo];
                if (configPeriodo && configPeriodo.limite) {
                  // 🆕 Usar contagem_inicio/contagem_fim se configurados, senão fallback
                  const inicioContagem = configPeriodo.contagem_inicio || configPeriodo.inicio;
                  const fimContagem = configPeriodo.contagem_fim || configPeriodo.fim;
                  console.log(`🔢 [CONTAGEM] Validação - exibição: ${configPeriodo.inicio}-${configPeriodo.fim}, contagem: ${inicioContagem}-${fimContagem}`);
                  
                   // ✅ Buscar TODOS os agendamentos ativos do período (sem filtro de created_at)
                   let query = supabase
                     .from('agendamentos')
                     .select('id, hora_agendamento, created_at')
                     .eq('medico_id', medico.id)
                     .eq('data_agendamento', data_consulta)
                     .eq('cliente_id', clienteId)
                     .is('excluido_em', null)
                     .is('cancelado_em', null)
                     .in('status', ['agendado', 'confirmado']);
                  
                  // 🆕 Filtrar por horário do período de CONTAGEM
                  if (inicioContagem && fimContagem) {
                    query = query
                      .gte('hora_agendamento', inicioContagem)
                      .lt('hora_agendamento', fimContagem);
                  }
                  
                  const { data: agendamentos, error: agendError } = await query;
                  
                  if (agendError) {
                    console.error('Erro ao verificar limite de vagas:', agendError);
                  } else {
                    const vagasOcupadas = agendamentos?.length || 0;
                    if (vagasOcupadas >= configPeriodo.limite) {
                      console.log(`❌ Limite atingido para ${servicoKeyValidacao}: ${vagasOcupadas}/${configPeriodo.limite}`);
                      
                      // 🆕 Buscar próximas datas com vagas disponíveis
                      let proximasDatasDisponiveis = [];
                      console.log(`🔍 Buscando datas alternativas para ${regras.nome} - ${servicoKeyValidacao}...`);
                      console.log(`📋 Limite de vagas: ${configPeriodo.limite}`);
                      console.log(`📋 Período: ${configPeriodo.periodo || 'não especificado'}`);
                      
                      try {
                        // Buscar próximas 60 datas com vagas
                        for (let dias = 1; dias <= 60; dias++) {
                          const dataFutura = new Date(data_consulta + 'T00:00:00');
                          dataFutura.setDate(dataFutura.getDate() + dias);
                          const dataFuturaStr = dataFutura.toISOString().split('T')[0];
                          
                          // Pular finais de semana
                          const diaSemana = dataFutura.getDay();
                          if (diaSemana === 0 || diaSemana === 6) {
                            console.log(`⏭️  Pulando ${dataFuturaStr} (final de semana)`);
                            continue;
                          }
                          
                          
                           // ✅ Buscar TODOS os agendamentos ativos do período (sem filtro de created_at)
                           let queryFuturos = supabase
                             .from('agendamentos')
                             .select('id, atendimento_id, hora_agendamento, created_at')
                             .eq('medico_id', medico.id)
                             .eq('data_agendamento', dataFuturaStr)
                             .eq('cliente_id', clienteId)
                             .is('excluido_em', null)
                             .is('cancelado_em', null)
                             .in('status', ['agendado', 'confirmado']);
                          
                          // 🆕 Filtrar por horário do período de CONTAGEM
                          if (inicioContagem && fimContagem) {
                            queryFuturos = queryFuturos
                              .gte('hora_agendamento', inicioContagem)
                              .lt('hora_agendamento', fimContagem);
                          }
                          
                          const { data: agendadosFuturos, error: errorFuturo } = await queryFuturos;
                          
                          if (errorFuturo) {
                            console.error(`❌ Erro ao buscar agendamentos para ${dataFuturaStr}:`, errorFuturo);
                            continue;
                          }
                          
                          const ocupadasFuturo = agendadosFuturos?.length || 0;
                          console.log(`📊 ${dataFuturaStr}: ${ocupadasFuturo}/${configPeriodo.limite} vagas ocupadas`);
                          
                          if (ocupadasFuturo < configPeriodo.limite) {
                            const diasSemanaArr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                            const vagasLivres = configPeriodo.limite - ocupadasFuturo;
                            console.log(`✅ Data disponível encontrada: ${dataFuturaStr} - ${vagasLivres} vaga(s) livre(s)`);
                            
                            proximasDatasDisponiveis.push({
                              data: dataFuturaStr,
                              dia_semana: diasSemanaArr[diaSemana],
                              vagas_disponiveis: vagasLivres,
                              total_vagas: configPeriodo.limite
                            });
                            
                            if (proximasDatasDisponiveis.length >= 5) {
                              console.log(`✅ Encontradas 5 datas disponíveis, parando busca.`);
                              break;
                            }
                          }
                        }
                        
                        console.log(`📊 Total de datas alternativas encontradas: ${proximasDatasDisponiveis.length}`);
                      } catch (err) {
                        console.error('❌ Erro ao buscar datas futuras:', err);
                      }
                      
                      // Construir mensagem amigável para WhatsApp
                      let mensagemUsuario = `❌ Não há mais vagas para ${regras.nome} - ${servicoKeyValidacao} em ${data_consulta}.\n\n`;
                      mensagemUsuario += `📊 Status: ${vagasOcupadas}/${configPeriodo.limite} vagas ocupadas\n\n`;
                      
                      if (proximasDatasDisponiveis.length > 0) {
                        mensagemUsuario += `✅ Próximas datas disponíveis:\n\n`;
                        proximasDatasDisponiveis.forEach(d => {
                          mensagemUsuario += `📅 ${d.data} (${d.dia_semana}) - ${d.vagas_disponiveis} vaga(s)\n`;
                        });
                        mensagemUsuario += `\n💡 Gostaria de agendar em uma destas datas?`;
                      } else {
                        mensagemUsuario += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
                        mensagemUsuario += `Por favor, entre em contato com a clínica para mais opções.`;
                      }
                      
                      return businessErrorResponse({
                        codigo_erro: 'LIMITE_VAGAS_ATINGIDO',
                        mensagem_usuario: mensagemUsuario,
                        detalhes: {
                          medico: regras.nome,
                          servico: servicoKeyValidacao,
                          data_solicitada: data_consulta,
                          limite_vagas: configPeriodo.limite,
                          vagas_ocupadas: vagasOcupadas,
                          vagas_disponiveis: 0
                        },
                        sugestoes: proximasDatasDisponiveis.length > 0 ? {
                          proximas_datas: proximasDatasDisponiveis,
                          acao_sugerida: 'reagendar_data_alternativa'
                        } : null
                      });
                    }
                    console.log(`✅ Vagas disponíveis: ${configPeriodo.limite - vagasOcupadas}`);
                  }
                }
              }
              
              // 🆕 2.5 VERIFICAR SUBLIMITE POR CONVÊNIO (ex: HGU max 18/turno)
              if (convenio && regras?.convenio_sublimites) {
                const resultadoConvenioSublimite = await verificarSublimiteConvenio(
                  supabase, clienteId, medico.id, data_consulta, convenio, regras,
                  periodo, servicoLocal
                );
                
                if (!resultadoConvenioSublimite.permitido) {
                  console.log(`❌ [CONVENIO SUBLIMITE] Bloqueado: ${resultadoConvenioSublimite.erro_codigo}`);
                  
                  // Buscar próximas datas com vagas para esse convênio
                  const proximasDatasConvenio: Array<{data: string; dia_semana: string; vagas_disponiveis: number}> = [];
                  const diasSemanaArr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  
                  for (let dias = 1; dias <= 30 && proximasDatasConvenio.length < 5; dias++) {
                    const dataFutura = new Date(data_consulta + 'T00:00:00');
                    dataFutura.setDate(dataFutura.getDate() + dias);
                    const dataFuturaStr = dataFutura.toISOString().split('T')[0];
                    const diaSemanaNum = dataFutura.getDay();
                    if (diaSemanaNum === 0 || diaSemanaNum === 6) continue;
                    if (servicoLocal?.dias_semana && !servicoLocal.dias_semana.includes(diaSemanaNum)) continue;
                    
                    const checkResult = await verificarSublimiteConvenio(
                      supabase, clienteId, medico.id, dataFuturaStr, convenio, regras,
                      periodo, servicoLocal
                    );
                    if (checkResult.permitido) {
                      proximasDatasConvenio.push({
                        data: dataFuturaStr,
                        dia_semana: diasSemanaArr[diaSemanaNum],
                        vagas_disponiveis: (resultadoConvenioSublimite.detalhes?.sublimite || 0) - ((checkResult as any).detalhes?.ocupado || 0)
                      });
                    }
                  }
                  
                  let msgConvenio = `❌ ${resultadoConvenioSublimite.mensagem}\n\n`;
                  if (proximasDatasConvenio.length > 0) {
                    msgConvenio += `✅ Próximas datas com vagas ${convenio}:\n\n`;
                    proximasDatasConvenio.forEach(d => {
                      msgConvenio += `📅 ${formatarDataPorExtenso(d.data)} (${d.dia_semana})\n`;
                    });
                    msgConvenio += `\n💡 Gostaria de agendar em uma destas datas?`;
                  } else {
                    msgConvenio += `📞 Entre em contato com a clínica para mais opções.`;
                  }
                  
                  return businessErrorResponse({
                    codigo_erro: 'SUBLIMITE_CONVENIO_ATINGIDO',
                    mensagem_usuario: msgConvenio,
                    detalhes: resultadoConvenioSublimite.detalhes,
                    sugestoes: proximasDatasConvenio.length > 0 ? {
                      proximas_datas: proximasDatasConvenio,
                      acao_sugerida: 'reagendar_data_alternativa'
                    } : null
                  });
                }
              }
            } else {
              console.log(`⚠️ Serviço "${atendimento_nome}" não encontrado nas regras, prosseguindo sem validação específica`);
            }
          } catch (validationError: any) {
            console.error(`❌ Erro ao validar serviço:`, validationError);
            console.error(`📋 Stack:`, validationError.stack);
            // Não bloquear o agendamento por erro de validação
            console.log(`⚠️ Prosseguindo sem validação de serviço devido a erro`);
          }
        }
      }
    } else {
      console.log(`ℹ️ Médico ${medico.nome} sem regras específicas - prosseguindo com agendamento padrão`);
    }

    // ── Buscar serviços do médico via pivot M:N (com fallback para modelo antigo medico_id) ──
    let todosAtendimentosMedico: Array<{ id: string; nome: string; tipo: string }> = [];

    // Tentativa 1: RPC pivot (disponível após migration M:N)
    const { data: pivotAtend, error: pivotError } = await supabase.rpc('get_atendimentos_por_medico', {
      p_medico_id: medico.id,
      p_cliente_id: clienteId
    } as any);

    if (!pivotError && pivotAtend && (pivotAtend as any[]).length > 0) {
      todosAtendimentosMedico = pivotAtend as any[];
      console.log(`📋 Serviços via pivot: ${todosAtendimentosMedico.length}`);
    } else {
      // Fallback: filtro legado por medico_id
      console.log(`📋 Fallback: buscando serviços por medico_id (pré-migration)`);
      const { data: legacyAtend } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo')
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      todosAtendimentosMedico = legacyAtend || [];
    }

    // Buscar atendimento por nome (se especificado)
    let atendimento_id = null;
    if (atendimento_nome) {
      console.log(`🔍 Buscando atendimento: "${atendimento_nome}" para médico ${medico.nome}`);
      const nomeLower = atendimento_nome.toLowerCase();

      // Tentativa 1: correspondência parcial no nome
      let atendimento = todosAtendimentosMedico.find(a =>
        a.nome.toLowerCase().includes(nomeLower) || nomeLower.includes(a.nome.toLowerCase())
      );

      // Tentativa 2: fallback por tipo (consulta/retorno/exame)
      if (!atendimento) {
        console.log(`⚠️ Não encontrado com nome exato, tentando por tipo...`);
        let tipoAtendimento: string | null = null;
        if (nomeLower.includes('consult')) tipoAtendimento = 'consulta';
        else if (nomeLower.includes('retorn')) tipoAtendimento = 'retorno';
        else if (nomeLower.includes('exam')) tipoAtendimento = 'exame';

        if (tipoAtendimento) {
          console.log(`🎯 Detectado tipo: ${tipoAtendimento}`);
          atendimento = todosAtendimentosMedico.find(a => a.tipo === tipoAtendimento);
          if (atendimento) console.log(`✅ Encontrado por tipo: ${atendimento.nome}`);
        }
      }

      // Não encontrado: listar opções disponíveis
      if (!atendimento) {
        console.error(`❌ Atendimento "${atendimento_nome}" não encontrado. Disponíveis: ${todosAtendimentosMedico.map(a => a.nome).join(', ')}`);
        return businessErrorResponse({
          codigo_erro: 'SERVICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ O serviço "${atendimento_nome}" não foi encontrado para ${medico.nome}.\n\n✅ Serviços disponíveis:\n${todosAtendimentosMedico.map(a => `   • ${a.nome} (${a.tipo})`).join('\n') || '   (nenhum cadastrado)'}\n\n💡 Escolha um dos serviços disponíveis acima.`,
          detalhes: {
            servico_solicitado: atendimento_nome,
            medico: medico.nome,
            servicos_disponiveis: todosAtendimentosMedico
          }
        });
      }

      atendimento_id = atendimento.id;
      console.log(`✅ Atendimento selecionado: ${atendimento.nome} (ID: ${atendimento_id})`);

    } else {
      // Nenhum atendimento especificado: usar primeiro disponível
      console.log(`🔍 Nenhum atendimento especificado, usando primeiro disponível...`);
      if (!todosAtendimentosMedico.length) {
        return errorResponse(`Nenhum atendimento disponível para o médico ${medico.nome}`);
      }
      atendimento_id = todosAtendimentosMedico[0].id;
      console.log(`✅ Primeiro atendimento selecionado: ${todosAtendimentosMedico[0].nome}`);
    }

    // 🆕 PARSEAR INTERVALO DE HORÁRIO (ex: "13:00 às 15:00" → "13:00")
    let horarioFinal = hora_consulta;
    
    // Se vier um intervalo, extrair apenas o horário de início
    const intervaloMatch = hora_consulta.match(/^(\d{1,2}:\d{2})\s*(?:às|as|a|-|até)\s*\d{1,2}:\d{2}$/i);
    if (intervaloMatch) {
      horarioFinal = intervaloMatch[1];
      console.log(`🔄 Detectado intervalo "${hora_consulta}". Usando horário de início: ${horarioFinal}`);
    }
    
    // 🆕 SE HORA_CONSULTA FOR PERÍODO, BUSCAR HORÁRIO ESPECÍFICO AUTOMATICAMENTE
    
    // Detectar se é período ("manhã", "tarde", "noite") ao invés de horário específico
    const isPeriodo = /^(manh[aã]|tarde|noite)$/i.test(horarioFinal);
    
    if (isPeriodo) {
      console.log(`🔄 Detectado período "${hora_consulta}" ao invés de horário específico. Buscando primeiro horário disponível...`);
      
      // Normalizar período
      const periodoNormalizado = hora_consulta.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/manha/g, 'manha')
        .replace(/tarde/g, 'tarde')
        .replace(/noite/g, 'noite');
      
      // Buscar regras do médico (dinâmico primeiro, fallback hardcoded)
      const regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
      
      if (regras && regras.servicos) {
        // Encontrar serviço
        const servicoKey = Object.keys(regras.servicos).find(s => 
          s.toLowerCase().includes(atendimento_nome.toLowerCase()) ||
          atendimento_nome.toLowerCase().includes(s.toLowerCase())
        );
        
        if (servicoKey) {
          const servico = regras.servicos[servicoKey];
          const configPeriodo = servico.periodos?.[periodoNormalizado];
          
          if (configPeriodo) {
            if (regras.tipo_agendamento === 'hora_marcada') {
              // HORA MARCADA: buscar primeiro horário disponível
              console.log(`🕒 Buscando slots disponíveis para hora marcada no período ${periodoNormalizado}`);
              
              const intervaloMinutos = configPeriodo.intervalo_minutos || 30;
              const [horaInicio, minInicio] = configPeriodo.inicio.split(':').map(Number);
              const [horaFim, minFim] = configPeriodo.fim.split(':').map(Number);
              
              let horaAtual = horaInicio * 60 + minInicio;
              const horaLimite = horaFim * 60 + minFim;
              
              // Buscar primeiro slot livre
              while (horaAtual < horaLimite) {
                const h = Math.floor(horaAtual / 60);
                const m = horaAtual % 60;
                const horarioTeste = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                
                // Verificar se este horário está disponível
                const { count } = await supabase
                  .from('agendamentos')
                  .select('*', { count: 'exact', head: true })
                  .eq('medico_id', medico.id)
                  .eq('data_agendamento', data_consulta)
                  .eq('hora_agendamento', horarioTeste)
                  .eq('cliente_id', clienteId)
                  .is('excluido_em', null)
                  .in('status', ['agendado', 'confirmado']);
                
                if (count === 0) {
                  console.log(`✅ Primeiro horário disponível encontrado: ${horarioTeste}`);
                  horarioFinal = horarioTeste;
                  break;
                }
                
                horaAtual += intervaloMinutos;
              }
              
              if (horarioFinal === hora_consulta) {
                // Não encontrou nenhum horário livre
                return errorResponse(
                  `❌ Não há horários disponíveis no período da ${hora_consulta} em ${data_consulta}.\n\n` +
                  `💡 Por favor, consulte a disponibilidade primeiro ou escolha outro período.`
                );
              }
            } else {
              // ORDEM DE CHEGADA: buscar primeiro horário LIVRE (não fixo!)
              console.log(`📋 Ordem de chegada: buscando primeiro horário livre no período ${periodoNormalizado}`);
              
              const intervaloMinutos = 1; // Incremento de 1min para ordem de chegada
              const [horaInicio, minInicio] = configPeriodo.inicio.split(':').map(Number);
              const [horaFim, minFim] = configPeriodo.fim.split(':').map(Number);
              
              let horaAtual = horaInicio * 60 + minInicio;
              const horaLimite = horaFim * 60 + minFim;
              
              // Buscar primeiro minuto livre
              while (horaAtual < horaLimite) {
                const h = Math.floor(horaAtual / 60);
                const m = horaAtual % 60;
                const horarioTeste = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                
                // Verificar se este horário está disponível
                const { count } = await supabase
                  .from('agendamentos')
                  .select('*', { count: 'exact', head: true })
                  .eq('medico_id', medico.id)
                  .eq('data_agendamento', data_consulta)
                  .eq('hora_agendamento', horarioTeste)
                  .eq('cliente_id', clienteId)
                  .is('excluido_em', null)
                  .in('status', ['agendado', 'confirmado']);
                
                if (count === 0) {
                  console.log(`✅ Primeiro horário livre encontrado: ${horarioTeste}`);
                  horarioFinal = horarioTeste;
                  break;
                }
                
                horaAtual += intervaloMinutos;
              }
              
              if (horarioFinal === hora_consulta) {
                // Não encontrou nenhum horário livre no período
                return errorResponse(
                  `❌ Não há horários disponíveis no período da ${hora_consulta} em ${data_consulta}.\n\n` +
                  `💡 Todas as vagas da ${hora_consulta} já foram ocupadas. Consulte a disponibilidade para ver outros períodos.`
                );
              }
            }
          } else {
            return errorResponse(
              `❌ O médico ${medico.nome} não atende no período da ${hora_consulta}.\n\n` +
              `💡 Por favor, consulte a disponibilidade primeiro para ver os períodos disponíveis.`
            );
          }
        } else {
          return errorResponse(
            `❌ Não foi possível validar o serviço "${atendimento_nome}".\n\n` +
            `💡 Por favor, especifique um horário específico (ex: "08:00") ao invés de um período.`
          );
        }
      } else {
        return errorResponse(
          `❌ Período "${hora_consulta}" detectado, mas não há regras configuradas para este médico.\n\n` +
          `💡 Por favor, especifique um horário específico no formato HH:MM (ex: "08:00").`
        );
      }
      
      console.log(`🎯 Horário final selecionado: ${horarioFinal} (convertido de "${hora_consulta}")`);
    }

    // Criar agendamento via BookAppointmentUseCase
    console.log(`📅 Criando agendamento para ${paciente_nome} com médico ${medico.nome} às ${horarioFinal}`);

    // Chave de idempotência baseada no input original (hora_consulta), não no slot resolvido.
    // Para pedidos de período ("manhã"/"tarde"), horarioFinal muda a cada retry se o slot anterior
    // já foi ocupado — mas hora_consulta permanece igual, garantindo que findDuplicate encontre
    // o agendamento já criado e evite duplicatas.
    const idempotencyKey = `${clienteId}:${celular}:${medico.id}:${data_consulta}:${hora_consulta}`;
    const bookRepo = new SupabaseAppointmentRepository(supabase);

    // result mantém shape { success, agendamento_id, paciente_id } compatível com código legado abaixo
    let result: any;
    try {
      const bookResult = await new BookAppointmentUseCase(bookRepo).execute({
        patient: {
          nomeCompleto: paciente_nome.toUpperCase(),
          dataNascimento: data_nascimento,
          convenio: formatarConvenioParaBanco(convenio),
          celular,
          telefone: telefone || null,
        },
        appointment: {
          medicoId: medico.id,
          clienteId,
          atendimentoId: atendimento_id,
          date: data_consulta,
          time: horarioFinal,
          observacoes: ((observacoes || 'Agendamento via LLM Agent WhatsApp') + ageWarning).toUpperCase(),
        },
        meta: {
          criadoPor: 'LLM Agent WhatsApp',
          idempotencyKey,
        },
      });
      result = { success: true, agendamento_id: bookResult.appointmentId, paciente_id: bookResult.patientId };
      console.log('📋 Agendamento via use case:', { id: bookResult.appointmentId, created: bookResult.created });
    } catch (err: any) {
      if (err instanceof SlotAlreadyTakenError) {
        result = { success: false, error: 'CONFLICT' };
        console.log('🔄 SlotAlreadyTakenError: iniciando busca minuto a minuto...');
      } else {
        throw err;
      }
    }

    if (!result?.success) {
      console.error('❌ Função retornou erro:', result);
      
      // 🆕 SE FOR CONFLITO DE HORÁRIO, TENTAR ALOCAR AUTOMATICAMENTE MINUTO A MINUTO
      if (result?.error === 'CONFLICT') {
        console.log('🔄 Conflito detectado, iniciando busca minuto a minuto...');
        
        // Determinar período baseado no horário FINAL (não hora_consulta!)
        const [hora] = horarioFinal.split(':').map(Number);
        let periodoConfig = null;
        let nomePeriodo = '';
        
        // Buscar regras do médico (dinâmico primeiro, fallback hardcoded)
        const regrasMedico = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
        if (regrasMedico) {
          const servicoKey = Object.keys(regrasMedico.servicos)[0];
          const servico = normalizarServicoPeriodos(regrasMedico.servicos[servicoKey]);
          // Determinar se é manhã ou tarde
          if (servico.periodos?.manha) {
            const [hInicio] = servico.periodos.manha.inicio.split(':').map(Number);
            const [hFim] = servico.periodos.manha.fim.split(':').map(Number);
            if (hora >= hInicio && hora < hFim) {
              periodoConfig = servico.periodos.manha;
              nomePeriodo = 'manhã';
            }
          }
          
          if (!periodoConfig && servico.periodos?.tarde) {
            const [hInicio] = servico.periodos.tarde.inicio.split(':').map(Number);
            const [hFim] = servico.periodos.tarde.fim.split(':').map(Number);
            if (hora >= hInicio && hora < hFim) {
              periodoConfig = servico.periodos.tarde;
              nomePeriodo = 'tarde';
            }
          }
        }
        
        // Se encontrou período válido, fazer loop minuto a minuto
        if (periodoConfig) {
          console.log(`📋 Período detectado: ${nomePeriodo} (${periodoConfig.inicio}-${periodoConfig.fim}, limite: ${periodoConfig.limite})`);
          
          // Calcular minutos do período
          const [hInicio, minInicio] = periodoConfig.inicio.split(':').map(Number);
          const [hFim, minFim] = periodoConfig.fim.split(':').map(Number);
          const minutoInicio = hInicio * 60 + minInicio;
          const minutoFim = hFim * 60 + minFim;
          
          console.log(`🔍 Iniciando busca de ${periodoConfig.inicio} até ${periodoConfig.fim} (${minutoFim - minutoInicio} minutos)`);
          
          let tentativas = 0;
          let horarioAlocado = null;
          let resultadoFinal = null;
          
          // Loop minuto a minuto
          for (let minutoAtual = minutoInicio; minutoAtual < minutoFim; minutoAtual++) {
            tentativas++;
            const hora = Math.floor(minutoAtual / 60);
            const min = minutoAtual % 60;
            const horarioTeste = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
            
            console.log(`🔁 Tentativa ${tentativas}: Testando ${horarioTeste}...`);
            
            // Tentar agendar neste minuto via repository (idempotencyKey do horário original)
            let tentativaResult: any;
            try {
              const tentativa = await bookRepo.create({
                clienteId,
                nomeCompleto: paciente_nome.toUpperCase(),
                dataNascimento: data_nascimento,
                convenio: formatarConvenioParaBanco(convenio),
                telefone: telefone || null,
                celular,
                medicoId: medico.id,
                atendimentoId: atendimento_id,
                date: data_consulta,
                time: horarioTeste,
                observacoes: ((observacoes || 'Agendamento via LLM Agent WhatsApp') + ageWarning).toUpperCase(),
                criadoPor: 'LLM Agent WhatsApp',
                idempotencyKey,
              });
              tentativaResult = { success: true, agendamento_id: tentativa.appointmentId, paciente_id: tentativa.patientId };
            } catch (tentativaErr: any) {
              if (tentativaErr instanceof SlotAlreadyTakenError) {
                console.log(`⏭️  ${horarioTeste} ocupado, tentando próximo...`);
                continue;
              }
              // Outro tipo de erro (convênio, regra de negócio, etc.) - parar o loop
              console.error(`⚠️ Erro não-conflito em ${horarioTeste}:`, tentativaErr.message);
              return businessErrorResponse({
                codigo_erro: 'ERRO_AGENDAMENTO',
                mensagem_usuario: tentativaErr.message || `Erro ao tentar agendar: ${tentativaErr.message}`,
                detalhes: { horario: horarioTeste }
              });
            }

            if (tentativaResult?.success) {
              // ✅ SUCESSO! Encontramos um horário livre
              console.log(`✅ SUCESSO! Agendado em ${horarioTeste} após ${tentativas} tentativas`);
              horarioAlocado = horarioTeste;
              resultadoFinal = tentativaResult;
              break;
            }
          }
          
          // Verificar se conseguiu alocar
          if (horarioAlocado && resultadoFinal) {
            // 🆕 Usar mesma lógica detalhada de mensagem (prefixo + período + orientações)
            let mensagem = '';
            let temOrientacoes = false;
            
            // Buscar mensagem de confirmação personalizada
            const msgConfirmacao = getMensagemPersonalizada(config, 'confirmacao_agendamento', medico.id);
            const msgPagamento = getMensagemPersonalizada(config, 'pagamento', medico.id);
            
            const dataFormatada = new Date(data_consulta + 'T00:00:00').toLocaleDateString('pt-BR');
            const [hAlocado] = horarioAlocado.split(':').map(Number);
            
            if (msgConfirmacao) {
              mensagem = `✅ ${msgConfirmacao}`;
            } else {
              // 🆕 USAR PREFIXO PERSONALIZADO E DISTRIBUICAO_FICHAS
              let prefixoFinal = 'Consulta agendada';
              let periodoNomeConf = '';
              let periodoHorarioConf = '';
              let atendimentoInicioConf = '';
              
              // Buscar config do serviço para informações detalhadas
              // 🔧 FIX: Usar regrasMedico (já declarado na linha 2724) ao invés de regrasMedicoSchedule
              if (regrasMedico?.servicos) {
                const servicoKey = Object.keys(regrasMedico.servicos)[0];
                const servicoAtualRaw = regrasMedico.servicos[servicoKey];
                const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
                
                // 1️⃣ PREFIXO PERSONALIZADO
                prefixoFinal = servicoAtual?.prefixo_mensagem || 'Consulta agendada';
                
                if (servicoAtual?.periodos) {
                  // 2️⃣ DETECTAR PERÍODO BASEADO NO HORÁRIO ALOCADO
                  if (servicoAtual.periodos.manha) {
                    const manha = servicoAtual.periodos.manha;
                    const horaInicioM = manha.inicio || manha.horario_inicio;
                    const horaFimM = manha.fim || manha.horario_fim;
                    if (horaInicioM && horaFimM) {
                      const [hInicioM] = horaInicioM.split(':').map(Number);
                      const [hFimM] = horaFimM.split(':').map(Number);
                      if (hAlocado >= hInicioM && hAlocado < hFimM) {
                        periodoNomeConf = 'manhã';
                        periodoHorarioConf = manha.distribuicao_fichas || `${horaInicioM.substring(0,5)} às ${horaFimM.substring(0,5)}`;
                        atendimentoInicioConf = manha.atendimento_inicio || '';
                      }
                    }
                  }
                  if (!periodoNomeConf && servicoAtual.periodos.tarde) {
                    const tarde = servicoAtual.periodos.tarde;
                    const horaInicioT = tarde.inicio || tarde.horario_inicio;
                    const horaFimT = tarde.fim || tarde.horario_fim;
                    if (horaInicioT && horaFimT) {
                      const [hInicioT] = horaInicioT.split(':').map(Number);
                      const [hFimT] = horaFimT.split(':').map(Number);
                      if (hAlocado >= hInicioT && hAlocado < hFimT) {
                        periodoNomeConf = 'tarde';
                        periodoHorarioConf = tarde.distribuicao_fichas || `${horaInicioT.substring(0,5)} às ${horaFimT.substring(0,5)}`;
                        atendimentoInicioConf = tarde.atendimento_inicio || '';
                      }
                    }
                  }
                }
                
                // 3️⃣ VERIFICAR SE TEM ORIENTAÇÕES
                if (servicoAtual?.orientacoes) {
                  temOrientacoes = true;
                }
                
                // 5️⃣ ANEXAR ORIENTAÇÕES AO FINAL (movido para dentro do if)
                if (servicoAtual?.orientacoes) {
                  // Será anexado após gerar a mensagem base
                }
              }
              
              // 4️⃣ GERAR MENSAGEM COM PREFIXO E PERÍODO DETALHADO
              if (periodoNomeConf && periodoHorarioConf) {
                if (atendimentoInicioConf) {
                  mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}). Dr. começa a atender às ${atendimentoInicioConf}, por ordem de chegada.`;
                } else {
                  mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}), por ordem de chegada.`;
                }
              } else {
                mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} por ordem de chegada.`;
              }
              
              // 5️⃣ ANEXAR ORIENTAÇÕES AO FINAL
              if (regrasMedico?.servicos) {
                const servicoKey = Object.keys(regrasMedico.servicos)[0];
                const servicoAtualRaw = regrasMedico.servicos[servicoKey];
                const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
                if (servicoAtual?.orientacoes) {
                  mensagem += `\n\n${servicoAtual.orientacoes}`;
                }
              }
            }
            
            // Adicionar mensagem de pagamento se existir
            if (msgPagamento) {
              mensagem += `\n\n💰 ${msgPagamento}`;
            }
            
            // 6️⃣ SÓ ADICIONAR "POSSO AJUDAR..." SE NÃO TIVER ORIENTAÇÕES
            if (!temOrientacoes) {
              mensagem += `\n\nPosso ajudar em algo mais?`;
            }
            
            return successResponse({
              message: mensagem,
              agendamento_id: resultadoFinal.agendamento_id,
              paciente_id: resultadoFinal.paciente_id,
              data: data_consulta,
              hora: horarioAlocado,
              medico: medico.nome,
              atendimento: atendimento_nome || 'Consulta',
              validado: true,
              confirmacao_criado: true
            });
          }
          
          // Se chegou aqui, não conseguiu alocar em nenhum minuto
          console.log(`⚠️ Não foi possível alocar após ${tentativas} tentativas. Verificando estado do período...`);
          
          // 🔍 VERIFICAR CONTAGEM REAL DE AGENDAMENTOS NO PERÍODO
          // 🆕 Usar contagem_inicio/contagem_fim se configurados
          const inicioContagemFinal = periodoConfig.contagem_inicio || periodoConfig.inicio;
          const fimContagemFinal = periodoConfig.contagem_fim || periodoConfig.fim;
          const [hInicioContagem, mInicioContagem] = inicioContagemFinal.split(':').map(Number);
          const [hFimContagem, mFimContagem] = fimContagemFinal.split(':').map(Number);
          const minInicioContagem = hInicioContagem * 60 + mInicioContagem;
          const minFimContagem = hFimContagem * 60 + mFimContagem;
          
          console.log(`🔢 [CONTAGEM FINAL] Exibição: ${periodoConfig.inicio}-${periodoConfig.fim}, Contagem: ${inicioContagemFinal}-${fimContagemFinal}`);
          
          const { data: agendamentosDoPeriodo } = await supabase
            .from('agendamentos')
            .select('hora_agendamento')
            .eq('medico_id', medico.id)
            .eq('data_agendamento', data_consulta)
            .eq('cliente_id', clienteId)
            .in('status', ['agendado', 'confirmado']);
          
          const agendamentosNoPeriodo = agendamentosDoPeriodo?.filter(a => {
            const [h, m] = a.hora_agendamento.split(':').map(Number);
            const minutoAgendamento = h * 60 + m;
            return minutoAgendamento >= minInicioContagem && minutoAgendamento < minFimContagem;
          }) || [];
          
          const vagasOcupadas = agendamentosNoPeriodo.length;
          const vagasDisponiveis = periodoConfig.limite - vagasOcupadas;
          
          console.log(`📊 Estado final: ${vagasOcupadas}/${periodoConfig.limite} vagas ocupadas no período ${nomePeriodo}`);
          
          if (vagasDisponiveis <= 0) {
            // Período realmente lotado
            console.log(`❌ Período ${nomePeriodo} está completamente lotado`);
            return businessErrorResponse({
              codigo_erro: 'PERIODO_LOTADO',
              mensagem_usuario: `O período da ${nomePeriodo} está com todas as vagas ocupadas (${vagasOcupadas}/${periodoConfig.limite}). Por favor, escolha outro período ou outro dia.`,
              detalhes: {
                periodo: nomePeriodo,
                vagas_ocupadas: vagasOcupadas,
                vagas_total: periodoConfig.limite,
                data_solicitada: data_consulta,
                tentativas_realizadas: tentativas
              }
            });
          } else {
            // Tem vagas mas nenhum minuto passou na função atômica
            console.log(`⚠️ Período tem ${vagasDisponiveis} vaga(s) mas nenhum horário foi aceito pelo banco após ${tentativas} tentativas`);
            return businessErrorResponse({
              codigo_erro: 'ALOCACAO_FALHOU',
              mensagem_usuario: `Não foi possível encontrar um horário disponível no período da ${nomePeriodo}. Foram testados ${tentativas} minutos, mas todos apresentaram conflitos. Por favor, tente outro período ou entre em contato.`,
              detalhes: {
                periodo: nomePeriodo,
                vagas_disponiveis: vagasDisponiveis,
                vagas_ocupadas: vagasOcupadas,
                vagas_total: periodoConfig.limite,
                data_solicitada: data_consulta,
                tentativas_realizadas: tentativas,
                sugestao: 'O sistema pode estar com alta demanda ou há restrições específicas. Tente outro período.'
              }
            });
          }
        }
      }
      
      // Para outros erros, manter comportamento original
      return errorResponse(result?.error || result?.message || 'Erro desconhecido', 'ERRO_AGENDAMENTO');
    }

    console.log('✅ Agendamento criado com sucesso:', result);

    // 🆕 Usar mensagens dinâmicas do banco em vez de hardcoded
    const dataFormatada = new Date(data_consulta + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const horaFormatada = horarioFinal.substring(0, 5); // "08:00:00" → "08:00"
    const [hora] = horarioFinal.split(':').map(Number);
    
    // 🆕 Determinar tipo de agendamento efetivo
    const regrasMedicoSchedule = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    const servicoSchedule = atendimento_nome ? Object.entries(regrasMedicoSchedule?.servicos || {}).find(([nomeServico, _cfg]: [string, any]) => {
      return nomeServico.toLowerCase().includes(atendimento_nome.toLowerCase()) ||
             atendimento_nome.toLowerCase().includes(nomeServico.toLowerCase());
    }) : null;
    // Extrair o config do serviço se encontrado (o find retorna [key, value])
    const servicoConfigSchedule = servicoSchedule ? servicoSchedule[1] : null;
    const tipoEfetivoSchedule = getTipoAgendamentoEfetivo(servicoConfigSchedule, regrasMedicoSchedule);
    
    console.log(`📋 [CONFIRMAÇÃO] Tipo efetivo: ${tipoEfetivoSchedule}`);
    
    // Buscar mensagens personalizadas do banco
    const msgConfirmacao = getMensagemPersonalizada(config, 'confirmacao_agendamento', medico.id);
    const msgPagamento = getMensagemPersonalizada(config, 'pagamento', medico.id);
    
    let mensagem = '';
    let temOrientacoes = false;
    
    if (msgConfirmacao) {
      // Usar mensagem personalizada do banco
      mensagem = `✅ ${msgConfirmacao}`;
    } else {
      // 🆕 Mensagem diferenciada por tipo de agendamento
      if (isEstimativaHorario(tipoEfetivoSchedule)) {
        const mensagemEst = getMensagemEstimativa(servicoConfigSchedule, null);
        mensagem = `✅ Consulta agendada para ${paciente_nome} em ${dataFormatada} por volta das ${horaFormatada}.\n\n⏰ ${mensagemEst}`;
      } else if (isOrdemChegada(tipoEfetivoSchedule)) {
        // Determinar período e horário baseado na hora do agendamento
        let periodoNomeConf = '';
        let periodoHorarioConf = '';
        
        // Buscar config do período para informações detalhadas
        let atendimentoInicioConf = '';
        
        if (regrasMedicoSchedule?.servicos) {
          const servicoAtualRaw = servicoConfigSchedule || Object.values(regrasMedicoSchedule.servicos)[0];
          const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
          
          // 1️⃣ BUSCAR PREFIXO PERSONALIZADO (ou usar padrão)
          const prefixoMensagem = servicoAtual?.prefixo_mensagem || 'Consulta agendada';
          
          if (servicoAtual?.periodos) {
            // 2️⃣ NORMALIZAR CAMPOS (aceitar ambas nomenclaturas)
            if (servicoAtual.periodos.manha) {
              const manha = servicoAtual.periodos.manha;
              const horaInicioM = manha.inicio || manha.horario_inicio;
              const horaFimM = manha.fim || manha.horario_fim;
              
              if (horaInicioM && horaFimM) {
                const [hInicioM] = horaInicioM.split(':').map(Number);
                const [hFimM] = horaFimM.split(':').map(Number);
                if (hora >= hInicioM && hora < hFimM) {
                  periodoNomeConf = 'manhã';
                  // 3️⃣ PRIORIZAR distribuicao_fichas para horário do paciente
                  periodoHorarioConf = manha.distribuicao_fichas || 
                                       `${horaInicioM.substring(0,5)} às ${horaFimM.substring(0,5)}`;
                  // 4️⃣ CAPTURAR atendimento_inicio
                  atendimentoInicioConf = manha.atendimento_inicio || '';
                }
              }
            }
            if (!periodoNomeConf && servicoAtual.periodos.tarde) {
              const tarde = servicoAtual.periodos.tarde;
              const horaInicioT = tarde.inicio || tarde.horario_inicio;
              const horaFimT = tarde.fim || tarde.horario_fim;
              
              if (horaInicioT && horaFimT) {
                const [hInicioT] = horaInicioT.split(':').map(Number);
                const [hFimT] = horaFimT.split(':').map(Number);
                if (hora >= hInicioT && hora < hFimT) {
                  periodoNomeConf = 'tarde';
                  // 3️⃣ PRIORIZAR distribuicao_fichas para horário do paciente
                  periodoHorarioConf = tarde.distribuicao_fichas || 
                                       `${horaInicioT.substring(0,5)} às ${horaFimT.substring(0,5)}`;
                  // 4️⃣ CAPTURAR atendimento_inicio
                  atendimentoInicioConf = tarde.atendimento_inicio || '';
                }
              }
            }
          }
        }
        
        // Mensagem com período detalhado - usar prefixo configurável
        const prefixoFinal = (regrasMedicoSchedule?.servicos) 
          ? (normalizarServicoPeriodos(servicoConfigSchedule || Object.values(regrasMedicoSchedule.servicos)[0])?.prefixo_mensagem || 'Consulta agendada')
          : 'Consulta agendada';
        
        if (!mensagem && periodoNomeConf && periodoHorarioConf) {
          if (atendimentoInicioConf) {
            mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}). Dr. começa a atender às ${atendimentoInicioConf}, por ordem de chegada.`;
          } else {
            mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} no período da ${periodoNomeConf} (${periodoHorarioConf}), por ordem de chegada.`;
          }
        } else if (!mensagem) {
          // Fallback simples se não encontrar config
          mensagem = `✅ ${prefixoFinal} para ${paciente_nome} em ${dataFormatada} por ordem de chegada.`;
        }
        
        // 5️⃣ ANEXAR ORIENTAÇÕES DO SERVIÇO (se existirem)
        if (regrasMedicoSchedule?.servicos) {
          const servicoAtualRaw = servicoConfigSchedule || Object.values(regrasMedicoSchedule.servicos)[0];
          const servicoAtual = normalizarServicoPeriodos(servicoAtualRaw);
          if (servicoAtual?.orientacoes) {
            mensagem += `\n\n${servicoAtual.orientacoes}`;
            temOrientacoes = true;
          }
        }
      } else {
        // Hora marcada
        mensagem = `✅ Consulta agendada para ${paciente_nome} em ${dataFormatada} às ${horaFormatada}.`;
      }
    }
    
    // Adicionar informação de período baseado na hora
    let periodoInfo = '';
    if (hora >= 7 && hora < 12) {
      periodoInfo = 'manhã';
    } else if (hora >= 13 && hora < 18) {
      periodoInfo = 'tarde';
    }
    
    // Adicionar mensagem de pagamento se existir
    if (msgPagamento) {
      mensagem += `\n\n💰 ${msgPagamento}`;
    }
    
    // Só adicionar "Posso ajudar..." se NÃO tiver orientações anexadas
    if (!temOrientacoes) {
      mensagem += `\n\nPosso ajudar em algo mais?`;
    }
    
    console.log(`💬 Mensagem de confirmação: ${msgConfirmacao ? 'personalizada do banco' : 'genérica por tipo'}`);
    console.log(`💬 Tipo agendamento: ${tipoEfetivoSchedule}`);
    console.log(`💬 Mensagem de pagamento: ${msgPagamento ? 'personalizada do banco' : 'não configurada'}`);

    return successResponse({
      message: mensagem,
      agendamento_id: result.agendamento_id,
      paciente_id: result.paciente_id,
      medico: medico.nome,
      data: data_consulta,
      hora: hora_consulta,
      validado: true,
      confirmacao_criado: true
    });

  } catch (error: any) {
    return errorResponse(`Erro ao processar agendamento: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Listar agendamentos de um médico em uma data específica
