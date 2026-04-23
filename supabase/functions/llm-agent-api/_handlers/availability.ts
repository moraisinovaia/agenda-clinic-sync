import {
  CheckAvailabilityUseCase,
  SupabaseAppointmentRepository,
  SupabaseScheduleRepository,
  DynamicConfigBusinessRulesRepository,
} from '../../_shared/scheduling-core/index.ts'
import type { DynamicConfig } from '../_lib/types.ts'
import { successResponse, businessErrorResponse } from '../_lib/responses.ts'
import { getRequestScope, isDoctorAllowed, isServiceAllowed, filterDoctorsByScope, getDoctorScopeSummary, hasDoctorScope } from '../_lib/scope.ts'
import { getMedicoRules, getMensagemPersonalizada, getClinicPhone, getMinimumBookingDate, calcularVagasDisponiveisComLimites } from '../_lib/limites.ts'
import { BUSINESS_RULES } from '../_lib/tipo-agendamento.ts'
import { normalizarServicoPeriodos, buscarAgendaDedicada } from '../_lib/config.ts'
import { sanitizarCampoOpcional, getDiaSemana } from '../_lib/normalizacao.ts'
import { getTipoAgendamentoEfetivo, isOrdemChegada, isEstimativaHorario, getIntervaloMinutos, getMensagemEstimativa, formatarHorarioParaExibicao, getDataHoraAtualBrasil, filtrarPeriodosPassados, classificarPeriodoAgendamento, buscarProximasDatasDisponiveis, TIPO_ORDEM_CHEGADA, TIPO_ESTIMATIVA_HORARIO } from '../_lib/tipo-agendamento.ts'
import { fuzzyMatchMedicos } from '../_lib/fuzzy-match.ts'

export async function handleAvailability(supabase: any, body: any, clienteId: string, config: DynamicConfig | null) {
  try {
    const scope = getRequestScope(body);
    console.log('📅 [AVAILABILITY] Dados recebidos:', {
      keys: Object.keys(body || {}),
      doctor_scope_count: scope.doctorIds.length,
      has_medico_nome: !!body?.medico_nome,
      has_medico_id: !!body?.medico_id,
      has_data_consulta: !!body?.data_consulta,
      has_atendimento_nome: !!body?.atendimento_nome,
      has_mensagem_original: !!body?.mensagem_original,
      dias_busca: body?.dias_busca ?? null,
      quantidade_dias: body?.quantidade_dias ?? null,
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
    
    let { medico_nome, medico_id, data_consulta, atendimento_nome, dias_busca = 14, mensagem_original, buscar_proximas = false, quantidade_dias = 7 } = body;
    
    // 🆕 SANITIZAÇÃO ROBUSTA: Converter valores inválidos em undefined
    data_consulta = sanitizarCampoOpcional(data_consulta);
    medico_nome = sanitizarCampoOpcional(medico_nome);
    medico_id = sanitizarCampoOpcional(medico_id);
    atendimento_nome = sanitizarCampoOpcional(atendimento_nome);
    
    // 🆕 DETECTAR PERÍODO SOLICITADO: Extrair período da mensagem original
    let periodo_solicitado = null;
    if (mensagem_original) {
      const msg = mensagem_original.toLowerCase();
      if (msg.includes('manhã') || msg.includes('manha')) {
        periodo_solicitado = 'manha';
      } else if (msg.includes('tarde')) {
        periodo_solicitado = 'tarde';
      } else if (msg.includes('noite')) {
        periodo_solicitado = 'noite';
      }
    }
    console.log(`🕐 Período solicitado pelo usuário: ${periodo_solicitado || 'não especificado'}`);
    
    // 🆕 DETECÇÃO DE DADOS INVERTIDOS: Verificar se medico_nome contém data ou se data_consulta contém nome
    if (data_consulta && typeof data_consulta === 'string') {
      // Se data_consulta contém "|" ou nome de médico, está invertido
      if (data_consulta.includes('|') || /[a-zA-Z]{3,}/.test(data_consulta)) {
        console.warn('⚠️ DADOS INVERTIDOS DETECTADOS! Tentando corrigir...');
        console.log('Antes:', { medico_nome, atendimento_nome, data_consulta });
        
        // Tentar extrair informações do campo invertido
        const partes = data_consulta.split('|');
        if (partes.length === 2) {
          // Formato: "Dra Adriana|05/01/2026"
          const possivelMedico = partes[0].trim();
          const possivelData = partes[1].trim();
          
          // Realocar corretamente
          if (!medico_nome || medico_nome === 'Consulta') {
            medico_nome = possivelMedico;
          }
          
          // Converter data DD/MM/YYYY para YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(possivelData)) {
            const [dia, mes, ano] = possivelData.split('/');
            data_consulta = `${ano}-${mes}-${dia}`;
          }
        }
        
        console.log('Depois:', { medico_nome, atendimento_nome, data_consulta });
      }
    }
    
    // 🆕 CONVERTER FORMATO DE DATA: DD/MM/YYYY → YYYY-MM-DD
    if (data_consulta && /^\d{2}\/\d{2}\/\d{4}$/.test(data_consulta)) {
      const [dia, mes, ano] = data_consulta.split('/');
      data_consulta = `${ano}-${mes}-${dia}`;
      console.log(`📅 Data convertida: DD/MM/YYYY → YYYY-MM-DD: ${data_consulta}`);
    }
    
    // 📅 VALIDAÇÃO DE FORMATO
    if (data_consulta) {
      // Validar formato YYYY-MM-DD (após conversão)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data_consulta)) {
        return businessErrorResponse({
          codigo_erro: 'FORMATO_DATA_INVALIDO',
          mensagem_usuario: `❌ Formato de data inválido: "${data_consulta}"\n\n✅ Formatos aceitos:\n   • YYYY-MM-DD (ex: 2026-01-20)\n   • DD/MM/YYYY (ex: 20/01/2026)\n\n💡 Por favor, informe a data no formato correto.`,
          detalhes: {
            data_informada: data_consulta,
            formatos_aceitos: ['YYYY-MM-DD', 'DD/MM/YYYY']
          }
        });
      }
    }
    
    // ✅ LÓGICA INTELIGENTE: Se for noite, buscar a partir de AMANHÃ
    const { data: dataAtual, hora: horaAtual, horarioEmMinutos: horarioAtualEmMinutos } = getDataHoraAtualBrasil();

    // Variáveis para controle de migração e data original
    let mensagemEspecial = null;
    let data_consulta_original = data_consulta;

    if (!data_consulta) {
      // Se for depois das 18h, começar a busca de AMANHÃ
      if (horaAtual >= 18) {
        const amanha = new Date(dataAtual + 'T00:00:00');
        amanha.setDate(amanha.getDate() + 1);
        data_consulta = amanha.toISOString().split('T')[0];
        console.log(`🌙 Horário noturno (${horaAtual}h). Buscando a partir de AMANHÃ: ${data_consulta}`);
      } else {
        data_consulta = dataAtual;
        console.log(`📅 Buscando a partir de HOJE: ${data_consulta} (${horaAtual}h)`);
      }
    } else {
      // Verificar se está no passado (comparar com data de São Paulo)
      const dataConsulta = new Date(data_consulta + 'T00:00:00');
      const hoje = new Date(dataAtual + 'T00:00:00');
      
      
      // Calcular diferença em dias entre data solicitada e hoje
      const diferencaDias = Math.floor((hoje.getTime() - dataConsulta.getTime()) / (1000 * 60 * 60 * 24));
      
      // 🚫 CORREÇÃO: Bloquear TODAS as datas passadas (não apenas >90 dias)
      if (dataConsulta < hoje) {
        console.log(`🚫 Data solicitada (${data_consulta}) está no passado (${diferencaDias} dias). Ajustando...`);
        
        // Se for horário noturno, começar de amanhã
        if (horaAtual >= 18) {
          const amanha = new Date(dataAtual + 'T00:00:00');
          amanha.setDate(amanha.getDate() + 1);
          data_consulta = amanha.toISOString().split('T')[0];
          console.log(`🌙 Horário noturno (${horaAtual}h). Buscando a partir de AMANHÃ: ${data_consulta}`);
        } else {
          data_consulta = dataAtual;
          console.log(`📅 Ajustado para HOJE: ${data_consulta}`);
        }
      } else {
        console.log(`📅 Ponto de partida da busca: ${data_consulta} (data futura fornecida pelo usuário)`);
      }
    }
    
    console.log('✅ [SANITIZADO] Dados processados:', { 
      medico_nome, 
      medico_id, 
      data_consulta, 
      atendimento_nome, 
      dias_busca 
    });

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
    
    // 💬 LOGGING: Mensagem original do paciente (se fornecida)
    if (mensagem_original) {
      console.log('💬 Mensagem original do paciente:', mensagem_original);
    }
    
    // ✅ Validar campos obrigatórios
    if (!atendimento_nome || atendimento_nome.trim() === '') {
      return businessErrorResponse({
        codigo_erro: 'CAMPO_OBRIGATORIO',
        mensagem_usuario: '❌ É necessário informar o tipo de atendimento.\n\n📋 Exemplos:\n   • Consulta Cardiológica\n   • Colonoscopia\n   • Endoscopia\n\n💡 Informe o nome do exame ou consulta desejada.',
        detalhes: {
          campo_faltando: 'atendimento_nome'
        }
      });
    }
    
    if (!medico_nome && !medico_id) {
      return businessErrorResponse({
        codigo_erro: 'CAMPO_OBRIGATORIO',
        mensagem_usuario: '❌ É necessário informar o médico.\n\n📋 Você pode informar:\n   • Nome do médico (medico_nome)\n   • ID do médico (medico_id)\n\n💡 Escolha qual médico deseja consultar.',
        detalhes: {
          campo_faltando: 'medico_nome ou medico_id'
        }
      });
    }
    
    // 🔍 Buscar médico COM busca inteligente (aceita nomes parciais) - MOVIDO PARA ANTES DE USAR
    let medico;
    if (medico_id) {
      // Busca por ID (exata)
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
        console.error(`❌ Médico ID não encontrado: ${medico_id}`, error);
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico com ID "${medico_id}" não foi encontrado ou está inativo.\n\n💡 Verifique se o código do médico está correto.`,
          detalhes: { medico_id }
        });
      }
      console.log(`✅ Médico encontrado por ID: ${medico.nome}`);
      
    } else {
      // 🔍 BUSCA SUPER INTELIGENTE POR NOME:
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      
      // Buscar TODOS os médicos ativos
      const { data: todosMedicos, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo, crm, rqe')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      
      if (error) {
        console.error('❌ Erro ao buscar médicos:', error);
        return businessErrorResponse({
          codigo_erro: 'ERRO_BUSCA_MEDICOS',
          mensagem_usuario: '❌ Não foi possível buscar os médicos disponíveis no momento.\n\n📞 Por favor, tente novamente em alguns instantes ou entre em contato com a clínica.',
          detalhes: { erro_tecnico: error.message }
        });
      }
      
      if (!todosMedicos || todosMedicos.length === 0) {
        return businessErrorResponse({
          codigo_erro: 'NENHUM_MEDICO_ATIVO',
          mensagem_usuario: '❌ Não há médicos ativos cadastrados no sistema no momento.\n\n📞 Por favor, entre em contato com a clínica para mais informações.',
          detalhes: {}
        });
      }

      const medicosDentroDoEscopo = filterDoctorsByScope(todosMedicos, scope);

      if (hasDoctorScope(scope) && medicosDentroDoEscopo.length === 0) {
        return businessErrorResponse({
          codigo_erro: 'ESCOPO_SEM_MEDICOS',
          mensagem_usuario: `❌ Este canal não possui médicos autorizados para consulta de disponibilidade.\n\nEscopo atual: ${getDoctorScopeSummary(scope)}.`,
          detalhes: {
            doctor_scope_ids: scope.doctorIds,
            doctor_scope_names: scope.doctorNames
          }
        });
      }
      
      // Matching inteligente com fuzzy fallback
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      const medicosEncontrados = fuzzyMatchMedicos(medico_nome, medicosDentroDoEscopo);
      
      if (medicosEncontrados.length === 0) {
        console.error(`❌ Nenhum médico encontrado para: "${medico_nome}"`);
        const sugestoes = medicosDentroDoEscopo.map(m => m.nome).slice(0, 10);
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico "${medico_nome}" não encontrado.\n\n✅ Médicos disponíveis:\n${sugestoes.map(m => `   • ${m}`).join('\n')}\n\n💡 Escolha um dos médicos disponíveis acima.`,
          detalhes: {
            medico_solicitado: medico_nome,
            medicos_disponiveis: sugestoes
          }
        });
      }
      
      if (medicosEncontrados.length > 1) {
        console.warn(`⚠️ Múltiplos médicos encontrados para "${medico_nome}":`, 
          medicosEncontrados.map(m => m.nome).join(', '));
      }
      
      medico = medicosEncontrados[0];
      console.log(`✅ Médico encontrado: "${medico_nome}" → "${medico.nome}"`);
    }
    
    // 🆕 VERIFICAR AGENDA DEDICADA PARA O SERVIÇO
    // Se o serviço solicitado tem uma agenda virtual separada (ex: "Teste Ergométrico - Dr. Marcelo"), usar ela
    if (atendimento_nome && medico) {
      const agendaDedicada = await buscarAgendaDedicada(
        supabase, 
        clienteId, 
        medico.nome, 
        atendimento_nome
      );
      
      if (agendaDedicada) {
        console.log(`🔄 [REDIRECIONAR] Usando agenda dedicada "${agendaDedicada.nome}" (ID: ${agendaDedicada.id}) ao invés de "${medico.nome}"`);
        
        // Atualizar medico para a agenda dedicada
        // A agenda dedicada contém todas as configurações necessárias
        medico = {
          id: agendaDedicada.id,
          nome: agendaDedicada.nome,
          ativo: true
        };
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
    
    // 🔍 BUSCAR REGRAS DE NEGÓCIO E CONFIGURAÇÃO DO SERVIÇO (declarar uma única vez)
    let regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    
    // Normalizar nome do atendimento para matching (remover espaços, underscores, acentos)
    const normalizarParaMatch = (texto: string) => 
      texto.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[_\s-]+/g, '') // Remove underscores, espaços e hífens
        .trim();
    
    const atendimentoNormalizado = normalizarParaMatch(atendimento_nome);
    
    // 🔍 MATCHING MELHORADO: Priorizar match exato antes de parcial
    const servicosKeys = Object.keys(regras?.servicos || {});
    
    // 1. Primeiro tentar match exato
    let servicoKey = servicosKeys.find(s => {
      const keyNormalizada = normalizarParaMatch(s);
      const nomeServico = regras?.servicos[s]?.nome;
      const nomeNormalizado = nomeServico ? normalizarParaMatch(nomeServico) : '';
      
      // Match exato (prioridade alta)
      return keyNormalizada === atendimentoNormalizado ||
             nomeNormalizado === atendimentoNormalizado;
    });
    
    // 2. Se não encontrou exato, tentar match parcial (mas preferir o que mais se aproxima)
    if (!servicoKey) {
      // Ordenar por similaridade: quem tiver mais caracteres em comum vence
      const matchesParciais = servicosKeys.map(s => {
        const keyNormalizada = normalizarParaMatch(s);
        const nomeServico = regras?.servicos[s]?.nome;
        const nomeNormalizado = nomeServico ? normalizarParaMatch(nomeServico) : '';
        
        // Calcular score: match exato = 100, contains = tamanho do match
        let score = 0;
        if (keyNormalizada.includes(atendimentoNormalizado)) score = atendimentoNormalizado.length;
        if (atendimentoNormalizado.includes(keyNormalizada)) score = Math.max(score, keyNormalizada.length);
        if (nomeNormalizado.includes(atendimentoNormalizado)) score = Math.max(score, atendimentoNormalizado.length);
        if (atendimentoNormalizado.includes(nomeNormalizado) && nomeNormalizado) score = Math.max(score, nomeNormalizado.length);
        
        return { key: s, score };
      }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);
      
      if (matchesParciais.length > 0) {
        servicoKey = matchesParciais[0].key;
        console.log(`🔍 Match parcial selecionado: "${servicoKey}" (score: ${matchesParciais[0].score})`);
      }
    }
    let servico = servicoKey ? normalizarServicoPeriodos(regras.servicos[servicoKey]) : null;
    
    // 🔄 FALLBACK: Se serviço não encontrado e médico é ordem_chegada, usar períodos de qualquer serviço configurado
    if (!servico && regras?.tipo_agendamento === 'ordem_chegada' && regras?.servicos) {
      const primeiroServicoComPeriodos = Object.values(regras.servicos)
        .find((s: any) => s?.periodos && Object.keys(s.periodos).length > 0);
      
      if (primeiroServicoComPeriodos) {
        servico = normalizarServicoPeriodos(primeiroServicoComPeriodos as any);
        console.log(`🔄 [FALLBACK] Serviço "${atendimento_nome}" não encontrado. Usando períodos de outro serviço configurado para ordem de chegada.`);
      }
    }
    
    // Não retornar erro ainda - busca melhorada será feita depois se necessário
    
    const tipoAtendimento = servico?.tipo || regras?.tipo_agendamento || 'ordem_chegada';
    console.log(`📋 [${medico.nome}] Tipo: ${tipoAtendimento} | Serviço: ${servicoKey || 'não encontrado ainda'} (busca: "${atendimento_nome}")`);
    if (servicoKey && servico) {
      console.log(`📋 [SERVICO] compartilha_limite_com: ${servico.compartilha_limite_com || 'N/A'}, limite_proprio: ${servico.limite_proprio || 'N/A'}`);
    }
    
    // 🧠 ANÁLISE DE CONTEXTO: Usar mensagem original para inferir intenção
    let isPerguntaAberta = false;
    let periodoPreferido: 'manha' | 'tarde' | null = null;
    let diaPreferido: number | null = null; // 1=seg, 2=ter, 3=qua, 4=qui, 5=sex
    
    // 🆕 CONTEXTO PARA DATA INVÁLIDA (usado quando dia da semana não é permitido)
    let dataInvalidaOriginal: string | null = null;
    let diaNomeInvalido: string | null = null;
    
    if (mensagem_original) {
      const mensagemLower = mensagem_original.toLowerCase();
      
      // 🆕 RECONHECER SINÔNIMOS DE AGENDAMENTO
      const sinonimosAgendamento = [
        'retorno', 'remarcar', 'reagendar', 'voltar', 'retornar',
        'nova consulta', 'outra consulta', 'consulta de novo',
        'marcar de novo', 'segunda vez', 'consulta de volta'
      ];
      
      const ehSinonimo = sinonimosAgendamento.some(sin => mensagemLower.includes(sin));
      
      // Detectar se é pergunta aberta ("quando tem vaga?")
      isPerguntaAberta = 
        ehSinonimo ||  // 🆕 Incluir sinônimos
        mensagemLower.includes('quando') ||
        mensagemLower.includes('próxima') ||
        mensagemLower.includes('proxima') ||
        mensagemLower.includes('disponível') ||
        mensagemLower.includes('disponivel');
      
      if (ehSinonimo) {
        console.log('🔄 Sinônimo de agendamento detectado:', mensagem_original);
      }
      
      // 🆕 DETECTAR PERÍODO PREFERIDO
      if (mensagemLower.includes('tarde') || mensagemLower.includes('tade')) {
        periodoPreferido = 'tarde';
        console.log('🌙 Paciente solicitou especificamente período da TARDE');
      } else if (mensagemLower.includes('manhã') || mensagemLower.includes('manha')) {
        periodoPreferido = 'manha';
        console.log('☀️ Paciente solicitou especificamente período da MANHÃ');
      }
      
      // 🆕 DETECTAR DIA DA SEMANA PREFERIDO
      const diasMap: Record<string, number> = {
        'segunda': 1, 'seg': 1, 'segunda-feira': 1, 'segundafeira': 1,
        'terça': 2, 'terca': 2, 'ter': 2, 'terça-feira': 2, 'tercafeira': 2,
        'quarta': 3, 'qua': 3, 'quarta-feira': 3, 'quartafeira': 3,
        'quinta': 4, 'qui': 4, 'quinta-feira': 4, 'quintafeira': 4,
        'sexta': 5, 'sex': 5, 'sexta-feira': 5, 'sextafeira': 5
      };

      for (const [nome, numero] of Object.entries(diasMap)) {
        if (mensagemLower.includes(nome)) {
          diaPreferido = numero;
          console.log(`📅 Dia da semana específico detectado: ${nome} (${numero})`);
          break;
        }
      }

      if (diaPreferido) {
        console.log(`🗓️ Dia preferido: ${diaPreferido}. Filtrando apenas esse dia da semana.`);
      }
      
      // 🆕 EXTRAIR REFERÊNCIA A MÊS na mensagem original
      let mesEspecifico: string | null = null;
      const mesesMap: Record<string, string> = {
        'janeiro': '01', 'jan': '01',
        'fevereiro': '02', 'fev': '02',
        'março': '03', 'mar': '03', 'marco': '03',
        'abril': '04', 'abr': '04',
        'maio': '05', 'mai': '05',
        'junho': '06', 'jun': '06',
        'julho': '07', 'jul': '07',
        'agosto': '08', 'ago': '08',
        'setembro': '09', 'set': '09',
        'outubro': '10', 'out': '10',
        'novembro': '11', 'nov': '11',
        'dezembro': '12', 'dez': '12'
      };
      
      for (const [nome, numero] of Object.entries(mesesMap)) {
        if (mensagemLower.includes(nome)) {
          mesEspecifico = numero;
          console.log(`📆 Mês específico detectado na mensagem: ${nome} (${numero})`);
          
          // Se data_consulta não foi fornecida mas mês foi mencionado, construir primeira data do mês
          if (!data_consulta) {
            const anoAtual = new Date().getFullYear();
            const mesAtual = new Date().getMonth() + 1;
            const anoAlvo = parseInt(numero) < mesAtual ? anoAtual + 1 : anoAtual;
            data_consulta = `${anoAlvo}-${numero}-01`;
            console.log(`🗓️ Construída data inicial do mês: ${data_consulta}`);
          }
          break;
        }
      }
      
      // Só anular data_consulta se for pergunta REALMENTE aberta (sem contexto de mês/data)
      if (isPerguntaAberta && !data_consulta && !mesEspecifico) {
        console.log('🔍 Pergunta aberta sem data específica detectada. Buscando próximas disponibilidades a partir de hoje.');
        // data_consulta permanece null, usará hoje como base
      } else if (data_consulta) {
        console.log(`📅 Data específica fornecida: ${data_consulta}. Respeitando como ponto de partida da busca.`);
        // data_consulta mantida, será usada como dataInicial
      }

      if (periodoPreferido) {
        console.log(`⏰ Período preferido detectado: ${periodoPreferido}. Mantendo compatibilidade com data fornecida.`);
        // Não anular data_consulta - período + data são compatíveis
      }
    }
    
    // 🆕 AJUSTAR QUANTIDADE DE DIAS quando houver período específico
    if (periodoPreferido && quantidade_dias < 14) {
      quantidade_dias = 14; // Buscar mais dias para encontrar o período correto
      console.log(`🔍 Ampliando busca para ${quantidade_dias} dias devido ao período específico: ${periodoPreferido}`);
    }
    
    // 🆕 AMPLIAR também quando houver dia específico
    if (diaPreferido && quantidade_dias < 21) {
      quantidade_dias = 21; // 3 semanas para garantir 3 ocorrências do dia
      console.log(`🔍 Ampliando busca para ${quantidade_dias} dias devido ao dia específico`);
    }
    
    // 🆕 BUSCAR PRÓXIMAS DATAS DISPONÍVEIS (quando buscar_proximas = true ou sem data específica)
    if (buscar_proximas || (!data_consulta && mensagem_original)) {
      console.log(`🔍 Buscando próximas ${quantidade_dias} datas disponíveis...`);
      if (periodoPreferido) console.log(`  → Filtro: período ${periodoPreferido}`);
      if (diaPreferido) console.log(`  → Filtro: dia da semana ${diaPreferido}`);
      
      const proximasDatas: Array<{
        data: string;
        dia_semana: string;
        periodos: Array<{
          periodo: string;
          horario_distribuicao: string;
          vagas_disponiveis: number;
          limite_total: number;
          tipo: string;
        }>;
      }> = [];
      
      // Se data_consulta foi fornecida, usar como ponto de partida
      // Caso contrário, usar data atual
      const { data: dataAtualBrasil } = getDataHoraAtualBrasil();
      const dataInicial = data_consulta || dataAtualBrasil;

      console.log(`📅 Ponto de partida da busca: ${dataInicial} ${data_consulta ? '(fornecida pelo usuário)' : '(data atual)'}`);
      
      // 🆕 VERIFICAR ORDEM_CHEGADA_CONFIG: Se médico tem config especial para ordem de chegada
      const ordemChegadaConfig = regras?.ordem_chegada_config;
      if (ordemChegadaConfig) {
        console.log('🎫 [ORDEM_CHEGADA_CONFIG] Config especial detectada:', ordemChegadaConfig);
      }
      
      // 🎫 LÓGICA PARA ORDEM DE CHEGADA (todos os médicos)
      console.log('🎫 Buscando períodos disponíveis (ordem de chegada)...');

      const hasSharedLimits = !!(servicoKey && servico && (servico.compartilha_limite_com || servico.limite_proprio));

      if (hasSharedLimits) {
        // 🔒 Rota especial: serviços com limites compartilhados/sublimites (bypass use case)
        for (let diasAdiantados = 0; diasAdiantados <= quantidade_dias; diasAdiantados++) {
          const dataCheck = new Date(dataInicial + 'T00:00:00');
          dataCheck.setDate(dataCheck.getDate() + diasAdiantados);
          const dataCheckStr = dataCheck.toISOString().split('T')[0];
          const diaSemanaNum = dataCheck.getDay();

          // Pular finais de semana
          if (diaSemanaNum === 0 || diaSemanaNum === 6) continue;

          // Filtrar por dia da semana preferido
          if (diaPreferido && diaSemanaNum !== diaPreferido) continue;

          // Verificar se dia permitido pelo serviço
          if (servico?.dias_semana && !servico.dias_semana.includes(diaSemanaNum)) continue;

          // Calcular vagas com limites compartilhados/sublimites
          const vagasComLimites = await calcularVagasDisponiveisComLimites(
            supabase,
            clienteId,
            medico.id,
            dataCheckStr,
            servicoKey,
            servico,
            regras
          );

          if (vagasComLimites <= 0) {
            console.log(`⏭️ Pulando ${dataCheckStr} - limites compartilhados/sublimite atingidos`);
            continue;
          }

          const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          proximasDatas.push({
            data: dataCheckStr,
            dia_semana: diasSemana[diaSemanaNum],
            periodos: [{
              periodo: 'Manhã',
              horario_distribuicao: '07:00 às 12:00',
              vagas_disponiveis: vagasComLimites,
              limite_total: servico.limite_proprio || 1,
              tipo: servico.tipo_agendamento || 'hora_marcada'
            }]
          });

          const datasNecessarias = periodoPreferido ? 5 : 3;
          if (proximasDatas.length >= datasNecessarias) break;
        }
      } else {
        // 🆕 Rota normal: usar CheckAvailabilityUseCase via ScheduleRepository
        const { diasDisponiveis } = await new CheckAvailabilityUseCase(
          new SupabaseAppointmentRepository(supabase),
          new SupabaseScheduleRepository(
            new DynamicConfigBusinessRulesRepository(config)
          ),
        ).execute({
          medicoId: medico.id,
          clienteId,
          dataInicio: dataInicial,
          quantidadeDias: quantidade_dias,
          periodoPreferido,
          diaPreferido,
          servicoKey: servicoKey ?? undefined,
          minimumDate: getMinimumBookingDate(config),
          datasNecessarias: periodoPreferido ? 5 : 3,
        });

        // Adapter mapeia domínio → formato de apresentação do canal
        const DIA_SEMANA_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const PERIODO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' };
        const BOOKING_MODE_LEGADO: Record<string, string> = { capacity_window: 'ordem_chegada', time_slot: 'hora_marcada' };

        for (const day of diasDisponiveis) {
          proximasDatas.push({
            data: day.date,
            dia_semana: DIA_SEMANA_PT[day.weekday],
            periodos: day.windows.map(w => {
              const horarioDistribuicao = ordemChegadaConfig
                ? `${ordemChegadaConfig.hora_chegada_inicio} às ${ordemChegadaConfig.hora_chegada_fim}`
                : (servico?.periodos?.[w.periodKey]?.distribuicao_fichas ?? `${w.start} às ${w.end}`);

              return {
                periodo: PERIODO_LABEL[w.periodKey] ?? w.periodKey,
                horario_distribuicao: horarioDistribuicao,
                vagas_disponiveis: w.available,
                limite_total: w.capacity,
                tipo: BOOKING_MODE_LEGADO[w.bookingMode] ?? w.bookingMode,
                mensagem_ordem_chegada: ordemChegadaConfig?.mensagem ?? null,
                hora_atendimento_inicio: ordemChegadaConfig?.hora_atendimento_inicio ?? null,
              };
            }),
          });
        }

        console.log(`📊 CheckAvailabilityUseCase: ${diasDisponiveis.length} datas encontradas`);
      }
      
      // 🔄 RETRY AUTOMÁTICO: Se não encontrou vagas e ainda não buscou 100 dias, ampliar
      if (proximasDatas.length === 0 && quantidade_dias < 100) {
        console.log(`⚠️ Nenhuma data encontrada em ${quantidade_dias} dias. Ampliando busca para 100 dias...`);
        quantidade_dias = 100;
        
        // 🔁 REPETIR O LOOP DE BUSCA com 45 dias
        for (let diasAdiantados = 0; diasAdiantados <= quantidade_dias; diasAdiantados++) {
          const dataCheck = new Date(dataInicial + 'T00:00:00');
          dataCheck.setDate(dataCheck.getDate() + diasAdiantados);
          const dataCheckStr = dataCheck.toISOString().split('T')[0];
          const diaSemanaNum = dataCheck.getDay();
          
          // Pular finais de semana
          if (diaSemanaNum === 0 || diaSemanaNum === 6) continue;
          
          // 🗓️ Filtrar por dia da semana preferido
          if (diaPreferido && diaSemanaNum !== diaPreferido) {
            continue; // Pular dias que não correspondem ao preferido
          }
          
          // 🔒 Verificar bloqueios
          const { data: bloqueiosData } = await supabase
            .from('bloqueios_agenda')
            .select('id')
            .eq('medico_id', medico.id)
            .lte('data_inicio', dataCheckStr)
            .gte('data_fim', dataCheckStr)
            .eq('status', 'ativo')
            .eq('cliente_id', clienteId);
          
          if (bloqueiosData && bloqueiosData.length > 0) {
            console.log(`⏭️ Pulando ${dataCheckStr} (bloqueada)`);
            continue;
          }
          
          // Contar agendamentos para este dia
          const { count: totalAgendamentos } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', dataCheckStr)
            .neq('status', 'cancelado')
            .eq('cliente_id', clienteId);
          
          const periodosDisponiveis = [];
          
          for (const [periodo, config] of Object.entries(servico?.periodos || {})) {
            if (periodoPreferido && periodo !== periodoPreferido) continue;
            
            const limite = (config as any).limite || 9;
            const { count: agendadosPeriodo } = await supabase
              .from('agendamentos')
              .select('*', { count: 'exact', head: true })
              .eq('medico_id', medico.id)
              .eq('data_agendamento', dataCheckStr)
              .gte('hora_agendamento', (config as any).inicio)
              .lt('hora_agendamento', (config as any).fim)
              .neq('status', 'cancelado')
              .eq('cliente_id', clienteId);
            
            const vagasDisponiveis = limite - (agendadosPeriodo || 0);
            
            if (vagasDisponiveis > 0) {
              periodosDisponiveis.push({
                periodo: periodo.charAt(0).toUpperCase() + periodo.slice(1),
                horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
                vagas_disponiveis: vagasDisponiveis,
                limite_total: limite,
                tipo: tipoAtendimento
              });
            }
          }
          
          if (periodosDisponiveis.length > 0) {
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            proximasDatas.push({
              data: dataCheckStr,
              dia_semana: diasSemana[diaSemanaNum],
              periodos: periodosDisponiveis
            });
            
            const datasNecessarias = periodoPreferido ? 5 : 3;
            if (proximasDatas.length >= datasNecessarias) break;
          }
        }
        
        console.log(`📊 Após ampliação: ${proximasDatas.length} datas encontradas`);
      }
      
      // 🕐 FILTRAR PERÍODOS DO DIA ATUAL QUE JÁ PASSARAM
      const proximasDatasFiltradas = filtrarPeriodosPassados(proximasDatas);
      const removidos = proximasDatas.length - proximasDatasFiltradas.length;
      if (removidos > 0) {
        console.log(`🕐 [FILTRO] Removidas ${removidos} data(s) com todos os períodos já passados`);
      }
      // Substituir array original pelo filtrado
      proximasDatas.length = 0;
      proximasDatas.push(...proximasDatasFiltradas);

      // 🚫 SE AINDA NÃO ENCONTROU NADA, retornar erro claro
      if (proximasDatas.length === 0) {
        const mensagemSemVagas = 
          `😔 Não encontrei vagas disponíveis para ${medico.nome} nos próximos ${quantidade_dias} dias.\n\n` +
          `📞 Por favor, ligue para ${getClinicPhone(config)} para:\n` +
          `• Entrar na fila de espera\n` +
          `• Verificar outras opções\n` +
          `• Consultar disponibilidade futura`;
        
        console.log(`❌ Nenhuma data disponível mesmo após buscar ${quantidade_dias} dias`);
        
        return successResponse({
          message: mensagemSemVagas,
          medico: medico.nome,
          medico_id: medico.id,
          tipo_atendimento: tipoAtendimento,
          proximas_datas: [],
          sem_vagas: true,  // 🆕 FLAG
          contexto: {
            medico_id: medico.id,
            medico_nome: medico.nome,
            servico: atendimento_nome,
            periodo_solicitado: periodoPreferido,
            dias_buscados: 45
          }
        });
      }
      
      return successResponse({
        message: mensagemEspecial || `${proximasDatas.length} datas disponíveis encontradas`,
        medico: medico.nome,
        medico_id: medico.id,
        tipo_atendimento: 'ordem_chegada',
        proximas_datas: proximasDatas,
        data_solicitada: data_consulta_original || data_consulta,
        contexto: {
          medico_id: medico.id,
          medico_nome: medico.nome,
          servico: atendimento_nome,
          ultima_data_sugerida: proximasDatas[proximasDatas.length - 1]?.data
        }
      });
    }
    
    // Nota: Detecção de pergunta aberta e sinônimos já foi feita acima (linhas 1240-1265)

    // Buscar regras de negócio (reutilizar se já existe)
    console.log(`🔍 Buscando regras para médico ID: ${medico.id}, Nome: ${medico.nome}`);
    if (!regras) regras = getMedicoRules(config, medico.id, BUSINESS_RULES.medicos[medico.id]);
    if (!regras) {
      console.error(`❌ Regras não encontradas para médico ${medico.nome} (ID: ${medico.id})`);
      console.error(`📋 IDs disponíveis nas BUSINESS_RULES:`, Object.keys(BUSINESS_RULES.medicos));
      return businessErrorResponse({
        codigo_erro: 'REGRAS_NAO_CONFIGURADAS',
        mensagem_usuario: `❌ Não foi possível verificar disponibilidade para ${medico.nome}.\n\n📞 Por favor, entre em contato com a clínica para agendar: ${getClinicPhone(config)}`,
        detalhes: {
          medico_id: medico.id,
          medico_nome: medico.nome
        }
      });
    }
    console.log(`✅ Regras encontradas para ${(regras as any)?.nome || medico.nome}`);

    // Buscar serviço nas regras com matching inteligente MELHORADO (só se ainda não encontrado)
    if (!servicoKey) {
      const servicoKeyMelhorado = Object.keys(regras.servicos || {}).find(s => {
      const servicoLower = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
      const atendimentoLower = atendimento_nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // 🆕 Função auxiliar para normalizar removendo plurais e palavras comuns
      const normalizarParaMatch = (texto: string): string[] => {
        // Remove plurais (s no final) e divide em palavras
        const semPlural = texto.replace(/s\s*$/i, '');
        const palavras = semPlural.split(/\s+/).filter(p => p.length > 2); // Ignora palavras muito curtas
        return [texto, semPlural, ...palavras]; // Retorna original, sem plural, e palavras individuais
      };
      
      const servicoVariacoes = normalizarParaMatch(servicoLower);
      const atendimentoVariacoes = normalizarParaMatch(atendimentoLower);
      
      // Match exato (sem acentos)
      if (servicoLower === atendimentoLower) return true;
      
      // Match bidirecional (contém) com variações
      for (const sv of servicoVariacoes) {
        for (const av of atendimentoVariacoes) {
          if (sv.includes(av) || av.includes(sv)) {
            return true;
          }
        }
      }
      
      // 🆕 MELHORADO: Match por keywords com variações de grafia
      const keywords: Record<string, string[]> = {
        'consulta': ['consultas', 'agendamento', 'atendimento'], // Variações de "consulta"
        'endocrinologica': ['endocrino', 'endocrinologia', 'endocrinologista', 'consulta endocrino', 'consulta endocrinologista'],
        'cardiologica': ['cardio', 'cardiologia', 'cardiologista', 'consulta cardio', 'consulta cardiologista'],
        'ergometrico': ['ergo', 'ergometrico', 'teste ergo'],
        'ecocardiograma': ['eco', 'ecocardio'],
        'ultrassom': ['ultra', 'ultrassonografia']
      };
      
      for (const [base, aliases] of Object.entries(keywords)) {
        if (servicoLower.includes(base)) {
          // Verifica se alguma variação do atendimento bate com a base ou aliases
          const matchBase = atendimentoVariacoes.some(av => av.includes(base) || base.includes(av));
          const matchAliases = aliases.some(alias => 
            atendimentoVariacoes.some(av => av.includes(alias) || alias.includes(av))
          );
          if (matchBase || matchAliases) return true;
        }
      }
      
      return false;
    });
    
    // Se encontrou um match melhorado, atualizar servicoKey
    if (servicoKeyMelhorado) {
      servicoKey = servicoKeyMelhorado;
    }
  }
    
    // Logs de debug para matching
    if (servicoKey) {
      console.log(`✅ Match encontrado: "${atendimento_nome}" → "${servicoKey}"`);
    } else {
      console.error(`❌ ERRO: Serviço não encontrado: "${atendimento_nome}"`);
      console.error(`📋 Serviços disponíveis para ${medico.nome}:`, Object.keys(regras.servicos || {}));
      console.error(`🔍 Tentando match com:`, { 
        atendimento_normalizado: atendimento_nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        servicos_normalizados: Object.keys(regras.servicos || {}).map(s => ({
          original: s,
          normalizado: s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        }))
      });
      const servicosDisponiveis = Object.keys(regras.servicos || {}).join(', ');
      return businessErrorResponse({
        codigo_erro: 'SERVICO_NAO_ENCONTRADO',
        mensagem_usuario: `❌ O serviço "${atendimento_nome}" não está disponível para ${medico.nome}.\n\n✅ Serviços disponíveis:\n${Object.keys(regras.servicos || {}).map(s => `   • ${s}`).join('\n')}\n\n💡 Por favor, escolha um dos serviços listados acima.`,
        detalhes: {
          servico_solicitado: atendimento_nome,
          servicos_disponiveis: Object.keys(regras.servicos || {})
        }
      });
    }

    // Reutilizar/atualizar variável servico já declarada
    if (!servico && servicoKey) {
      servico = regras.servicos[servicoKey];
      console.log(`✅ Serviço encontrado na busca melhorada: ${servicoKey}`);
    }
    
    // Validar se encontrou o serviço
    if (!servico || !servicoKey) {
      console.error(`❌ ERRO FINAL: Serviço não encontrado após todas as tentativas`);
      return businessErrorResponse({
        codigo_erro: 'SERVICO_NAO_ENCONTRADO',
        mensagem_usuario: `❌ O serviço "${atendimento_nome}" não está disponível para ${medico.nome}.\n\n✅ Serviços disponíveis:\n${Object.keys(regras.servicos || {}).map(s => `   • ${s}`).join('\n')}\n\n💡 Por favor, escolha um dos serviços listados acima.`,
        detalhes: {
          servico_solicitado: atendimento_nome,
          servicos_disponiveis: Object.keys(regras.servicos || {})
        }
      });
    }

    // Verificar se permite agendamento online (aceita ambos os formatos)
    // Para agendas dedicadas, verificar também no nível raiz das regras
    const permiteOnlineCheck = 
      servico.permite_online || 
      servico.permite_agendamento_online ||
      regras?.permite_agendamento_online ||  // Nível raiz das regras (agendas dedicadas)
      (regras as any)?.config?.permite_agendamento_online;  // Fallback para config nested
    if (!permiteOnlineCheck) {
      console.log(`ℹ️ Serviço ${servicoKey} não permite agendamento online`);
      
      // 1. Tentar mensagem personalizada do banco (llm_mensagens) - prioridade mais alta
      const mensagemDinamica = getMensagemPersonalizada(config, 'servico_nao_agendavel', medico.id);
      
      // 2. Fallback para mensagem do business_rules (servico.mensagem)
      // 3. Fallback para mensagem genérica
      const mensagemFinal = mensagemDinamica 
        || servico.mensagem 
        || 'Este serviço não pode ser agendado online. Por favor, entre em contato com a clínica.';
      
      console.log(`📝 Mensagem servico_nao_agendavel: ${mensagemDinamica ? 'dinâmica do banco' : servico.mensagem ? 'do business_rules' : 'genérica'}`);
      
      return successResponse({
        permite_online: false,
        medico: medico.nome,
        servico: servicoKey,
        message: mensagemFinal
      });
    }

    // 🎯 DECLARAR VARIÁVEIS DE DIA DA SEMANA (usadas em vários lugares)
    const diasNomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    let diaSemana: number | null = null;
    
    // 🎯 VALIDAÇÃO DE DIA DA SEMANA (apenas se data_consulta foi fornecida)
    if (data_consulta) {
      diaSemana = getDiaSemana(data_consulta);
      
      console.log(`📅 Validação: Data ${data_consulta} = ${diasNomes[diaSemana]} (${diaSemana})`);
      console.log(`📋 Dias permitidos para ${servicoKey}: ${servico.dias_semana?.map((d: number) => diasNomes[d]).join(', ') || 'todos'}`);
      
      if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
        const diasPermitidos = servico.dias_semana.map((d: number) => diasNomes[d]).join(', ');
        
        console.log(`⚠️ Data inválida detectada! ${diasNomes[diaSemana]} não está em [${diasPermitidos}]`);
        console.log(`🔄 Redirecionando para busca automática de próximas datas...`);
        
        // 🎯 SALVAR CONTEXTO DA DATA INVÁLIDA
        dataInvalidaOriginal = data_consulta;
        diaNomeInvalido = diasNomes[diaSemana];
        
        // 🔄 REDIRECIONAR PARA BUSCA AUTOMÁTICA
        // Limpar data_consulta para acionar o fluxo de busca de próximas datas
        data_consulta = undefined as any;
        buscar_proximas = true;
        
        console.log(`✅ Redirecionamento configurado: buscar_proximas=true, data_consulta=undefined`);
        console.log(`🔁 O código agora entrará no bloco de busca de próximas datas...`);
      } else {
        console.log(`✅ Validação de dia da semana passou: ${diasNomes[diaSemana]} está permitido`);
      }
    }

    // 🆕 SE NÃO FOI FORNECIDA DATA ESPECÍFICA, BUSCAR PRÓXIMAS DATAS DISPONÍVEIS
    if (!data_consulta) {
      const tipoAtendimento = servico.tipo || regras.tipo_agendamento || 'ordem_chegada';
      const proximasDatas = [];
      
      // 🎯 Se usuário pediu data inválida, buscar a partir daquela data (não de hoje)
      const agora = dataInvalidaOriginal ? new Date(dataInvalidaOriginal) : new Date();
      const horaAtual = agora.getHours();
      const minutoAtual = agora.getMinutes();
      
      // Criar cópia apenas para comparação de datas
      const hoje = new Date(agora);
      hoje.setHours(0, 0, 0, 0);
      
      console.log(`🔍 Buscando próximas datas disponíveis a partir de ${agora.toLocaleDateString('pt-BR')} ${dataInvalidaOriginal ? '(data solicitada: ' + dataInvalidaOriginal + ')' : '(hoje)'} - próximos ${dias_busca} dias`);
      
      let datasVerificadas = 0;
      let datasPuladasDiaSemana = 0;
      let datasPuladasBloqueio = 0;
      let datasSemVagas = 0;
      
      for (let i = 0; i < dias_busca; i++) {
        const dataAtual = new Date(hoje);
        dataAtual.setDate(dataAtual.getDate() + i);
        
        const dataFormatada = dataAtual.toISOString().split('T')[0];
        const diaSemana = dataAtual.getDay();
        datasVerificadas++;
        
        // Verificar se o médico atende neste dia
        if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
          datasPuladasDiaSemana++;
          continue;
        }

        // 🔒 Verificar se a data está bloqueada
        const { data: bloqueios, error: bloqueioError } = await supabase
          .from('bloqueios_agenda')
          .select('id, motivo')
          .eq('medico_id', medico.id)
          .lte('data_inicio', dataFormatada)
          .gte('data_fim', dataFormatada)
          .eq('status', 'ativo')
          .eq('cliente_id', clienteId);

        if (!bloqueioError && bloqueios && bloqueios.length > 0) {
          console.log(`⛔ Data ${dataFormatada} bloqueada:`, bloqueios[0].motivo);
          datasPuladasBloqueio++;
          continue;
        }

        // Verificar disponibilidade para esta data
        const periodosDisponiveis = [];
        
        // 🔧 CORREÇÃO: Serviços sem periodos próprios (ex: ligadura_hemorroidas) que compartilham limite
        // Usar lógica especial para verificar vagas via limites compartilhados
        const servicoSemPeriodos = !servico.periodos || Object.keys(servico.periodos).length === 0;
        const compartilhaLimite = servico.compartilha_limite_com;
        const ehHoraMarcada = (servico.tipo_agendamento === 'hora_marcada' || servico.tipo === 'procedimento');
        
        if (servicoSemPeriodos && compartilhaLimite) {
          console.log(`🔄 [SERVIÇO SEM PERIODOS] ${servicoKey} compartilha limite com ${compartilhaLimite}`);
          
          // Buscar atendimento_id para o cálculo de sublimite
          let atendimentoId: string | null = null;
          if (!servico.atendimento_id) {
            const { data: atendData } = await supabase
              .from('atendimentos')
              .select('id')
              .eq('medico_id', medico.id)
              .eq('cliente_id', clienteId)
              .eq('ativo', true)
              .ilike('nome', `%${servicoKey.replace(/_/g, '%')}%`)
              .maybeSingle();
            atendimentoId = atendData?.id || null;
          } else {
            atendimentoId = servico.atendimento_id;
          }
          
          // Calcular vagas disponíveis considerando pool compartilhado e sublimite
          const servicoConfigComAtendId = { ...servico, atendimento_id: atendimentoId };
          const vagasDisponiveis = await calcularVagasDisponiveisComLimites(
            supabase,
            clienteId,
            medico.id,
            dataFormatada,
            servicoKey,
            servicoConfigComAtendId,
            regras
          );
          
          console.log(`📊 [LIMITE COMPARTILHADO] ${servicoKey} em ${dataFormatada}: ${vagasDisponiveis} vagas`);
          
          if (vagasDisponiveis > 0) {
            // Para hora_marcada, verificar horários vazios disponíveis
            if (ehHoraMarcada) {
              // Buscar horários vazios para esta data
              const { data: horariosVazios, error: horariosError } = await supabase
                .from('horarios_vazios')
                .select('hora')
                .eq('medico_id', medico.id)
                .eq('cliente_id', clienteId)
                .eq('data', dataFormatada)
                .eq('status', 'disponivel')
                .order('hora', { ascending: true });
              
              if (!horariosError && horariosVazios && horariosVazios.length > 0) {
                // Filtrar horários já ocupados
                const { data: agendamentosExistentes } = await supabase
                  .from('agendamentos')
                  .select('hora_agendamento')
                  .eq('medico_id', medico.id)
                  .eq('data_agendamento', dataFormatada)
                  .eq('cliente_id', clienteId)
                  .is('excluido_em', null)
                  .in('status', ['agendado', 'confirmado']);
                
                const horariosOcupados = new Set(agendamentosExistentes?.map(a => a.hora_agendamento) || []);
                const horariosLivres = horariosVazios.filter(h => {
                  const horaFormatada = h.hora.includes(':') ? h.hora : `${h.hora}:00:00`;
                  return !horariosOcupados.has(horaFormatada);
                });
                
                if (horariosLivres.length > 0) {
                  // Classificar o período (manhã/tarde) baseado no primeiro horário
                  const primeiroHorario = horariosLivres[0]?.hora;
                  const [horaH] = primeiroHorario ? primeiroHorario.split(':').map(Number) : [8];
                  const periodoNome = horaH < 12 ? 'Manhã' : 'Tarde';
                  
                  periodosDisponiveis.push({
                    periodo: periodoNome,
                    horario_distribuicao: `${horariosLivres.length} horário(s) específico(s) disponível(is)`,
                    vagas_disponiveis: Math.min(vagasDisponiveis, horariosLivres.length),
                    total_vagas: servico.limite_proprio || vagasDisponiveis,
                    horarios: horariosLivres.map(h => h.hora)
                  });
                  
                  console.log(`✅ [HORA MARCADA] ${horariosLivres.length} horários disponíveis para ${servicoKey} em ${dataFormatada}`);
                }
              } else {
                console.log(`⚠️ [HORA MARCADA] Nenhum horário vazio encontrado para ${dataFormatada}`);
              }
            } else {
              // Ordem de chegada - apenas adicionar período genérico
              periodosDisponiveis.push({
                periodo: 'Disponível',
                horario_distribuicao: 'Conforme disponibilidade',
                vagas_disponiveis: vagasDisponiveis,
                total_vagas: servico.limite_proprio || vagasDisponiveis
              });
            }
          }
        } else if (servicoSemPeriodos) {
          // Serviço sem periodos e sem limite compartilhado - erro de configuração
          console.error(`❌ [ERRO CONFIG] Serviço ${servicoKey} não tem periodos nem compartilha limite`);
          datasSemVagas++;
          continue;
        }
        
        // 🔧 Loop normal para serviços COM periodos definidos
        if (servico.periodos && Object.keys(servico.periodos).length > 0) {
        for (const [periodo, config] of Object.entries(servico.periodos)) {
          // 🆕 FILTRAR POR PERÍODO PREFERIDO
          if (periodoPreferido === 'tarde' && periodo === 'manha') {
            console.log('⏭️ Pulando manhã (paciente quer tarde)');
            continue;
          }
          if (periodoPreferido === 'manha' && periodo === 'tarde') {
            console.log('⏭️ Pulando tarde (paciente quer manhã)');
            continue;
          }
          
          if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
            continue;
          }

          // 🆕 FILTRAR PERÍODOS QUE JÁ PASSARAM NO DIA ATUAL
          const ehHoje = (i === 0);
          
          if (ehHoje && (config as any)?.fim) {
            // Extrair horário de FIM do período
            const [horaFim, minFim] = (config as any).fim.split(':').map(Number);
            const horarioFimEmMinutos = horaFim * 60 + minFim;
            const horarioAtualEmMinutos = horaAtual * 60 + minutoAtual;
            
            // Se o período já acabou completamente, pular
            if (horarioFimEmMinutos <= horarioAtualEmMinutos) {
              console.log(`⏭️ Pulando período ${periodo} de hoje (fim ${(config as any).fim} ≤ ${horaAtual}:${minutoAtual.toString().padStart(2, '0')})`);
              continue;
            }
            
            console.log(`✅ Período ${periodo} ainda está válido hoje (fim ${(config as any).fim} > ${horaAtual}:${minutoAtual.toString().padStart(2, '0')})`);
          }

          // ✅ Para ORDEM DE CHEGADA: buscar TODOS os agendamentos do dia
          const { data: todosAgendamentos, error: countError } = await supabase
            .from('agendamentos')
            .select('hora_agendamento')
            .eq('medico_id', medico.id)
            .eq('data_agendamento', dataFormatada)
            .eq('cliente_id', clienteId)
            .is('excluido_em', null)
            .in('status', ['agendado', 'confirmado']);

          if (countError) {
            console.error('❌ Erro ao buscar agendamentos:', countError);
            continue;
          }

          // Classificar cada agendamento no período correto
          let vagasOcupadas = 0;
          if (todosAgendamentos && todosAgendamentos.length > 0) {
            vagasOcupadas = todosAgendamentos.filter(ag => {
              const periodoClassificado = classificarPeriodoAgendamento(
                ag.hora_agendamento, 
                { [periodo]: config }
              );
              return periodoClassificado === periodo;
            }).length;
            
            console.log(`📊 [DISPONIBILIDADE] Data: ${dataFormatada}`);
            console.log(`📊 [DISPONIBILIDADE] Período ${periodo}:`);
            console.log(`   - Total agendamentos no dia: ${todosAgendamentos.length}`);
            console.log(`   - Agendamentos neste período: ${vagasOcupadas}`);
            console.log(`   - Limite do período: ${(config as any).limite}`);
          } else {
            console.log(`📊 [DISPONIBILIDADE] Data: ${dataFormatada} - Período ${periodo}: SEM agendamentos`);
            console.log(`   - Limite do período: ${(config as any).limite}`);
          }

          const vagasDisponiveis = (config as any).limite - vagasOcupadas;
          console.log(`   - 🎯 Vagas disponíveis: ${vagasDisponiveis}`);

          if (vagasDisponiveis > 0) {
            periodosDisponiveis.push({
              periodo: periodo === 'manha' ? 'Manhã' : 'Tarde',
              horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
              vagas_disponiveis: vagasDisponiveis,
              total_vagas: (config as any).limite
            });
          }
        }
        } // 🔧 Fecha o if (servico.periodos && Object.keys(servico.periodos).length > 0)

        // Se encontrou períodos disponíveis nesta data, adicionar
        if (periodosDisponiveis.length > 0) {
          const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          proximasDatas.push({
            data: dataFormatada,
            dia_semana: diasSemana[diaSemana],
            periodos: periodosDisponiveis
          });
          
          console.log(`✅ Data disponível encontrada: ${dataFormatada} (${diasSemana[diaSemana]})`);
          
          // Limitar a 5 datas
          if (proximasDatas.length >= 5) break;
        } else {
          datasSemVagas++;
        }
      }

      console.log(`📊 Estatísticas da busca:
        - Datas verificadas: ${datasVerificadas}
        - Puladas (dia da semana): ${datasPuladasDiaSemana}
        - Puladas (bloqueio): ${datasPuladasBloqueio}
        - Sem vagas: ${datasSemVagas}
        - Datas disponíveis encontradas: ${proximasDatas.length}`);

      // ✅ Validação: verificar total de vagas
      if (proximasDatas.length > 0) {
        proximasDatas.forEach((data: any) => {
          const totalVagasData = data.periodos.reduce(
            (sum: number, p: any) => sum + p.vagas_disponiveis, 
            0
          );
          console.log(`✅ [VALIDAÇÃO] ${data.data} tem ${totalVagasData} vagas totais distribuídas em ${data.periodos.length} período(s)`);
          data.periodos.forEach((p: any) => {
            console.log(`   → ${p.periodo}: ${p.vagas_disponiveis}/${p.total_vagas} vagas`);
          });
        });
      }

      // 🕐 FILTRAR PERÍODOS DO DIA ATUAL QUE JÁ PASSARAM (hora marcada)
      {
        const filtradas = filtrarPeriodosPassados(proximasDatas);
        const removidos = proximasDatas.length - filtradas.length;
        if (removidos > 0) {
          console.log(`🕐 [FILTRO-HM] Removidas ${removidos} data(s) com períodos já passados`);
        }
        proximasDatas.length = 0;
        proximasDatas.push(...filtradas);
      }

      if (proximasDatas.length === 0) {
        return businessErrorResponse({
          codigo_erro: 'SEM_VAGAS_DISPONIVEIS',
          mensagem_usuario: `😔 Não encontrei vagas disponíveis para ${medico.nome} - ${servicoKey} nos próximos ${dias_busca} dias.\n\n📞 Sugestões:\n   • Ligue para ${getClinicPhone(config)} para verificar outras opções\n   • Entre na fila de espera\n   • Consulte disponibilidade em outras especialidades`,
          detalhes: {
            medico: medico.nome,
            servico: servicoKey,
            dias_buscados: dias_busca,
            periodo_solicitado: periodoPreferido || 'qualquer'
          }
        });
      }

      // 🆕 MENSAGEM CONTEXTUAL baseada na disponibilidade
      let mensagemInicial = '';
      
      // 🎯 CONTEXTO DE DATA INVÁLIDA (quando houve redirecionamento)
      if (dataInvalidaOriginal && diaNomeInvalido) {
        const [ano, mes, dia] = dataInvalidaOriginal.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        mensagemInicial = `⚠️ A data ${dataFormatada} (${diaNomeInvalido}) não está disponível para ${medico.nome}.\n\n`;
        mensagemInicial += `✅ Mas encontrei estas datas disponíveis:\n\n`;
      } else if (proximasDatas.length === 1) {
        mensagemInicial = `😊 Encontrei apenas 1 data disponível para ${medico.nome}:\n\n`;
      } else if (proximasDatas.length <= 3) {
        mensagemInicial = `✅ ${medico.nome} está com poucas vagas. Encontrei ${proximasDatas.length} datas:\n\n`;
      } else {
        mensagemInicial = `✅ ${medico.nome} - ${servicoKey}\n\n📅 ${proximasDatas.length} datas disponíveis:\n\n`;
      }
      
      const listaDatas = proximasDatas.map((d: any) => {
        const periodos = d.periodos.map((p: any) => 
          `  • ${p.periodo}: ${p.horario_distribuicao} - ${p.vagas_disponiveis} vaga(s)`
        ).join('\n');
        return `📆 ${d.dia_semana}, ${d.data}\n${periodos}`;
      }).join('\n\n');
      
      const avisoOrdemChegada = (tipoAtendimento === 'ordem_chegada' 
        ? '\n\n⚠️ ORDEM DE CHEGADA\nChegue no período indicado para pegar ficha.'
        : '');
      
      const callToAction = '\n\n💬 Qual data funciona melhor para você?';
      
      const mensagem = mensagemInicial + listaDatas + avisoOrdemChegada + callToAction;

      // 🆕 FLAG DE BAIXA DISPONIBILIDADE
      const baixaDisponibilidade = proximasDatas.length <= 2;
      
      return successResponse({
        disponivel: true,
        tipo_agendamento: tipoAtendimento,
        medico: medico.nome,
        servico: servicoKey,
        horario_busca: agora.toISOString(),
        proximas_datas: proximasDatas,
        mensagem_whatsapp: mensagem,
        message: mensagem,
        baixa_disponibilidade: baixaDisponibilidade,  // 🆕 FLAG
        total_datas_encontradas: proximasDatas.length,
        ...(dataInvalidaOriginal && { // 🆕 ADICIONAR CONTEXTO DE REDIRECIONAMENTO
          data_solicitada_invalida: dataInvalidaOriginal,
          dia_invalido: diaNomeInvalido,
          motivo_redirecionamento: `${medico.nome} não atende ${servicoKey} aos ${diaNomeInvalido}s`
        }),
        contexto: {
          medico_id: medico.id,
          medico_nome: medico.nome,
          servico: atendimento_nome,
          periodo_solicitado: periodoPreferido,
          dias_buscados: quantidade_dias
        }
      });
    }

    // 🎯 COMPORTAMENTO: VERIFICAR DATA ESPECÍFICA (se não entrou no bloco anterior)
    // Se chegamos aqui, significa que data_consulta ainda existe (não foi redirecionada)
    // Recalcular diaSemana se necessário
    if (!diaSemana && data_consulta) {
      diaSemana = getDiaSemana(data_consulta);
      console.log(`📅 Recalculando dia da semana para ${data_consulta}: ${diasNomes[diaSemana]}`);
    }
    
    // 🔒 VERIFICAR SE A DATA ESTÁ BLOQUEADA
    const { data: bloqueios, error: bloqueioError } = await supabase
      .from('bloqueios_agenda')
      .select('id, motivo')
      .eq('medico_id', medico.id)
      .lte('data_inicio', data_consulta)
      .gte('data_fim', data_consulta)
      .eq('status', 'ativo')
      .eq('cliente_id', clienteId);

    if (!bloqueioError && bloqueios && bloqueios.length > 0) {
      console.log(`⛔ Data ${data_consulta} bloqueada:`, bloqueios[0].motivo);
      
      // 🆕 Buscar próximas datas disponíveis automaticamente
      const proximasDatas = await buscarProximasDatasDisponiveis(
        supabase,
        medico,
        servicoKey,
        servico,
        data_consulta,
        clienteId,
        periodoPreferido,
        60,
        5
      );
      
      let mensagem = `❌ A agenda do(a) ${medico.nome} está bloqueada em ${data_consulta}.\n`;
      mensagem += `📋 Motivo: ${bloqueios[0].motivo}\n\n`;
      
      if (proximasDatas.length > 0) {
        mensagem += `✅ Próximas datas disponíveis:\n\n`;
        proximasDatas.forEach(d => {
          mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
        });
        mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
      } else {
        mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
        mensagem += `Por favor, entre em contato com a clínica.`;
      }
      
      return successResponse({
        disponivel: false,
        bloqueada: true,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        motivo_bloqueio: bloqueios[0].motivo,
        proximas_datas: proximasDatas,
        message: mensagem
      });
    }

    // 🎯 TIPO DE ATENDIMENTO JÁ DETECTADO (linha 1247)
    console.log(`📋 Tipo de atendimento: ${tipoAtendimento} (já detectado anteriormente)`);

    // Contar agendamentos existentes para cada período
    const periodosDisponiveis = [];
    
    // 🔧 CORREÇÃO: Serviços sem periodos próprios (ex: ligadura_hemorroidas) que compartilham limite
    const servicoSemPeriodosFluxo3 = !servico.periodos || Object.keys(servico.periodos).length === 0;
    const compartilhaLimiteFluxo3 = servico.compartilha_limite_com;
    const ehHoraMarcadaFluxo3 = (servico.tipo_agendamento === 'hora_marcada' || servico.tipo === 'procedimento');
    
    if (servicoSemPeriodosFluxo3 && compartilhaLimiteFluxo3 && data_consulta) {
      console.log(`🔄 [FLUXO 3 - SEM PERIODOS] ${servicoKey} compartilha limite com ${compartilhaLimiteFluxo3}`);
      
      // Buscar atendimento_id para cálculo do sublimite
      let atendimentoIdFluxo3: string | null = null;
      if (!servico.atendimento_id) {
        const { data: atendData } = await supabase
          .from('atendimentos')
          .select('id')
          .eq('medico_id', medico.id)
          .eq('cliente_id', clienteId)
          .eq('ativo', true)
          .ilike('nome', `%${servicoKey.replace(/_/g, '%')}%`)
          .maybeSingle();
        atendimentoIdFluxo3 = atendData?.id || null;
      } else {
        atendimentoIdFluxo3 = servico.atendimento_id;
      }
      
      // Calcular vagas disponíveis
      const servicoConfigFluxo3 = { ...servico, atendimento_id: atendimentoIdFluxo3 };
      const vagasDisponiveisFluxo3 = await calcularVagasDisponiveisComLimites(
        supabase,
        clienteId,
        medico.id,
        data_consulta,
        servicoKey,
        servicoConfigFluxo3,
        regras
      );
      
      console.log(`📊 [FLUXO 3 - LIMITE COMPARTILHADO] ${servicoKey} em ${data_consulta}: ${vagasDisponiveisFluxo3} vagas`);
      
      if (vagasDisponiveisFluxo3 > 0) {
        if (ehHoraMarcadaFluxo3) {
          // Buscar horários vazios para esta data
          const { data: horariosVaziosFluxo3 } = await supabase
            .from('horarios_vazios')
            .select('hora')
            .eq('medico_id', medico.id)
            .eq('cliente_id', clienteId)
            .eq('data', data_consulta)
            .eq('status', 'disponivel')
            .order('hora', { ascending: true });
          
          if (horariosVaziosFluxo3 && horariosVaziosFluxo3.length > 0) {
            // Filtrar horários ocupados
            const { data: agendamentosFluxo3 } = await supabase
              .from('agendamentos')
              .select('hora_agendamento')
              .eq('medico_id', medico.id)
              .eq('data_agendamento', data_consulta)
              .eq('cliente_id', clienteId)
              .is('excluido_em', null)
              .in('status', ['agendado', 'confirmado']);
            
            const horariosOcupadosFluxo3 = new Set(agendamentosFluxo3?.map(a => a.hora_agendamento) || []);
            const horariosLivresFluxo3 = horariosVaziosFluxo3.filter(h => {
              const horaFormatada = h.hora.includes(':') ? h.hora : `${h.hora}:00:00`;
              return !horariosOcupadosFluxo3.has(horaFormatada);
            });
            
            if (horariosLivresFluxo3.length > 0 && horariosLivresFluxo3[0]?.hora) {
              const [horaH] = horariosLivresFluxo3[0].hora.split(':').map(Number);
              const periodoNome = horaH < 12 ? 'Manhã' : 'Tarde';
              
              periodosDisponiveis.push({
                periodo: periodoNome,
                disponivel: true,
                hora_inicio: horariosLivresFluxo3[0].hora,
                hora_fim: horariosLivresFluxo3[horariosLivresFluxo3.length - 1].hora,
                horario_distribuicao: `${horariosLivresFluxo3.length} horário(s) específico(s)`,
                vagas_disponiveis: Math.min(vagasDisponiveisFluxo3, horariosLivresFluxo3.length),
                total_vagas: servico.limite_proprio || vagasDisponiveisFluxo3,
                intervalo_minutos: 30,
                horarios: horariosLivresFluxo3.map(h => h.hora)
              });
              
              console.log(`✅ [FLUXO 3 - HORA MARCADA] ${horariosLivresFluxo3.length} horários disponíveis`);
            }
          }
        } else {
          periodosDisponiveis.push({
            periodo: 'Disponível',
            disponivel: true,
            horario_distribuicao: 'Conforme disponibilidade',
            vagas_disponiveis: vagasDisponiveisFluxo3,
            total_vagas: servico.limite_proprio || vagasDisponiveisFluxo3
          });
        }
      }
    }
    
    // 🔧 Loop normal para serviços COM periodos definidos
    if (servico.periodos && Object.keys(servico.periodos).length > 0) {
    for (const [periodo, config] of Object.entries(servico.periodos)) {
      // 🆕 FILTRAR POR PERÍODO PREFERIDO
      if (periodoPreferido === 'tarde' && periodo === 'manha') {
        console.log('⏭️ [FLUXO 3] Pulando manhã (paciente quer tarde)');
        continue;
      }
      if (periodoPreferido === 'manha' && periodo === 'tarde') {
        console.log('⏭️ [FLUXO 3] Pulando tarde (paciente quer manhã)');
        continue;
      }
      
      // Verificar se o período é válido para este dia da semana
      if ((config as any).dias_especificos && !(config as any).dias_especificos.includes(diaSemana)) {
        continue;
      }

      // 🆕 SE A DATA FOR HOJE, VERIFICAR SE O PERÍODO JÁ PASSOU
      const ehHoje = (data_consulta === dataAtual);
      
      if (ehHoje && (config as any)?.fim) {
        const [horaFim, minFim] = (config as any).fim.split(':').map(Number);
        const horarioFimEmMinutos = horaFim * 60 + minFim;
        
        // Se o período já acabou, pular
        if (horarioFimEmMinutos <= horarioAtualEmMinutos) {
          console.log(`⏭️ Pulando período ${periodo} (fim ${(config as any).fim} já passou às ${horaAtual}:${getDataHoraAtualBrasil().minuto})`);
          continue;
        }
      }

      // ✅ Para ORDEM DE CHEGADA: buscar TODOS os agendamentos do dia
      const { data: todosAgendamentosData, error: countError } = await supabase
        .from('agendamentos')
        .select('hora_agendamento')
        .eq('medico_id', medico.id)
        .eq('data_agendamento', data_consulta)
        .eq('cliente_id', clienteId)
        .is('excluido_em', null)
        .in('status', ['agendado', 'confirmado']);

      if (countError) {
        console.error('❌ Erro ao buscar agendamentos:', countError);
        continue;
      }

      // Classificar cada agendamento no período correto
      let vagasOcupadas = 0;
      if (todosAgendamentosData && todosAgendamentosData.length > 0) {
        vagasOcupadas = todosAgendamentosData.filter(ag => {
          const periodoClassificado = classificarPeriodoAgendamento(
            ag.hora_agendamento,
            { [periodo]: config }
          );
          return periodoClassificado === periodo;
        }).length;
        
        console.log(`📊 ${data_consulta} - Período ${periodo}: ${vagasOcupadas}/${(config as any).limite} vagas ocupadas`);
        console.log(`   Horários encontrados:`, todosAgendamentosData.map(a => a.hora_agendamento).join(', '));
      }

      const vagasDisponiveis = (config as any).limite - vagasOcupadas;

      periodosDisponiveis.push({
        periodo: periodo === 'manha' ? 'Manhã' : 'Tarde',
        horario_distribuicao: (config as any).distribuicao_fichas || `${(config as any).inicio} às ${(config as any).fim}`,
        vagas_ocupadas: vagasOcupadas,
        vagas_disponiveis: vagasDisponiveis,
        total_vagas: (config as any).limite,
        disponivel: vagasDisponiveis > 0,
        hora_inicio: (config as any).inicio,
        hora_fim: (config as any).fim,
        intervalo_minutos: (config as any).intervalo_minutos
      });
    }
    } // 🔧 Fecha o if (servico.periodos && Object.keys(servico.periodos).length > 0)

    if (periodosDisponiveis.length === 0) {
      console.log(`❌ Nenhum período disponível para ${data_consulta}. Buscando alternativas...`);
      
      // 🔍 Buscar próximas datas disponíveis mantendo período preferido
      const proximasDatas = await buscarProximasDatasDisponiveis(
        supabase,
        medico,
        servicoKey,
        servico,
        data_consulta,
        clienteId,
        periodoPreferido, // ✅ Mantém período solicitado (manhã/tarde)
        60, // Buscar nos próximos 60 dias
        5   // Máximo 5 sugestões
      );
      
      // 🎯 Montar mensagem contextualizada
      const periodoTexto = periodoPreferido === 'manha' ? 'Manhã' : 
                           periodoPreferido === 'tarde' ? 'Tarde' : 
                           periodoPreferido ? periodoPreferido : '';
      
      let mensagem = `❌ ${medico.nome} não atende ${servicoKey}`;
      
      if (periodoTexto) {
        mensagem += ` no período da ${periodoTexto}`;
      }
      
      mensagem += ` na data ${data_consulta}.\n\n`;
      
      if (proximasDatas.length > 0) {
        mensagem += `✅ Próximas datas disponíveis`;
        
        if (periodoTexto) {
          mensagem += ` no período da ${periodoTexto}`;
        }
        
        mensagem += `:\n\n`;
        
        proximasDatas.forEach(d => {
          mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo || ''} - ${d.vagas_disponiveis} vaga(s)\n`;
        });
        
        mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
      } else {
        mensagem += `⚠️ Não encontramos vagas`;
        
        if (periodoTexto) {
          mensagem += ` no período da ${periodoTexto}`;
        }
        
        mensagem += ` nos próximos 60 dias.\n\n`;
        mensagem += `📞 Por favor, entre em contato:\n`;
        mensagem += `   • Telefone: ${getClinicPhone(config)}\n`;
        mensagem += `   • Opções: Fila de espera ou outros períodos`;
      }
      
      // ✅ Retornar resposta estruturada (status 200)
      return successResponse({
        disponivel: false,
        motivo: 'periodo_data_nao_disponivel',
        medico: medico.nome,
        servico: servicoKey,
        data_solicitada: data_consulta,
        periodo_solicitado: periodoPreferido,
        proximas_datas: proximasDatas,
        message: mensagem,
        contexto: {
          medico_id: medico.id,
          medico_nome: medico.nome,
          servico: atendimento_nome,
          data_original: data_consulta,
          periodo_preferido: periodoPreferido,
          total_alternativas: proximasDatas.length
        }
      });
    }

    // 🎯 RESPOSTA DIFERENCIADA POR TIPO DE ATENDIMENTO
    // Usar função getTipoAgendamentoEfetivo para determinar tipo real
    const tipoEfetivo = getTipoAgendamentoEfetivo(servico, regras);
    console.log(`📋 [DISPONIBILIDADE] Tipo efetivo: ${tipoEfetivo}`);

    if (isOrdemChegada(tipoEfetivo)) {
      // ✅ ORDEM DE CHEGADA - NÃO retorna horários específicos
      console.log('✅ Retornando disponibilidade por ORDEM DE CHEGADA');
      
      const temVagas = periodosDisponiveis.some(p => p.disponivel);
      
      // 🆕 Se não tem vagas, buscar próximas datas
      if (!temVagas) {
        const proximasDatas = await buscarProximasDatasDisponiveis(
          supabase,
          medico,
          servicoKey,
          servico,
          data_consulta,
          clienteId,
          periodoPreferido,
          60,
          5
        );
        
        let mensagem = `❌ Sem vagas disponíveis para ${medico.nome} em ${data_consulta}.\n\n`;
        
        if (proximasDatas.length > 0) {
          mensagem += `✅ Próximas datas disponíveis:\n\n`;
          proximasDatas.forEach(d => {
            mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
          });
          mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
        } else {
          mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
          mensagem += `Por favor, entre em contato com a clínica.`;
        }
        
        return successResponse({
          disponivel: false,
          tipo_agendamento: TIPO_ORDEM_CHEGADA,
          medico: medico.nome,
          servico: servicoKey,
          data: data_consulta,
          periodos: periodosDisponiveis,
          proximas_datas: proximasDatas,
          mensagem_whatsapp: mensagem,
          message: mensagem
        });
      }
      
      // Se tem vagas, retornar normalmente
      const mensagem = `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
        periodosDisponiveis.filter(p => p.disponivel).map(p => 
          `${p.periodo}: ${p.vagas_disponiveis} vaga(s) disponível(is) de ${p.total_vagas}\n` +
          `Distribuição: ${p.horario_distribuicao}`
        ).join('\n\n') +
        '\n\n⚠️ ORDEM DE CHEGADA: Não há horário marcado. Paciente deve chegar no período para pegar ficha.';
      
      return successResponse({
        disponivel: true,
        tipo_agendamento: TIPO_ORDEM_CHEGADA,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        periodos: periodosDisponiveis,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    } else if (isEstimativaHorario(tipoEfetivo)) {
      // ✅ ESTIMATIVA DE HORÁRIO - retorna horários ESTIMADOS (híbrido)
      console.log('✅ Retornando disponibilidade por ESTIMATIVA DE HORÁRIO');
      
      const horariosEstimados = [];
      const mensagemEstimativa = getMensagemEstimativa(servico, null);
      
      for (const periodo of periodosDisponiveis) {
        if (!periodo.disponivel) continue;

        // Usar intervalo_estimado do serviço ou período
        const intervaloMinutos = getIntervaloMinutos(tipoEfetivo, servico, periodo);
        console.log(`📋 [ESTIMATIVA] Intervalo: ${intervaloMinutos} minutos`);
        
        // Gerar slots de tempo estimados
        const [horaInicio, minInicio] = periodo.hora_inicio.split(':').map(Number);
        const [horaFim, minFim] = periodo.hora_fim.split(':').map(Number);
        
        let horaAtual = horaInicio * 60 + minInicio;
        const horaLimite = horaFim * 60 + minFim;
        
        // 🕐 Calcular horário mínimo se for hoje (antecedência de 60min)
        const { data: dataAtualEst, horarioEmMinutos: horarioAtualMinEst } = getDataHoraAtualBrasil();
        const minEstMinutos = data_consulta === dataAtualEst ? horarioAtualMinEst + 60 : 0;

        while (horaAtual < horaLimite) {
          // 🕐 Pular horários que já passaram
          if (horaAtual < minEstMinutos) {
            horaAtual += intervaloMinutos;
            continue;
          }

          const h = Math.floor(horaAtual / 60);
          const m = horaAtual % 60;
          const horarioFormatado = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
          
          // Verificar se este horário específico está ocupado
          const { count } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', data_consulta)
            .eq('hora_agendamento', horarioFormatado)
            .eq('cliente_id', clienteId)
            .is('excluido_em', null)
            .in('status', ['agendado', 'confirmado']);
          
          if (count === 0) {
            horariosEstimados.push({
              hora: horarioFormatado,
              hora_formatada: formatarHorarioParaExibicao(horarioFormatado, tipoEfetivo, periodo),
              disponivel: true,
              periodo: periodo.periodo.toLowerCase(),
              eh_estimativa: true
            });
          }
          
          horaAtual += intervaloMinutos;
        }
      }

      // 🆕 Se não tem horários, buscar próximas datas
      if (horariosEstimados.length === 0) {
        const proximasDatas = await buscarProximasDatasDisponiveis(
          supabase,
          medico,
          servicoKey,
          servico,
          data_consulta,
          clienteId,
          periodoPreferido,
          60,
          5
        );
        
        let mensagem = `❌ Sem horários disponíveis para ${medico.nome} em ${data_consulta}.\n\n`;
        
        if (proximasDatas.length > 0) {
          mensagem += `✅ Próximas datas disponíveis:\n\n`;
          proximasDatas.forEach(d => {
            mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
          });
          mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
        } else {
          mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
          mensagem += `Por favor, entre em contato com a clínica.`;
        }
        
        return successResponse({
          disponivel: false,
          tipo_agendamento: TIPO_ESTIMATIVA_HORARIO,
          medico: medico.nome,
          servico: servicoKey,
          data: data_consulta,
          horarios_estimados: [],
          total: 0,
          proximas_datas: proximasDatas,
          mensagem_estimativa: mensagemEstimativa,
          mensagem_whatsapp: mensagem,
          message: mensagem
        });
      }

      // Se tem horários estimados, retornar com formatação adequada
      const mensagem = `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
        `${horariosEstimados.length} horário(s) estimado(s) disponível(is):\n` +
        horariosEstimados.slice(0, 10).map(h => `• ${h.hora_formatada}`).join('\n') +
        (horariosEstimados.length > 10 ? `\n... e mais ${horariosEstimados.length - 10} horário(s)` : '') +
        `\n\n⏰ ${mensagemEstimativa}`;
      
      return successResponse({
        disponivel: horariosEstimados.length > 0,
        tipo_agendamento: TIPO_ESTIMATIVA_HORARIO,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        horarios_estimados: horariosEstimados,
        horarios_disponiveis: horariosEstimados, // compatibilidade
        total: horariosEstimados.length,
        mensagem_estimativa: mensagemEstimativa,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    } else {
      // ✅ HORA MARCADA - retorna slots específicos (exatos)
      console.log('✅ Retornando disponibilidade por HORA MARCADA');
      const horariosDisponiveis = [];
      
      for (const periodo of periodosDisponiveis) {
        if (!periodo.disponivel) continue;

        const intervaloMinutos = periodo.intervalo_minutos || 30;
        
        // Gerar slots de tempo
        const [horaInicio, minInicio] = periodo.hora_inicio.split(':').map(Number);
        const [horaFim, minFim] = periodo.hora_fim.split(':').map(Number);
        
        let horaAtual = horaInicio * 60 + minInicio;
        const horaLimite = horaFim * 60 + minFim;
        
        // 🕐 Calcular horário mínimo se for hoje (antecedência de 60min)
        const { data: dataAtualSlots, horarioEmMinutos: horarioAtualMinSlots } = getDataHoraAtualBrasil();
        const minSlotMinutos = data_consulta === dataAtualSlots ? horarioAtualMinSlots + 60 : 0;

        while (horaAtual < horaLimite) {
          // 🕐 Pular horários que já passaram (hoje + 60min antecedência)
          if (horaAtual < minSlotMinutos) {
            horaAtual += intervaloMinutos;
            continue;
          }

          const h = Math.floor(horaAtual / 60);
          const m = horaAtual % 60;
          const horarioFormatado = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
          
          // Verificar se este horário específico está ocupado
          const { count } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('data_agendamento', data_consulta)
            .eq('hora_agendamento', horarioFormatado)
            .eq('cliente_id', clienteId)
            .is('excluido_em', null)
            .in('status', ['agendado', 'confirmado']);
          
          if (count === 0) {
            horariosDisponiveis.push({
              hora: horarioFormatado,
              disponivel: true,
              periodo: periodo.periodo.toLowerCase()
            });
          }
          
          horaAtual += intervaloMinutos;
        }
      }

      // 🆕 Se não tem horários, buscar próximas datas
      if (horariosDisponiveis.length === 0) {
        const proximasDatas = await buscarProximasDatasDisponiveis(
          supabase,
          medico,
          servicoKey,
          servico,
          data_consulta,
          clienteId,
          periodoPreferido,
          60,
          5
        );
        
        let mensagem = `❌ Sem horários disponíveis para ${medico.nome} em ${data_consulta}.\n\n`;
        
        if (proximasDatas.length > 0) {
          mensagem += `✅ Próximas datas disponíveis:\n\n`;
          proximasDatas.forEach(d => {
            mensagem += `📅 ${d.data} (${d.dia_semana}) - ${d.periodo} - ${d.vagas_disponiveis} vaga(s)\n`;
          });
          mensagem += `\n💡 Gostaria de agendar em uma destas datas?`;
        } else {
          mensagem += `⚠️ Não encontramos vagas nos próximos 60 dias.\n`;
          mensagem += `Por favor, entre em contato com a clínica.`;
        }
        
        return successResponse({
          disponivel: false,
          tipo_agendamento: 'hora_marcada',
          medico: medico.nome,
          servico: servicoKey,
          data: data_consulta,
          horarios_disponiveis: [],
          total: 0,
          proximas_datas: proximasDatas,
          mensagem_whatsapp: mensagem,
          message: mensagem
        });
      }

      // Se tem horários, retornar normalmente
      const mensagem = `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
        `${horariosDisponiveis.length} horários disponíveis:\n` +
        horariosDisponiveis.map(h => `• ${h.hora}`).join('\n');
      
      return successResponse({
        disponivel: horariosDisponiveis.length > 0,
        tipo_agendamento: 'hora_marcada',
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        horarios_disponiveis: horariosDisponiveis,
        total: horariosDisponiveis.length,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    }

  } catch (error: any) {
    console.error('❌ [ERRO CRÍTICO] Falha ao verificar disponibilidade:', {
      error_message: error?.message,
      error_stack: error?.stack,
      error_code: error?.code,
      parametros_recebidos: body
    });
    
    return businessErrorResponse({
      codigo_erro: 'ERRO_SISTEMA',
      mensagem_usuario: `❌ Ocorreu um erro ao verificar a disponibilidade.\n\n📞 Por favor:\n   • Tente novamente em alguns instantes\n   • Ou entre em contato: ${getClinicPhone(config)}`,
      detalhes: {
        erro_tecnico: error?.message || 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Buscar pacientes
