import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🌎 Função para obter data E HORA atual no fuso horário de São Paulo
function getDataHoraAtualBrasil() {
  const agora = new Date();
  const brasilTime = agora.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const [data, hora] = brasilTime.split(', ');
  const [dia, mes, ano] = data.split('/');
  const [horaNum, minutoNum] = hora.split(':').map(Number);
  
  return {
    data: `${ano}-${mes}-${dia}`,
    hora: horaNum,
    minuto: minutoNum,
    horarioEmMinutos: horaNum * 60 + minutoNum
  };
}

// Manter compatibilidade - retorna apenas a data
function getDataAtualBrasil(): string {
  return getDataHoraAtualBrasil().data;
}

/**
 * Classifica um horário de agendamento no período correto (manhã/tarde)
 * considerando margem de tolerância para ordem de chegada
 */
function classificarPeriodoAgendamento(
  horaAgendamento: string,
  periodosConfig: any
): string | null {
  const [h, m] = horaAgendamento.split(':').map(Number);
  const minutos = h * 60 + m;

  for (const [periodo, config] of Object.entries(periodosConfig)) {
    const [hInicio, mInicio] = (config as any).inicio.split(':').map(Number);
    const [hFim, mFim] = (config as any).fim.split(':').map(Number);
    const inicioMinutos = hInicio * 60 + mInicio;
    const fimMinutos = hFim * 60 + mFim;

    // Para ORDEM DE CHEGADA: considerar margem de 15 minutos
    // Exemplo: período 07:00-12:00 aceita agendamentos desde 06:45
    const margemMinutos = 15; // 15 minutos
    
    if (minutos >= (inicioMinutos - margemMinutos) && minutos <= fimMinutos) {
      return periodo;
    }
  }

  return null;
}

// Regras de negócio para agendamento via LLM Agent (N8N/WhatsApp)
// Sistema web NÃO usa essas regras - funciona sem restrições
const BUSINESS_RULES = {
  medicos: {
    // Dr. Marcelo D'Carli - Cardiologista - ORDEM DE CHEGADA
    '1e110923-50df-46ff-a57a-29d88e372900': {
      nome: 'DR. MARCELO D\'CARLI',
      tipo_agendamento: 'ordem_chegada',
      servicos: {
        'Consulta Cardiológica': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [1, 2, 3, 4, 5], // seg-sex
          periodos: {
            manha: { inicio: '07:00', fim: '12:00', limite: 9, atendimento_inicio: '07:45', distribuicao_fichas: '07:00 às 09:30' },
            tarde: { inicio: '13:00', fim: '17:00', limite: 9, dias_especificos: [1, 3], atendimento_inicio: '13:45', distribuicao_fichas: '13:00 às 15:00' } // seg e qua
          }
        },
        'Teste Ergométrico': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [2, 3, 4], // ter, qua, qui
          periodos: {
            manha: { inicio: '07:00', fim: '12:00', limite: 9, dias_especificos: [3], atendimento_inicio: '07:45', distribuicao_fichas: '07:00 às 09:30' }, // qua
            tarde: { inicio: '13:00', fim: '17:00', limite: 9, dias_especificos: [2, 4], atendimento_inicio: '13:45', distribuicao_fichas: '13:00 às 15:00' } // ter e qui
          }
        },
        'ECG': {
          permite_online: false,
          mensagem: 'O ECG de rotina não precisa de agendamento. Compareça à clínica de segunda a sexta (8h-10h) ou quarta à tarde (14h-15h), por ordem de chegada.'
        }
      }
    },
    
    // Dra. Adriana Carla de Sena - Endocrinologista - ORDEM DE CHEGADA
    '32d30887-b876-4502-bf04-e55d7fb55b50': {
      nome: 'DRA. ADRIANA CARLA DE SENA',
      tipo_agendamento: 'ordem_chegada',
      idade_minima: 18,
      servicos: {
        'Consulta Endocrinológica': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [1, 2, 3, 4, 5], // Segunda a sexta
          periodos: {
            manha: { inicio: '08:00', fim: '10:00', limite: 9, atendimento_inicio: '08:45', distribuicao_fichas: '08:00 às 10:00' },
            tarde: { inicio: '13:00', fim: '15:00', limite: 9, dias_especificos: [2, 3], atendimento_inicio: '14:45', distribuicao_fichas: '13:00 às 15:00' }
          }
        }
      }
    },
    
    // Dr. Pedro Francisco - Ultrassonografista - ORDEM DE CHEGADA
    '66e9310d-34cd-4005-8937-74e87125dc03': {
      nome: 'DR. PEDRO FRANCISCO',
      tipo_agendamento: 'ordem_chegada',
      servicos: {
        'Consulta': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [2, 4], // ter e qui apenas
          periodos: {
            manha: { inicio: '07:00', fim: '12:00', limite: 3, distribuicao_fichas: '09:30 às 10:00' }
          },
          mensagem_extra: 'Chegue entre 9h30 e 10h. O atendimento é após os exames, por ordem de chegada.'
        }
      }
    },
    
    // Dr. Alessandro Dias - Cardiologista (Ecocardiograma) - ORDEM DE CHEGADA
    'c192e08e-e216-4c22-99bf-b5992ce05e17': {
      nome: 'DR. ALESSANDRO DIAS',
      tipo_agendamento: 'ordem_chegada',
      servicos: {
        'Ecocardiograma': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [1], // apenas segunda
          periodos: {
            manha: { inicio: '07:00', fim: '12:00', limite: 9, atendimento_inicio: '08:00', distribuicao_fichas: '08:00 às 09:30' }
          }
        },
        'Consulta Cardiológica': {
          permite_online: false,
          mensagem: 'Para consultas e retornos com Dr. Alessandro Dias, agende por telefone: (87) 3866-4050'
        }
      }
    }
  }
};

// Função auxiliar para calcular idade
function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// Função auxiliar para obter dia da semana (0=dom, 1=seg, ...)
function getDiaSemana(data: string): number {
  return new Date(data).getDay();
}

// Função para mapear dados flexivelmente
function mapSchedulingData(body: any) {
  const mapped = {
    // Nome do paciente - aceitar diferentes formatos
    paciente_nome: body.paciente_nome || body.nome_paciente || body.nome_completo || body.patient_name,
    
    // Data de nascimento - aceitar diferentes formatos
    data_nascimento: body.data_nascimento || body.paciente_nascimento || body.birth_date || body.nascimento,
    
    // Convênio
    convenio: body.convenio || body.insurance || body.plano_saude,
    
    // Telefones
    telefone: body.telefone || body.phone || body.telefone_fixo,
    celular: body.celular || body.mobile || body.whatsapp || body.telefone_celular,
    
    // Médico - aceitar ID ou nome
    medico_nome: body.medico_nome || body.doctor_name || body.nome_medico,
    medico_id: body.medico_id || body.doctor_id,
    
    // Atendimento
    atendimento_nome: body.atendimento_nome || body.tipo_consulta || body.service_name || body.procedimento,
    
    // Data e hora da consulta - aceitar diferentes formatos
    data_consulta: body.data_consulta || body.data_agendamento || body.appointment_date || body.data,
    hora_consulta: body.hora_consulta || body.hora_agendamento || body.appointment_time || body.hora,
    
    // Observações
    observacoes: body.observacoes || body.notes || body.comments || body.obs
  };
  
  return mapped;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 🔑 Buscar cliente_id do IPADO
  // Cliente ID fixo do IPADO (sistema single-tenant)
  const CLIENTE_ID = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';
  console.log('🏥 Sistema configurado para cliente IPADO:', CLIENTE_ID);

    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    console.log(`🤖 LLM Agent API Call: ${method} ${url.pathname}`);

    if (method === 'POST') {
      const body = await req.json();
      const action = pathParts[1]; // /llm-agent-api/{action}

      switch (action) {
        case 'schedule':
          return await handleSchedule(supabase, body, CLIENTE_ID);
        case 'check-patient':
          return await handleCheckPatient(supabase, body, CLIENTE_ID);
        case 'reschedule':
          return await handleReschedule(supabase, body, CLIENTE_ID);
        case 'cancel':
          return await handleCancel(supabase, body, CLIENTE_ID);
        case 'confirm':
          return await handleConfirm(supabase, body, CLIENTE_ID);
        case 'availability':
          return await handleAvailability(supabase, body, CLIENTE_ID);
        case 'patient-search':
          return await handlePatientSearch(supabase, body, CLIENTE_ID);
        default:
          return errorResponse('Ação não reconhecida. Ações disponíveis: schedule, check-patient, reschedule, cancel, availability, patient-search');
      }
    }

    return errorResponse('Método não permitido. Use POST.');

  } catch (error: any) {
    console.error('❌ Erro na LLM Agent API:', error);
    return errorResponse(`Erro interno: ${error?.message || 'Erro desconhecido'}`);
  }
})

// Agendar consulta
async function handleSchedule(supabase: any, body: any, clienteId: string) {
  try {
    console.log('📥 Dados recebidos na API:', JSON.stringify(body, null, 2));
    
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
    
    // Mapear dados flexivelmente (aceitar diferentes formatos)
    const mappedData = mapSchedulingData(sanitizedBody);
    console.log('🔄 Dados mapeados:', JSON.stringify(mappedData, null, 2));
    
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
      
      return errorResponse(`Campos obrigatórios faltando: ${missingFields.join(', ')}`);
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
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .eq('id', medico_id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        return errorResponse(`Médico com ID "${medico_id}" não encontrado ou inativo`);
      }
      console.log(`✅ Médico encontrado por ID: ${medico.nome}`);
    } else {
      console.log(`🔍 Buscando médico por nome: ${medico_nome}`);
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .ilike('nome', `%${medico_nome}%`)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        return errorResponse(`Médico "${medico_nome}" não encontrado ou inativo`);
      }
      console.log(`✅ Médico encontrado por nome: ${medico.nome}`);
    }

    console.log('🔍 Buscando regras de negócio...');
    // ===== VALIDAÇÕES DE REGRAS DE NEGÓCIO (APENAS PARA N8N) =====
    const regras = BUSINESS_RULES.medicos[medico.id];
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
        if (regras.idade_minima) {
          const idade = calcularIdade(data_nascimento);
          if (idade < regras.idade_minima) {
            return errorResponse(
              `${regras.nome} atende apenas pacientes com ${regras.idade_minima}+ anos. Idade informada: ${idade} anos.`
            );
          }
          console.log(`✅ Validação de idade OK: ${idade} anos`);
        }
        
        // 2. Validar serviço específico
        if (atendimento_nome) {
          try {
            const servicoKeyValidacao = Object.keys(regras.servicos).find(s => 
              s.toLowerCase().includes(atendimento_nome.toLowerCase()) ||
              atendimento_nome.toLowerCase().includes(s.toLowerCase())
            );
            
            if (servicoKeyValidacao) {
              const servicoLocal = regras.servicos[servicoKeyValidacao];
              console.log(`🔍 Validando serviço: ${servicoKeyValidacao}`);
              
              // 2.1 Verificar se permite agendamento online
              if (!servicoLocal.permite_online) {
                console.log(`❌ Serviço ${servicoKeyValidacao} não permite agendamento online`);
                return errorResponse(servicoLocal.mensagem || 'Este serviço não pode ser agendado online.');
              }
              
              // 2.2 Verificar dias permitidos
              if (servicoLocal.dias_permitidos && dia_semana && !servicoLocal.dias_permitidos.includes(dia_semana)) {
                const diasPermitidos = servicoLocal.dias_permitidos.join(', ');
                console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} às ${dia_semana}s`);
                return errorResponse(
                  `${regras.nome} não atende ${servicoKeyValidacao} no dia escolhido. Dias disponíveis: ${diasPermitidos}`
                );
              }
              
              // 2.3 Verificar períodos específicos por dia
              if (servicoLocal.periodos_por_dia && periodo && dia_semana) {
                const periodosPermitidos = servicoLocal.periodos_por_dia[dia_semana];
                if (periodosPermitidos && !periodosPermitidos.includes(periodo)) {
                  console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodo} às ${dia_semana}s`);
                  return errorResponse(
                    `${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodo === 'manha' ? 'manhã' : 'tarde'}`
                  );
                }
                
                if (!periodosPermitidos && servicoLocal.periodos_por_dia) {
                  const diasDisponiveis = Object.keys(servicoLocal.periodos_por_dia);
                  const diasPermitidos = diasDisponiveis.join(', ');
                  console.log(`❌ ${regras.nome} não atende ${servicoKeyValidacao} às ${dia_semana}s no período da ${periodo}`);
                  return errorResponse(
                    `${regras.nome} não atende ${servicoKeyValidacao} no período da ${periodo === 'manha' ? 'manhã' : 'tarde'} no dia escolhido. Dias disponíveis para este período: ${diasPermitidos}`
                  );
                }
              }
              
              // 2.4 Verificar limite de vagas
              if (servicoLocal.periodos && periodo && data_consulta) {
                const configPeriodo = servicoLocal.periodos[periodo];
                if (configPeriodo && configPeriodo.limite) {
                  const { data: agendamentos, error: agendError } = await supabase
                    .from('agendamentos')
                    .select('id')
                    .eq('medico_id', medico.id)
                    .eq('data_agendamento', data_consulta)
                    .in('status', ['agendado', 'confirmado']);
                  
                  if (agendError) {
                    console.error('Erro ao verificar limite de vagas:', agendError);
                  } else {
                    const vagasOcupadas = agendamentos?.length || 0;
                    if (vagasOcupadas >= configPeriodo.limite) {
                      console.log(`❌ Limite atingido para ${servicoKeyValidacao}: ${vagasOcupadas}/${configPeriodo.limite}`);
                      return errorResponse(
                        `Não há mais vagas disponíveis para ${regras.nome} - ${servicoKeyValidacao} neste período. Limite: ${configPeriodo.limite} pacientes, Ocupado: ${vagasOcupadas}`
                      );
                    }
                    console.log(`✅ Vagas disponíveis: ${configPeriodo.limite - vagasOcupadas}`);
                  }
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

    // Buscar atendimento por nome (se especificado) COM filtro de cliente
    let atendimento_id = null;
    if (atendimento_nome) {
      console.log(`🔍 Buscando atendimento: "${atendimento_nome}" para médico ${medico.nome}`);
      
      // Tentativa 1: Busca pelo nome fornecido
      let { data: atendimento, error: atendimentoError } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo')
        .ilike('nome', `%${atendimento_nome}%`)
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();

      // Tentativa 2: Fallback inteligente por tipo
      if (atendimentoError || !atendimento) {
        console.log(`⚠️ Não encontrado com nome exato, tentando busca por tipo...`);
        
        const nomeLower = atendimento_nome.toLowerCase();
        let tipoAtendimento = null;
        
        // Detectar tipo baseado em palavras-chave
        if (nomeLower.includes('consult')) {
          tipoAtendimento = 'consulta';
        } else if (nomeLower.includes('retorn')) {
          tipoAtendimento = 'retorno';
        } else if (nomeLower.includes('exam')) {
          tipoAtendimento = 'exame';
        }
        
        if (tipoAtendimento) {
          console.log(`🎯 Detectado tipo: ${tipoAtendimento}, buscando...`);
          
          const { data: atendimentosPorTipo } = await supabase
            .from('atendimentos')
            .select('id, nome, tipo')
            .eq('tipo', tipoAtendimento)
            .eq('medico_id', medico.id)
            .eq('cliente_id', clienteId)
            .eq('ativo', true)
            .limit(1);
          
          if (atendimentosPorTipo && atendimentosPorTipo.length > 0) {
            atendimento = atendimentosPorTipo[0];
            console.log(`✅ Encontrado por tipo: ${atendimento.nome}`);
          }
        }
      }

      // Se ainda não encontrou, listar opções disponíveis
      if (!atendimento) {
        const { data: atendimentosDisponiveis } = await supabase
          .from('atendimentos')
          .select('nome, tipo')
          .eq('medico_id', medico.id)
          .eq('cliente_id', clienteId)
          .eq('ativo', true);
        
        const listaAtendimentos = atendimentosDisponiveis
          ?.map(a => `"${a.nome}" (${a.tipo})`)
          .join(', ') || 'nenhum';
        
        console.error(`❌ Atendimento "${atendimento_nome}" não encontrado. Disponíveis: ${listaAtendimentos}`);
        
        return errorResponse(
          `Atendimento "${atendimento_nome}" não encontrado para ${medico.nome}. ` +
          `Atendimentos disponíveis: ${listaAtendimentos}`
        );
      }
      
      atendimento_id = atendimento.id;
      console.log(`✅ Atendimento selecionado: ${atendimento.nome} (ID: ${atendimento_id})`);
      
    } else {
      // Buscar primeiro atendimento disponível do médico COM filtro de cliente
      console.log(`🔍 Nenhum atendimento especificado, buscando primeiro disponível...`);
      const { data: atendimentos } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .eq('medico_id', medico.id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .limit(1);

      if (!atendimentos || atendimentos.length === 0) {
        return errorResponse(`Nenhum atendimento disponível para o médico ${medico.nome}`);
      }
      atendimento_id = atendimentos[0].id;
      console.log(`✅ Primeiro atendimento disponível selecionado: ${atendimentos[0].nome}`);
    }

    // Criar agendamento usando a função atômica
    console.log(`📅 Criando agendamento para ${paciente_nome} com médico ${medico.nome}`);
    
    const { data: result, error: agendamentoError } = await supabase
      .rpc('criar_agendamento_atomico_externo', {
        p_cliente_id: clienteId, // 🆕 Passar cliente_id explicitamente
        p_nome_completo: paciente_nome.toUpperCase(),
        p_data_nascimento: data_nascimento,
        p_convenio: convenio, // Manter capitalização original para validação correta
        p_telefone: telefone || null,
        p_celular: celular,
        p_medico_id: medico.id,
        p_atendimento_id: atendimento_id,
        p_data_agendamento: data_consulta,
        p_hora_agendamento: hora_consulta,
        p_observacoes: (observacoes || 'Agendamento via LLM Agent WhatsApp').toUpperCase(),
        p_criado_por: 'LLM Agent WhatsApp',
        p_force_conflict: false
      });

    console.log('📋 Resultado da função:', { result, agendamentoError });

    if (agendamentoError) {
      console.error('❌ Erro na função criar_agendamento_atomico_externo:', agendamentoError);
      return errorResponse(`Erro ao agendar: ${agendamentoError.message}`);
    }

    if (!result?.success) {
      console.error('❌ Função retornou erro:', result);
      // Retornar como sucesso HTTP 200 mas com success: false no JSON
      // Isso permite que o N8N processe a resposta sem erro HTTP
      return new Response(JSON.stringify({
        success: false,
        error: result?.error || result?.message || 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Agendamento criado com sucesso:', result);

    // Mensagem personalizada para Dra. Adriana
    let mensagem = `Consulta agendada com sucesso para ${paciente_nome}`;

    const isDraAdriana = medico.id === '32d30887-b876-4502-bf04-e55d7fb55b50';

    if (isDraAdriana) {
      // Detectar período baseado no horário
      const [hora] = hora_consulta.split(':').map(Number);
      
      let mensagemPeriodo = '';
      if (hora >= 8 && hora < 12) {
        // Manhã
        mensagemPeriodo = 'Das 08:00 às 10:00 para fazer a ficha. A Dra. começa a atender às 08:45';
      } else if (hora >= 13 && hora < 18) {
        // Tarde
        mensagemPeriodo = 'Das 13:00 às 15:00 para fazer a ficha. A Dra. começa a atender às 14:45';
      } else {
        // Fallback (não deveria acontecer, mas por segurança)
        mensagemPeriodo = 'Compareça no horário agendado. A Dra. atende por ordem de chegada';
      }
      
      mensagem = `Agendada! ${mensagemPeriodo}, por ordem de chegada. Caso o plano Unimed seja coparticipação ou particular, recebemos apenas em espécie. Posso ajudar em algo mais?`;
      console.log(`💬 Mensagem personalizada Dra. Adriana (período: ${hora >= 8 && hora < 12 ? 'manhã' : 'tarde'})`);
    }

    return successResponse({
      message: mensagem,
      agendamento_id: result.agendamento_id,
      paciente_id: result.paciente_id,
      medico: medico.nome,
      data: data_consulta,
      hora: hora_consulta
    });

  } catch (error: any) {
    return errorResponse(`Erro ao processar agendamento: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Verificar se paciente tem consultas agendadas
async function handleCheckPatient(supabase: any, body: any, clienteId: string) {
  try {
    const { paciente_nome, data_nascimento, celular } = body;

    if (!paciente_nome && !data_nascimento && !celular) {
      return errorResponse('Informe pelo menos: paciente_nome, data_nascimento ou celular para busca');
    }

    let query = supabase
      .from('agendamentos')
      .select(`
        id,
        data_agendamento,
        hora_agendamento,
        status,
        observacoes,
        pacientes(nome_completo, data_nascimento, celular, convenio),
        medicos(nome, especialidade),
        atendimentos(nome, tipo)
      `)
      .eq('cliente_id', clienteId)
      .in('status', ['agendado', 'confirmado'])
      .gte('data_agendamento', new Date().toISOString().split('T')[0])
      .order('data_agendamento', { ascending: true });

    // Buscar por nome do paciente COM filtro de cliente
    if (paciente_nome) {
      const { data: pacientes } = await supabase
        .from('pacientes')
        .select('id')
        .ilike('nome_completo', `%${paciente_nome}%`)
        .eq('cliente_id', clienteId);

      if (pacientes && pacientes.length > 0) {
        const paciente_ids = pacientes.map((p: any) => p.id);
        query = query.in('paciente_id', paciente_ids);
      }
    }

    const { data: agendamentos, error } = await query;

    if (error) {
      return errorResponse(`Erro ao buscar agendamentos: ${error.message}`);
    }

    // Filtrar por data de nascimento ou celular se fornecidos
    let filteredAgendamentos = agendamentos || [];
    
    if (data_nascimento) {
      filteredAgendamentos = filteredAgendamentos.filter((a: any) =>
        a.pacientes?.data_nascimento === data_nascimento
      );
    }

    if (celular) {
      filteredAgendamentos = filteredAgendamentos.filter((a: any) => 
        a.pacientes?.celular?.includes(celular.replace(/\D/g, ''))
      );
    }

    if (filteredAgendamentos.length === 0) {
      return successResponse({
        message: 'Nenhuma consulta encontrada para este paciente',
        consultas: [],
        total: 0
      });
    }

    const consultas = filteredAgendamentos.map((a: any) => ({
      id: a.id,
      paciente: a.pacientes?.nome_completo,
      medico: a.medicos?.nome,
      especialidade: a.medicos?.especialidade,
      atendimento: a.atendimentos?.nome,
      data: a.data_agendamento,
      hora: a.hora_agendamento,
      status: a.status,
      convenio: a.pacientes?.convenio,
      observacoes: a.observacoes
    }));

    return successResponse({
      message: `${consultas.length} consulta(s) encontrada(s)`,
      consultas,
      total: consultas.length
    });

  } catch (error: any) {
    return errorResponse(`Erro ao verificar paciente: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Remarcar consulta
async function handleReschedule(supabase: any, body: any, clienteId: string) {
  try {
    console.log('🔄 Iniciando remarcação de consulta');
    console.log('📥 Dados recebidos:', JSON.stringify(body, null, 2));
    console.log('🏥 Cliente ID:', clienteId);
    
    const { agendamento_id, nova_data, nova_hora, observacoes } = body;

    // Validação detalhada
    const camposFaltando = [];
    if (!agendamento_id) camposFaltando.push('agendamento_id');
    if (!nova_data) camposFaltando.push('nova_data');
    if (!nova_hora) camposFaltando.push('nova_hora');
    
    if (camposFaltando.length > 0) {
      const erro = `Campos obrigatórios faltando: ${camposFaltando.join(', ')}`;
      console.error('❌ Validação falhou:', erro);
      console.error('📦 Body recebido:', body);
      return errorResponse(erro);
    }
    
    console.log('✅ Validação inicial OK');
    console.log(`📝 Remarcando agendamento ${agendamento_id} para ${nova_data} às ${nova_hora}`);

    // Verificar se agendamento existe COM filtro de cliente
    console.log(`🔍 Buscando agendamento ${agendamento_id}...`);
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        medico_id,
        data_agendamento,
        hora_agendamento,
        status,
        pacientes(nome_completo),
        medicos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError) {
      console.error('❌ Erro ao buscar agendamento:', checkError);
      return errorResponse(`Erro ao buscar agendamento: ${checkError.message}`);
    }
    
    if (!agendamento) {
      console.error('❌ Agendamento não encontrado');
      return errorResponse('Agendamento não encontrado');
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

    // Verificar disponibilidade do novo horário COM filtro de cliente
    console.log(`🔍 Verificando disponibilidade em ${nova_data} às ${nova_hora}...`);
    const { data: conflitos, error: conflitosError } = await supabase
      .from('agendamentos')
      .select('id, pacientes(nome_completo)')
      .eq('medico_id', agendamento.medico_id)
      .eq('data_agendamento', nova_data)
      .eq('hora_agendamento', nova_hora)
      .eq('cliente_id', clienteId)
      .in('status', ['agendado', 'confirmado'])
      .neq('id', agendamento_id);

    if (conflitosError) {
      console.error('❌ Erro ao verificar conflitos:', conflitosError);
    }

    if (conflitos && conflitos.length > 0) {
      console.error('❌ Horário já ocupado:', conflitos[0]);
      return errorResponse(`Horário já ocupado para este médico (${conflitos[0].pacientes?.nome_completo})`);
    }

    console.log('✅ Horário disponível');

    // Atualizar agendamento
    const updateData: any = {
      data_agendamento: nova_data,
      hora_agendamento: nova_hora,
      updated_at: new Date().toISOString()
    };

    if (observacoes) {
      updateData.observacoes = observacoes;
    }

    console.log('💾 Atualizando agendamento:', updateData);

    const { error: updateError } = await supabase
      .from('agendamentos')
      .update(updateData)
      .eq('id', agendamento_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError);
      return errorResponse(`Erro ao remarcar: ${updateError.message}`);
    }

    console.log('✅ Agendamento remarcado com sucesso!');

    // Mensagem personalizada para Dra. Adriana
    let mensagem = `Consulta remarcada com sucesso`;

    const isDraAdriana = agendamento.medico_id === '32d30887-b876-4502-bf04-e55d7fb55b50';

    if (isDraAdriana) {
      // Detectar período baseado no NOVO horário
      const [hora] = nova_hora.split(':').map(Number);
      
      let mensagemPeriodo = '';
      if (hora >= 8 && hora < 12) {
        // Manhã
        mensagemPeriodo = 'Das 08:00 às 10:00 para fazer a ficha. A Dra. começa a atender às 08:45';
      } else if (hora >= 13 && hora < 18) {
        // Tarde
        mensagemPeriodo = 'Das 13:00 às 15:00 para fazer a ficha. A Dra. começa a atender às 14:45';
      } else {
        // Fallback
        mensagemPeriodo = 'Compareça no horário agendado. A Dra. atende por ordem de chegada';
      }
      
      mensagem = `Remarcada! ${mensagemPeriodo}, por ordem de chegada. Caso o plano Unimed seja coparticipação ou particular, recebemos apenas em espécie. Posso ajudar em algo mais?`;
      console.log(`💬 Mensagem personalizada Dra. Adriana (período: ${hora >= 8 && hora < 12 ? 'manhã' : 'tarde'})`);
    }

    return successResponse({
      message: mensagem,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data_anterior: agendamento.data_agendamento,
      hora_anterior: agendamento.hora_agendamento,
      nova_data,
      nova_hora
    });

  } catch (error: any) {
    console.error('💥 Erro inesperado ao remarcar:', error);
    console.error('Stack:', error?.stack);
    return errorResponse(`Erro ao remarcar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Cancelar consulta
async function handleCancel(supabase: any, body: any, clienteId: string) {
  try {
    const { agendamento_id, motivo } = body;

    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Verificar se agendamento existe COM filtro de cliente
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        status,
        data_agendamento,
        hora_agendamento,
        observacoes,
        pacientes(nome_completo),
        medicos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    if (agendamento.status === 'cancelado') {
      return errorResponse('Consulta já está cancelada');
    }

    // Cancelar agendamento
    const observacoes_cancelamento = motivo 
      ? `${agendamento.observacoes || ''}\nCancelado via LLM Agent: ${motivo}`.trim()
      : `${agendamento.observacoes || ''}\nCancelado via LLM Agent`.trim();

    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        observacoes: observacoes_cancelamento,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamento_id);

    if (updateError) {
      return errorResponse(`Erro ao cancelar: ${updateError.message}`);
    }

    return successResponse({
      message: `Consulta cancelada com sucesso`,
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      medico: agendamento.medicos?.nome,
      data: agendamento.data_agendamento,
      hora: agendamento.hora_agendamento,
      motivo
    });

  } catch (error: any) {
    return errorResponse(`Erro ao cancelar consulta: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Confirmar consulta
async function handleConfirm(supabase: any, body: any, clienteId: string) {
  try {
    const { agendamento_id, observacoes } = body;

    // Validação
    if (!agendamento_id) {
      return errorResponse('Campo obrigatório: agendamento_id');
    }

    // Buscar agendamento
    const { data: agendamento, error: checkError } = await supabase
      .from('agendamentos')
      .select(`
        id,
        status,
        data_agendamento,
        hora_agendamento,
        observacoes,
        medico_id,
        pacientes(nome_completo, celular),
        medicos(nome)
      `)
      .eq('id', agendamento_id)
      .eq('cliente_id', clienteId)
      .single();

    if (checkError || !agendamento) {
      return errorResponse('Agendamento não encontrado');
    }

    // Validar status atual
    if (agendamento.status === 'cancelado') {
      return errorResponse('Não é possível confirmar consulta cancelada');
    }

    if (agendamento.status === 'confirmado') {
      return successResponse({
        message: 'Consulta já está confirmada',
        agendamento_id,
        paciente: agendamento.pacientes?.nome_completo,
        medico: agendamento.medicos?.nome,
        data: agendamento.data_agendamento,
        hora: agendamento.hora_agendamento,
        already_confirmed: true
      });
    }

    if (agendamento.status === 'realizado') {
      return errorResponse('Consulta já foi realizada');
    }

    // Validar se a data não passou
    const dataAgendamento = new Date(agendamento.data_agendamento + 'T' + agendamento.hora_agendamento);
    const agora = new Date();
    
    if (dataAgendamento < agora) {
      return errorResponse('Não é possível confirmar consulta que já passou');
    }

    // Preparar observações
    const observacoes_confirmacao = observacoes 
      ? `${agendamento.observacoes || ''}\nConfirmado via LLM Agent: ${observacoes}`.trim()
      : `${agendamento.observacoes || ''}\nConfirmado via LLM Agent WhatsApp`.trim();

    // Atualizar para confirmado
    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({
        status: 'confirmado',
        observacoes: observacoes_confirmacao,
        confirmado_em: new Date().toISOString(),
        confirmado_por: 'whatsapp_automatico',
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamento_id);

    if (updateError) {
      return errorResponse(`Erro ao confirmar: ${updateError.message}`);
    }

    console.log(`✅ Agendamento ${agendamento_id} confirmado com sucesso`);

    return successResponse({
      message: 'Consulta confirmada com sucesso',
      agendamento_id,
      paciente: agendamento.pacientes?.nome_completo,
      celular: agendamento.pacientes?.celular,
      medico: agendamento.medicos?.nome,
      data: agendamento.data_agendamento,
      hora: agendamento.hora_agendamento,
      status: 'confirmado',
      confirmado_em: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao confirmar agendamento:', error);
    return errorResponse(`Erro ao confirmar: ${error?.message || 'Erro desconhecido'}`);
  }
}

// Verificar disponibilidade de horários
async function handleAvailability(supabase: any, body: any, clienteId: string) {
  try {
    console.log('📅 [RAW] Dados recebidos do N8N:', JSON.stringify(body, null, 2));
    
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
    
    // Aplicar sanitização
    medico_nome = sanitizeValue(medico_nome);
    medico_id = sanitizeValue(medico_id);
    atendimento_nome = sanitizeValue(atendimento_nome);
    data_consulta = sanitizeValue(data_consulta);
    
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
        return errorResponse(`Formato de data inválido: "${data_consulta}". Use YYYY-MM-DD (ex: 2026-01-20) ou DD/MM/YYYY (ex: 20/01/2026)`);
      }
    }
    
    // ✅ LÓGICA INTELIGENTE: Se for noite, buscar a partir de AMANHÃ
    const { data: dataAtual, hora: horaAtual, horarioEmMinutos: horarioAtualEmMinutos } = getDataHoraAtualBrasil();

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
      
      if (dataConsulta < hoje && diferencaDias > 90) {
        // Só ajusta se for REALMENTE passado (mais de 90 dias no passado)
        // Isso evita ajustar datas futuras que o usuário especificou explicitamente
        if (horaAtual >= 18) {
          const amanha = new Date(dataAtual + 'T00:00:00');
          amanha.setDate(amanha.getDate() + 1);
          data_consulta = amanha.toISOString().split('T')[0];
          console.log(`⚠️ Data muito antiga detectada (${diferencaDias} dias no passado) E horário noturno (${horaAtual}h). Ajustando para AMANHÃ: ${data_consulta}`);
        } else {
          data_consulta = dataAtual;
          console.log(`⚠️ Data muito antiga detectada (${diferencaDias} dias no passado). Ajustando para HOJE: ${data_consulta}`);
        }
      } else if (dataConsulta >= hoje) {
        console.log(`📅 Ponto de partida da busca: ${data_consulta} (data futura fornecida pelo usuário)`);
      } else {
        // Data está no passado mas há menos de 90 dias - respeitar a escolha do usuário
        console.log(`⚠️ Data ${diferencaDias} dias no passado, mas será respeitada como ponto de partida (${data_consulta})`);
      }
    }
    
    console.log('✅ [SANITIZADO] Dados processados:', { 
      medico_nome, 
      medico_id, 
      data_consulta, 
      atendimento_nome, 
      dias_busca 
    });
    
    // 💬 LOGGING: Mensagem original do paciente (se fornecida)
    if (mensagem_original) {
      console.log('💬 Mensagem original do paciente:', mensagem_original);
    }
    
    // ✅ Validar campos obrigatórios
    if (!atendimento_nome || atendimento_nome.trim() === '') {
      return errorResponse('Campo obrigatório: atendimento_nome (ex: "Consulta Cardiológica", "Colonoscopia")');
    }
    
    if (!medico_nome && !medico_id) {
      return errorResponse('É necessário informar medico_nome OU medico_id');
    }
    
    // 🔍 Buscar médico COM busca inteligente (aceita nomes parciais) - MOVIDO PARA ANTES DE USAR
    let medico;
    if (medico_id) {
      // Busca por ID (exata)
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .eq('id', medico_id)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .single();
      
      medico = data;
      if (error || !medico) {
        console.error(`❌ Médico ID não encontrado: ${medico_id}`, error);
        return errorResponse(`Médico com ID "${medico_id}" não encontrado ou inativo`);
      }
      console.log(`✅ Médico encontrado por ID: ${medico.nome}`);
      
    } else {
      // 🔍 BUSCA SUPER INTELIGENTE POR NOME:
      console.log(`🔍 Buscando médico: "${medico_nome}"`);
      
      // Buscar TODOS os médicos ativos
      const { data: todosMedicos, error } = await supabase
        .from('medicos')
        .select('id, nome, ativo')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      
      if (error) {
        console.error('❌ Erro ao buscar médicos:', error);
        return errorResponse(`Erro ao buscar médicos: ${error.message}`);
      }
      
      if (!todosMedicos || todosMedicos.length === 0) {
        return errorResponse('Nenhum médico ativo cadastrado no sistema');
      }
      
      // Função auxiliar: normalizar texto para comparação (sem pontuação, tudo minúsculo)
      const normalizar = (texto: string) => 
        texto.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[.,\-']/g, '') // Remove pontuação
          .replace(/\s+/g, ' ') // Normaliza espaços
          .trim();
      
      const nomeNormalizado = normalizar(medico_nome);
      console.log(`🔍 Nome normalizado para busca: "${nomeNormalizado}"`);
      
      // Procurar médico que contenha o nome buscado
      const medicosEncontrados = todosMedicos.filter(m => {
        const nomeCompletoNormalizado = normalizar(m.nome);
        return nomeCompletoNormalizado.includes(nomeNormalizado);
      });
      
      if (medicosEncontrados.length === 0) {
        console.error(`❌ Nenhum médico encontrado para: "${medico_nome}"`);
        const sugestoes = todosMedicos.map(m => m.nome).slice(0, 10).join(', ');
        return errorResponse(
          `Médico "${medico_nome}" não encontrado. Médicos disponíveis: ${sugestoes}`
        );
      }
      
      if (medicosEncontrados.length > 1) {
        console.warn(`⚠️ Múltiplos médicos encontrados para "${medico_nome}":`, 
          medicosEncontrados.map(m => m.nome).join(', '));
      }
      
      medico = medicosEncontrados[0];
      console.log(`✅ Médico encontrado: "${medico_nome}" → "${medico.nome}"`);
    }
    
    // 🔍 BUSCAR REGRAS DE NEGÓCIO E CONFIGURAÇÃO DO SERVIÇO (declarar uma única vez)
    let regras = BUSINESS_RULES.medicos[medico.id];
    let servicoKey = Object.keys(regras?.servicos || {}).find(s => 
      s.toLowerCase().includes(atendimento_nome.toLowerCase()) ||
      atendimento_nome.toLowerCase().includes(s.toLowerCase())
    );
    let servico = servicoKey ? regras.servicos[servicoKey] : null;
    
    // Não retornar erro ainda - busca melhorada será feita depois se necessário
    
    const tipoAtendimento = servico?.tipo || regras?.tipo_agendamento || 'ordem_chegada';
    console.log(`📋 [${medico.nome}] Tipo: ${tipoAtendimento} | Serviço: ${servicoKey || 'não encontrado ainda'}`);
    
    // 🧠 ANÁLISE DE CONTEXTO: Usar mensagem original para inferir intenção
    let isPerguntaAberta = false;
    let periodoPreferido: 'manha' | 'tarde' | null = null;
    let diaPreferido: number | null = null; // 1=seg, 2=ter, 3=qua, 4=qui, 5=sex
    
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
      
      // 🎫 LÓGICA PARA ORDEM DE CHEGADA (todos os médicos)
      console.log('🎫 Buscando períodos disponíveis (ordem de chegada)...');
      
      for (let diasAdiantados = 1; diasAdiantados <= quantidade_dias; diasAdiantados++) {
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
        
        // Verificar se dia permitido pelo serviço
        if (servico?.dias_semana && !servico.dias_semana.includes(diaSemanaNum)) {
          continue;
        }
        
        const periodosDisponiveis = [];
        
      // ☀️ VERIFICAR MANHÃ (pular se paciente quer apenas tarde)
      if (servico?.periodos?.manha && periodoPreferido !== 'tarde') {
          const manha = servico.periodos.manha;
          const diaPermitido = !manha.dias_especificos || manha.dias_especificos.includes(diaSemanaNum);
          
          if (diaPermitido) {
            const { data: agendados } = await supabase
              .from('agendamentos')
              .select('id')
              .eq('medico_id', medico.id)
              .eq('data_agendamento', dataCheckStr)
              .eq('cliente_id', clienteId)
              .gte('hora_agendamento', manha.inicio)
              .lte('hora_agendamento', manha.fim)
              .is('excluido_em', null)
              .in('status', ['agendado', 'confirmado']);
            
            const ocupadas = agendados?.length || 0;
            const disponiveis = manha.limite - ocupadas;
            
            if (disponiveis > 0) {
              periodosDisponiveis.push({
                periodo: 'Manhã',
                horario_distribuicao: manha.distribuicao_fichas || `${manha.inicio} às ${manha.fim}`,
                vagas_disponiveis: disponiveis,
                limite_total: manha.limite,
                tipo: 'ordem_chegada'
              });
            }
          }
        }
        
      // 🌙 VERIFICAR TARDE (pular se paciente quer apenas manhã)
      if (servico?.periodos?.tarde && periodoPreferido !== 'manha') {
          const tarde = servico.periodos.tarde;
          const diaPermitido = !tarde.dias_especificos || tarde.dias_especificos.includes(diaSemanaNum);
          
          if (diaPermitido) {
            const { data: agendados } = await supabase
              .from('agendamentos')
              .select('id')
              .eq('medico_id', medico.id)
              .eq('data_agendamento', dataCheckStr)
              .eq('cliente_id', clienteId)
              .gte('hora_agendamento', tarde.inicio)
              .lte('hora_agendamento', tarde.fim)
              .is('excluido_em', null)
              .in('status', ['agendado', 'confirmado']);
            
            const ocupadas = agendados?.length || 0;
            const disponiveis = tarde.limite - ocupadas;
            
            if (disponiveis > 0) {
              periodosDisponiveis.push({
                periodo: 'Tarde',
                horario_distribuicao: tarde.distribuicao_fichas || `${tarde.inicio} às ${tarde.fim}`,
                vagas_disponiveis: disponiveis,
                limite_total: tarde.limite,
                tipo: 'ordem_chegada'
              });
            }
          }
        }
        
        // Adicionar data se tiver períodos disponíveis
        if (periodosDisponiveis.length > 0) {
          const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          proximasDatas.push({
            data: dataCheckStr,
            dia_semana: diasSemana[diaSemanaNum],
            periodos: periodosDisponiveis
          });
        }
        
        // Encontrar datas suficientes (mais quando há período específico)
        const datasNecessarias = periodoPreferido ? 5 : 3;
        if (proximasDatas.length >= datasNecessarias) break;
      }
      
      // 🔄 RETRY AUTOMÁTICO: Se não encontrou vagas e ainda não buscou 45 dias, ampliar
      if (proximasDatas.length === 0 && quantidade_dias < 45) {
        console.log(`⚠️ Nenhuma data encontrada em ${quantidade_dias} dias. Ampliando busca para 45 dias...`);
        quantidade_dias = 45;
        
        // 🔁 REPETIR O LOOP DE BUSCA com 45 dias
        for (let diasAdiantados = 1; diasAdiantados <= quantidade_dias; diasAdiantados++) {
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
      
      // 🚫 SE AINDA NÃO ENCONTROU NADA após 45 dias, retornar erro claro
      if (proximasDatas.length === 0) {
        const mensagemSemVagas = 
          `😔 Não encontrei vagas disponíveis para ${medico.nome} nos próximos 45 dias.\n\n` +
          `📞 Por favor, ligue para (87) 3866-4050 para:\n` +
          `• Entrar na fila de espera\n` +
          `• Verificar outras opções\n` +
          `• Consultar disponibilidade futura`;
        
        console.log('❌ Nenhuma data disponível mesmo após buscar 45 dias');
        
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
        message: `${proximasDatas.length} datas disponíveis encontradas`,
        medico: medico.nome,
        medico_id: medico.id,
        tipo_atendimento: 'ordem_chegada',
        proximas_datas: proximasDatas,
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
    if (!regras) regras = BUSINESS_RULES.medicos[medico.id];
    if (!regras) {
      console.error(`❌ Regras não encontradas para médico ${medico.nome} (ID: ${medico.id})`);
      console.error(`📋 IDs disponíveis nas BUSINESS_RULES:`, Object.keys(BUSINESS_RULES.medicos));
      return errorResponse(`Regras de atendimento não configuradas para ${medico.nome}`);
    }
    console.log(`✅ Regras encontradas para ${regras.nome}`);

    // Buscar serviço nas regras com matching inteligente MELHORADO (só se ainda não encontrado)
    if (!servicoKey) {
      const servicoKeyMelhorado = Object.keys(regras.servicos || {}).find(s => {
      const servicoLower = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
      const atendimentoLower = atendimento_nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // Match exato (sem acentos)
      if (servicoLower === atendimentoLower) return true;
      
      // Match bidirecional (contém)
      if (servicoLower.includes(atendimentoLower) || atendimentoLower.includes(servicoLower)) {
        return true;
      }
      
      // 🆕 MELHORADO: Match por keywords com variações de grafia
      const keywords: Record<string, string[]> = {
        'endocrinologica': ['endocrino', 'endocrinologia', 'endocrinologista', 'consulta endocrino', 'consulta endocrinologista'],
        'cardiologica': ['cardio', 'cardiologia', 'cardiologista', 'consulta cardio', 'consulta cardiologista'],
        'ergometrico': ['ergo', 'ergometrico', 'teste ergo'],
        'ecocardiograma': ['eco', 'ecocardio'],
        'ultrassom': ['ultra', 'ultrassonografia']
      };
      
      for (const [base, aliases] of Object.entries(keywords)) {
        if (servicoLower.includes(base)) {
          return aliases.some(alias => atendimentoLower.includes(alias));
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
      return errorResponse(
        `Serviço "${atendimento_nome}" não encontrado para ${medico.nome}. Serviços disponíveis: ${Object.keys(regras.servicos || {}).join(', ')}`
      );
    }

    // Reutilizar/atualizar variável servico já declarada
    if (!servico && servicoKey) {
      servico = regras.servicos[servicoKey];
      console.log(`✅ Serviço encontrado na busca melhorada: ${servicoKey}`);
    }
    
    // Validar se encontrou o serviço
    if (!servico || !servicoKey) {
      console.error(`❌ ERRO FINAL: Serviço não encontrado após todas as tentativas`);
      return errorResponse(
        `Serviço "${atendimento_nome}" não encontrado para ${medico.nome}. Serviços disponíveis: ${Object.keys(regras.servicos || {}).join(', ')}`
      );
    }

    // Verificar se permite agendamento online
    if (!servico.permite_online) {
      console.log(`ℹ️ Serviço ${servicoKey} não permite agendamento online`);
      return successResponse({
        permite_online: false,
        medico: medico.nome,
        servico: servicoKey,
        message: servico.mensagem || 'Este serviço não pode ser agendado online.'
      });
    }

    // 🆕 SE NÃO FOI FORNECIDA DATA ESPECÍFICA, BUSCAR PRÓXIMAS DATAS DISPONÍVEIS
    if (!data_consulta) {
      const tipoAtendimento = servico.tipo || regras.tipo_agendamento || 'ordem_chegada';
      const proximasDatas = [];
      
      // Capturar datetime atual COMPLETO (com hora e minuto)
      const agora = new Date();
      const horaAtual = agora.getHours();
      const minutoAtual = agora.getMinutes();
      
      // Criar cópia apenas para comparação de datas
      const hoje = new Date(agora);
      hoje.setHours(0, 0, 0, 0);
      
      console.log(`🔍 Buscando próximas datas disponíveis a partir de ${agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (próximos ${dias_busca} dias)...`);
      
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
          
          if (ehHoje) {
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

      if (proximasDatas.length === 0) {
        return errorResponse(`Não encontrei datas disponíveis para ${medico.nome} nos próximos ${dias_busca} dias. Por favor, entre em contato com a clínica.`);
      }

      // 🆕 MENSAGEM CONTEXTUAL baseada na disponibilidade
      let mensagemInicial = '';
      
      if (proximasDatas.length === 1) {
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
        contexto: {
          medico_id: medico.id,
          medico_nome: medico.nome,
          servico: atendimento_nome,
          periodo_solicitado: periodoPreferido,
          dias_buscados: quantidade_dias
        }
      });
    }

    // 🎯 COMPORTAMENTO ORIGINAL: VERIFICAR DATA ESPECÍFICA
    // Verificar dia da semana permitido
    const diaSemana = getDiaSemana(data_consulta);
    const diasNomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    
    if (servico.dias_semana && !servico.dias_semana.includes(diaSemana)) {
      const diasPermitidos = servico.dias_semana.map((d: number) => diasNomes[d]).join(', ');
      return errorResponse(
        `${medico.nome} não atende ${servicoKey} neste dia. Dias disponíveis: ${diasPermitidos}`
      );
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
      return successResponse({
        disponivel: false,
        bloqueada: true,
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        motivo_bloqueio: bloqueios[0].motivo,
        message: `A agenda do(a) ${medico.nome} está bloqueada em ${data_consulta}. Motivo: ${bloqueios[0].motivo}. Por favor, escolha outra data.`
      });
    }

    // 🎯 TIPO DE ATENDIMENTO JÁ DETECTADO (linha 1247)
    console.log(`📋 Tipo de atendimento: ${tipoAtendimento} (já detectado anteriormente)`);

    // Contar agendamentos existentes para cada período
    const periodosDisponiveis = [];
    
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
      
      if (ehHoje) {
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

    if (periodosDisponiveis.length === 0) {
      return errorResponse(`${medico.nome} não atende ${servicoKey} na data ${data_consulta}`);
    }

    // 🎯 RESPOSTA DIFERENCIADA POR TIPO DE ATENDIMENTO

    if (tipoAtendimento === 'ordem_chegada') {
      // ✅ ORDEM DE CHEGADA - NÃO retorna horários específicos
      console.log('✅ Retornando disponibilidade por ORDEM DE CHEGADA');
      
      const temVagas = periodosDisponiveis.some(p => p.disponivel);
      const mensagem = temVagas
        ? `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
          periodosDisponiveis.filter(p => p.disponivel).map(p => 
            `${p.periodo}: ${p.vagas_disponiveis} vaga(s) disponível(is) de ${p.total_vagas}\n` +
            `Distribuição: ${p.horario_distribuicao}`
          ).join('\n\n') +
          '\n\n⚠️ ORDEM DE CHEGADA: Não há horário marcado. Paciente deve chegar no período para pegar ficha.'
        : `❌ Sem vagas disponíveis para ${medico.nome} em ${data_consulta}`;
      
      return successResponse({
        disponivel: temVagas,
        tipo_agendamento: 'ordem_chegada',
        medico: medico.nome,
        servico: servicoKey,
        data: data_consulta,
        periodos: periodosDisponiveis,
        mensagem_whatsapp: mensagem,
        message: mensagem
      });
    } else {
      // ✅ HORA MARCADA - retorna slots específicos
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
        
        while (horaAtual < horaLimite) {
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

      const mensagem = horariosDisponiveis.length > 0
        ? `✅ ${medico.nome} - ${servicoKey}\n📅 ${data_consulta}\n\n` +
          `${horariosDisponiveis.length} horários disponíveis:\n` +
          horariosDisponiveis.map(h => `• ${h.hora}`).join('\n')
        : `❌ Sem horários disponíveis para ${medico.nome} em ${data_consulta}`;
      
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
    
    return errorResponse(
      `Erro ao verificar disponibilidade: ${error?.message || 'Erro desconhecido'}. ` +
      `Verifique os logs para mais detalhes.`
    );
  }
}

// Buscar pacientes
async function handlePatientSearch(supabase: any, body: any, clienteId: string) {
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

// Funções auxiliares
function successResponse(data: any) {
  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
