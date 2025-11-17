import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚨 MIGRAÇÃO DE SISTEMA - Data mínima para agendamentos
const MINIMUM_BOOKING_DATE = '2026-01-01';
const MIGRATION_PHONE = '(87) 3866-4050';
const MIGRATION_MESSAGES = {
  date_blocked: `Agendamentos disponíveis a partir de janeiro/2026. Para datas anteriores, entre em contato pelo telefone: ${MIGRATION_PHONE}`,
  old_appointments: `Não encontrei agendamentos no sistema novo. Se sua consulta é anterior a janeiro/2026, os dados estão no sistema anterior. Entre em contato: ${MIGRATION_PHONE}`,
  no_availability: `Não há vagas disponíveis antes de janeiro/2026. Para consultas anteriores a esta data, ligue: ${MIGRATION_PHONE}`
};

/**
 * Gera mensagem de bloqueio de migração personalizada por médico
 * @param medicoNome - Nome do médico (ex: "Dra. Adriana Carla de Sena")
 * @returns Mensagem personalizada ou genérica
 */
function getMigrationBlockMessage(medicoNome?: string): string {
  // Normalizar nome do médico (remover acentos, minúsculas, apenas palavras-chave)
  const nomeNormalizado = medicoNome
    ?.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim() || '';

  // Detectar se é Dra. Adriana (várias variações possíveis)
  const isDraAdriana = 
    nomeNormalizado.includes('adriana') || 
    nomeNormalizado.includes('adriana carla') ||
    nomeNormalizado.includes('dra. adriana') ||
    nomeNormalizado.includes('dra adriana');

  if (isDraAdriana) {
    return `O(a) paciente pode tentar um encaixe com a Dra. Adriana por ligação normal nesse mesmo número ${MIGRATION_PHONE} (não atendemos ligação via whatsapp), de segunda a sexta-feira, às 10:00h, ou nas terças e quartas-feiras, às 14:30h`;
  }

  // Mensagem genérica para outros médicos
  return `Agendamentos disponíveis a partir de janeiro/2026. Para datas anteriores, entre em contato pelo telefone: ${MIGRATION_PHONE}`;
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

/**
 * Busca o próximo horário livre no mesmo dia e período (incremento de 1 minuto)
 * @returns { horario: string, tentativas: number } ou null se período lotado
 */
async function buscarProximoHorarioLivre(
  supabase: any,
  clienteId: string,
  medicoId: string,
  dataConsulta: string,
  horarioInicial: string, // ex: "08:00:00"
  periodoConfig: { inicio: string, fim: string, limite: number }
): Promise<{ horario: string, tentativas: number } | null> {
  
  const [horaInicio, minInicio] = periodoConfig.inicio.split(':').map(Number);
  const [horaFim, minFim] = periodoConfig.fim.split(':').map(Number);
  
  // Converter para minutos desde meia-noite
  const minutoInicio = horaInicio * 60 + minInicio;
  const minutoFim = horaFim * 60 + minFim;
  
  // Buscar TODOS os agendamentos do dia para esse médico
  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('hora_agendamento')
    .eq('medico_id', medicoId)
    .eq('data_agendamento', dataConsulta)
    .eq('cliente_id', clienteId)
    .in('status', ['agendado', 'confirmado']);
  
  // Verificar se já atingiu o limite de vagas
  if (agendamentos && agendamentos.length >= periodoConfig.limite) {
    console.log(`❌ Período lotado: ${agendamentos.length}/${periodoConfig.limite} vagas ocupadas`);
    return null;
  }
  
  console.log(`✅ Vagas disponíveis no período: ${agendamentos?.length || 0}/${periodoConfig.limite}`);
  
  // Criar Set de horários ocupados para busca rápida (formato HH:MM)
  const horariosOcupados = new Set(
    agendamentos?.map(a => a.hora_agendamento.substring(0, 5)) || []
  );
  
  // Começar do horário inicial e buscar de 1 em 1 minuto
  let tentativas = 0;
  
  for (let minuto = minutoInicio; minuto < minutoFim; minuto++) {
    tentativas++;
    const hora = Math.floor(minuto / 60);
    const min = minuto % 60;
    const horarioTeste = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    
    if (!horariosOcupados.has(horarioTeste)) {
      console.log(`✅ Horário livre encontrado: ${horarioTeste} (após ${tentativas} tentativas)`);
      return { horario: horarioTeste + ':00', tentativas };
    }
  }
  
  console.log(`❌ Nenhum horário livre encontrado após ${tentativas} tentativas`);
  return null;
}

// Função auxiliar para obter dia da semana (0=dom, 1=seg, ...)
// ✅ CORRIGIDO: Forçar interpretação local da data (evitar deslocamento UTC)
function getDiaSemana(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay(); // Mês é 0-indexed
}

// ============= FUNÇÕES DE NORMALIZAÇÃO DE DADOS =============

/**
 * Normaliza data de nascimento de vários formatos para YYYY-MM-DD
 * Aceita: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD
 */
function normalizarDataNascimento(data: string | null | undefined): string | null {
  if (!data) return null;
  
  const limpo = data.trim();
  
  // Já está no formato correto YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) {
    return limpo;
  }
  
  // Formato DD/MM/YYYY ou DD-MM-YYYY
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(limpo)) {
    const [dia, mes, ano] = limpo.split(/[\/\-]/);
    return `${ano}-${mes}-${dia}`;
  }
  
  // Formato YYYY/MM/DD
  if (/^\d{4}[\/]\d{2}[\/]\d{2}$/.test(limpo)) {
    return limpo.replace(/\//g, '-');
  }
  
  console.warn(`⚠️ Formato de data_nascimento não reconhecido: "${data}"`);
  return null;
}

/**
 * Normaliza número de telefone/celular
 * Remove todos os caracteres não numéricos
 * Aceita: (87) 9 9123-4567, 87991234567, +55 87 99123-4567
 */
function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  
  // Remover tudo que não é número
  const apenasNumeros = telefone.replace(/\D/g, '');
  
  // Remover código do país (+55) se presente
  if (apenasNumeros.startsWith('55') && apenasNumeros.length > 11) {
    return apenasNumeros.substring(2);
  }
  
  return apenasNumeros;
}

/**
 * Normaliza nome do paciente
 * Remove espaços extras e capitaliza corretamente
 */
function normalizarNome(nome: string | null | undefined): string | null {
  if (!nome) return null;
  
  return nome
    .trim()
    .replace(/\s+/g, ' ') // Remove espaços duplicados
    .toUpperCase();
}

/**
 * 🛡️ Sanitiza valores inválidos vindos do N8N/LLM
 * Converte: "indefinido", "undefined", "null", "", "None" → undefined
 */
function sanitizarCampoOpcional(valor: any): any {
  if (valor === null || valor === undefined) return undefined;
  
  if (typeof valor === 'string') {
    const valorTrim = valor.trim().toLowerCase();
    
    // Lista de valores inválidos comuns
    const valoresInvalidos = [
      'indefinido', 'undefined', 'null', 'none', 
      'n/a', 'na', '', 'empty'
    ];
    
    if (valoresInvalidos.includes(valorTrim)) {
      console.log(`🧹 Campo com valor inválido "${valor}" convertido para undefined`);
      return undefined;
    }
  }
  
  return valor;
}

// Função para mapear dados flexivelmente
function mapSchedulingData(body: any) {
  const mapped = {
    // Nome do paciente - aceitar diferentes formatos e normalizar
    paciente_nome: normalizarNome(
      body.paciente_nome || body.nome_paciente || body.nome_completo || body.patient_name
    ),
    
    // Data de nascimento - aceitar diferentes formatos e normalizar
    data_nascimento: normalizarDataNascimento(
      body.data_nascimento || body.paciente_nascimento || body.birth_date || body.nascimento
    ),
    
    // Convênio
    convenio: body.convenio || body.insurance || body.plano_saude,
    
    // Telefones - normalizar
    telefone: normalizarTelefone(body.telefone || body.phone || body.telefone_fixo),
    celular: normalizarTelefone(body.celular || body.mobile || body.whatsapp || body.telefone_celular),
    
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
  
  // Log para debug (sem dados sensíveis completos)
  console.log('📝 Dados normalizados:', {
    paciente_nome: mapped.paciente_nome ? '✓' : '✗',
    data_nascimento: mapped.data_nascimento,
    celular: mapped.celular ? `${mapped.celular.substring(0, 4)}****` : '✗',
    telefone: mapped.telefone ? `${mapped.telefone.substring(0, 4)}****` : '✗',
  });
  
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
        case 'list-appointments':
          return await handleListAppointments(supabase, body, CLIENTE_ID);
        default:
          return errorResponse('Ação não reconhecida. Ações disponíveis: schedule, check-patient, reschedule, cancel, availability, patient-search, list-appointments');
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
    
    // 🆕 Aplicar sanitização robusta em campos opcionais
    const robustSanitizedBody = {
      ...sanitizedBody,
      data_nascimento: sanitizarCampoOpcional(sanitizedBody.data_nascimento),
      telefone: sanitizarCampoOpcional(sanitizedBody.telefone),
      celular: sanitizarCampoOpcional(sanitizedBody.celular)
    };
    
    // Mapear dados flexivelmente (aceitar diferentes formatos)
    const mappedData = mapSchedulingData(robustSanitizedBody);
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
      
      return businessErrorResponse({
        codigo_erro: 'DADOS_INCOMPLETOS',
        mensagem_usuario: `❌ Faltam informações obrigatórias para o agendamento:\n\n${missingFields.map(f => `   • ${f}`).join('\n')}\n\n💡 Por favor, forneça todos os dados necessários.`,
        detalhes: {
          campos_faltando: missingFields
        }
      });
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
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico com ID "${medico_id}" não foi encontrado ou está inativo.\n\n💡 Verifique se o código do médico está correto ou entre em contato com a clínica.`,
          detalhes: { medico_id }
        });
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
        return businessErrorResponse({
          codigo_erro: 'MEDICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ Médico "${medico_nome}" não foi encontrado ou está inativo.\n\n💡 Verifique o nome do médico ou entre em contato com a clínica para confirmar a disponibilidade.`,
          detalhes: { medico_nome }
        });
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
            return businessErrorResponse({
              codigo_erro: 'IDADE_INCOMPATIVEL',
              mensagem_usuario: `❌ ${regras.nome} atende apenas pacientes com ${regras.idade_minima}+ anos.\n\n📋 Idade informada: ${idade} anos\n\n💡 Por favor, consulte outro profissional adequado para a faixa etária.`,
              detalhes: {
                medico: regras.nome,
                idade_minima: regras.idade_minima,
                idade_paciente: idade
              }
            });
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
              
              // ⚠️ MIGRAÇÃO: Bloquear agendamentos antes de janeiro/2026
              if (data_consulta && data_consulta < MINIMUM_BOOKING_DATE) {
                console.log(`🚫 Tentativa de agendar antes da data mínima: ${data_consulta}`);
                return new Response(JSON.stringify({
                  success: false,
                  error: 'DATA_BLOQUEADA',
                  message: getMigrationBlockMessage(medico_nome),
                  data_solicitada: data_consulta,
                  data_minima: MINIMUM_BOOKING_DATE,
                  timestamp: new Date().toISOString()
                }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
              
              // 2.1 Verificar se permite agendamento online
              if (!servicoLocal.permite_online) {
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
                  const { data: agendamentos, error: agendError } = await supabase
                    .from('agendamentos')
                    .select('id')
                    .eq('medico_id', medico.id)
                    .eq('data_agendamento', data_consulta)
                    .eq('cliente_id', clienteId)
                    .is('excluido_em', null)
                    .is('cancelado_em', null)
                    .in('status', ['agendado', 'confirmado']);
                  
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
                          
                          // Verificar se está dentro do período permitido
                          if (dataFuturaStr < MINIMUM_BOOKING_DATE) {
                            console.log(`⏭️  Pulando ${dataFuturaStr} (antes da data mínima ${MINIMUM_BOOKING_DATE})`);
                            continue;
                          }
                          
                          // ✅ Buscar TODOS os agendamentos para qualquer atendimento deste médico
                          const { data: agendadosFuturos, error: errorFuturo } = await supabase
                            .from('agendamentos')
                            .select('id, atendimento_id, hora_agendamento')
                            .eq('medico_id', medico.id)
                            .eq('data_agendamento', dataFuturaStr)
                            .eq('cliente_id', clienteId)
                            .is('excluido_em', null)
                            .is('cancelado_em', null)
                            .in('status', ['agendado', 'confirmado']);
                          
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
        
        return businessErrorResponse({
          codigo_erro: 'SERVICO_NAO_ENCONTRADO',
          mensagem_usuario: `❌ O serviço "${atendimento_nome}" não foi encontrado para ${medico.nome}.\n\n✅ Serviços disponíveis:\n${atendimentosDisponiveis?.map(a => `   • ${a.nome} (${a.tipo})`).join('\n') || '   (nenhum cadastrado)'}\n\n💡 Escolha um dos serviços disponíveis acima.`,
          detalhes: {
            servico_solicitado: atendimento_nome,
            medico: medico.nome,
            servicos_disponiveis: atendimentosDisponiveis || []
          }
        });
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
      
      // 🆕 SE FOR CONFLITO DE HORÁRIO, TENTAR ALOCAR AUTOMATICAMENTE
      if (result?.error === 'CONFLICT') {
        console.log('🔄 Conflito detectado, tentando alocação automática...');
        
        // Determinar período baseado no horário solicitado
        const [hora] = hora_consulta.split(':').map(Number);
        let periodoConfig = null;
        let nomePeriodo = '';
        
        // Buscar regras do médico
        const regrasMedico = BUSINESS_RULES.medicos[medico.id];
        if (regrasMedico) {
          // Pegar primeiro serviço (já validamos que existe anteriormente)
          const servicoKey = Object.keys(regrasMedico.servicos)[0];
          const servico = regrasMedico.servicos[servicoKey];
          
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
        
        // Se encontrou período válido, tentar buscar horário livre
        if (periodoConfig) {
          console.log(`📋 Período detectado: ${nomePeriodo} (${periodoConfig.inicio}-${periodoConfig.fim}, limite: ${periodoConfig.limite})`);
          
          const resultado = await buscarProximoHorarioLivre(
            supabase,
            clienteId,
            medico.id,
            data_consulta,
            hora_consulta,
            periodoConfig
          );
          
          if (resultado) {
            console.log(`🎯 Tentando alocar em ${resultado.horario}...`);
            
            // Tentar criar agendamento no novo horário
            const { data: novoResult, error: novoError } = await supabase
              .rpc('criar_agendamento_atomico_externo', {
                p_cliente_id: clienteId,
                p_nome_completo: paciente_nome.toUpperCase(),
                p_data_nascimento: data_nascimento,
                p_convenio: convenio,
                p_telefone: telefone || null,
                p_celular: celular,
                p_medico_id: medico.id,
                p_atendimento_id: atendimento_id,
                p_data_agendamento: data_consulta,
                p_hora_agendamento: resultado.horario,
                p_observacoes: (observacoes || 'Agendamento via LLM Agent WhatsApp - Alocado automaticamente').toUpperCase(),
                p_criado_por: 'LLM Agent WhatsApp',
                p_force_conflict: false
              });
            
            if (!novoError && novoResult?.success) {
              console.log(`✅ Alocado com sucesso em ${resultado.horario}`);
              
              // Gerar mensagem personalizada
              const isDraAdriana = medico.id === '32d30887-b876-4502-bf04-e55d7fb55b50';
              let mensagem = `Consulta agendada com sucesso para ${paciente_nome}`;
              
              if (isDraAdriana) {
                const mensagemPeriodo = nomePeriodo === 'manhã'
                  ? 'Das 08:00 às 10:00 para fazer a ficha. A Dra. começa a atender às 08:45'
                  : 'Das 13:00 às 15:00 para fazer a ficha. A Dra. começa a atender às 14:45';
                
                mensagem = `Agendada! ${mensagemPeriodo}, por ordem de chegada. Caso o plano Unimed seja coparticipação ou particular, recebemos apenas em espécie. Posso ajudar em algo mais?`;
              }
              
              return successResponse({
                message: mensagem,
                agendamento_id: novoResult.agendamento_id,
                paciente_id: novoResult.paciente_id,
                data: data_consulta,
                horario_solicitado: hora_consulta,
                horario_alocado: resultado.horario,
                medico: medico.nome,
                atendimento: atendimento_nome || 'Consulta',
                observacao: `Horário ${hora_consulta} estava ocupado. Alocado automaticamente em ${resultado.horario} (${nomePeriodo})`,
                alocacao_automatica: true
              });
            }
          }
          
          // Se chegou aqui, período está lotado
          console.log(`❌ Período ${nomePeriodo} está lotado (${periodoConfig.limite} vagas)`);
          return new Response(JSON.stringify({
            success: false,
            error: 'PERIOD_FULL',
            message: `O período da ${nomePeriodo} está com todas as vagas ocupadas (${periodoConfig.limite}/${periodoConfig.limite}). Por favor, escolha outro período ou outro dia.`,
            detalhes: {
              periodo: nomePeriodo,
              vagas_total: periodoConfig.limite,
              data_solicitada: data_consulta
            },
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Para outros erros, manter comportamento original
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

// 🔧 CONSOLIDAÇÃO DE PACIENTES: Agrupa duplicatas e retorna registro único + todos IDs
interface ConsolidatedPatient {
  id: string;
  all_ids: string[]; // TODOS os IDs de duplicatas para buscar agendamentos
  nome_completo: string;
  data_nascimento: string;
  celular: string | null;
  telefone: string | null;
  ultimo_convenio: string;
  updated_at: string;
  created_at: string;
}

function consolidatePatients(patients: any[], lastConvenios: Record<string, string>): ConsolidatedPatient[] {
  const consolidated = new Map<string, ConsolidatedPatient>();
  
  patients.forEach(patient => {
    // Chave única: nome_completo (lowercase trim) + data_nascimento
    const key = `${patient.nome_completo.toLowerCase().trim()}-${patient.data_nascimento}`;
    
    if (consolidated.has(key)) {
      // Duplicata encontrada - adicionar ID ao array e usar o registro mais recente
      const existing = consolidated.get(key)!;
      existing.all_ids.push(patient.id);
      
      if (new Date(patient.updated_at) > new Date(existing.updated_at)) {
        existing.id = patient.id;
        existing.celular = patient.celular;
        existing.telefone = patient.telefone;
        existing.updated_at = patient.updated_at;
      }
    } else {
      // Primeiro registro deste paciente
      const ultimoConvenio = lastConvenios[key] || patient.convenio;
      
      consolidated.set(key, {
        id: patient.id,
        all_ids: [patient.id], // Iniciar array com o primeiro ID
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

// Listar agendamentos de um médico em uma data específica
async function handleListAppointments(supabase: any, body: any, clienteId: string) {
  try {
    const { medico_nome, data } = body;

    if (!medico_nome || !data) {
      return errorResponse('Campos obrigatórios: medico_nome, data (formato YYYY-MM-DD ou "CURRENT_DATE")');
    }

    // Normalizar data
    let dataFormatada = data;
    if (data === 'CURRENT_DATE' || data.toLowerCase() === 'hoje' || data.toLowerCase() === 'today') {
      dataFormatada = getDataAtualBrasil();
      console.log(`📅 Data convertida de "${data}" para ${dataFormatada}`);
    }

    // Validar formato de data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFormatada)) {
      return errorResponse('Data inválida. Use formato YYYY-MM-DD ou "CURRENT_DATE"');
    }

    console.log(`📋 Listando agendamentos: médico="${medico_nome}", data=${dataFormatada}`);

    // Chamar função do banco que retorna TODOS os médicos que correspondem à busca
    const { data: agendamentos, error } = await supabase
      .rpc('listar_agendamentos_medico_dia', {
        p_nome_medico: medico_nome,
        p_data: dataFormatada
      });

    if (error) {
      console.error('❌ Erro ao listar agendamentos:', error);
      return errorResponse(`Erro ao buscar agendamentos: ${error.message}`);
    }

    if (!agendamentos || agendamentos.length === 0) {
      const mensagem = `Não foi encontrado nenhum agendamento para o Dr. ${medico_nome} em ${dataFormatada}.`;
      return successResponse({
        encontrado: false,
        agendamentos: [],
        total: 0,
        message: mensagem,
        data_busca: dataFormatada,
        medico_busca: medico_nome
      });
    }

    // Agrupar por período e tipo de atendimento
    const manha = agendamentos.filter((a: any) => a.periodo === 'manhã');
    const tarde = agendamentos.filter((a: any) => a.periodo === 'tarde');
    
    // Contar tipos
    const tiposCount: Record<string, number> = {};
    agendamentos.forEach((a: any) => {
      tiposCount[a.tipo_atendimento] = (tiposCount[a.tipo_atendimento] || 0) + 1;
    });

    // Formatar mensagem amigável
    const tiposLista = Object.entries(tiposCount)
      .map(([tipo, qtd]) => `${qtd} ${tipo}${qtd > 1 ? 's' : ''}`)
      .join(', ');
    
    const mensagem = `Encontrei ${agendamentos.length} agendamento(s) para o Dr. ${medico_nome} em ${dataFormatada}:\n\n` +
      `📊 Resumo: ${tiposLista}\n\n` +
      (manha.length > 0 ? `☀️ Manhã: ${manha.length} agendamento(s)\n` : '') +
      (tarde.length > 0 ? `🌙 Tarde: ${tarde.length} agendamento(s)\n` : '');

    console.log(`✅ Encontrados ${agendamentos.length} agendamentos (${manha.length} manhã, ${tarde.length} tarde)`);

    return successResponse({
      encontrado: true,
      agendamentos: agendamentos,
      total: agendamentos.length,
      resumo: {
        total: agendamentos.length,
        manha: manha.length,
        tarde: tarde.length,
        tipos: tiposCount
      },
      message: mensagem,
      data_busca: dataFormatada,
      medico_busca: medico_nome
    });

  } catch (error: any) {
    console.error('❌ Erro ao processar list-appointments:', error);
    return errorResponse(`Erro ao processar requisição: ${error.message}`);
  }
}

// Verificar se paciente tem consultas agendadas
async function handleCheckPatient(supabase: any, body: any, clienteId: string) {
  try {
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

    // Se não encontrou NENHUM paciente com esses dados, é caso de migração
    if (!pacientesEncontrados || pacientesEncontrados.length === 0) {
      console.log('❌ Paciente não encontrado no sistema novo - possível caso de migração');
      return successResponse({
        encontrado: false,
        consultas: [],
        message: MIGRATION_MESSAGES.old_appointments,
        observacao: 'Sistema em migração - dados anteriores a janeiro/2026 não disponíveis',
        contato: MIGRATION_PHONE,
        total: 0
      });
    }

    console.log(`🔍 Encontrados ${pacientesEncontrados.length} registros de pacientes antes do filtro de celular`);

    // 🎯 FILTRO FUZZY DE CELULAR (em memória, após busca)
    // Se celular foi fornecido, aplicar tolerância de 1-2 dígitos nos últimos dígitos
    let pacientesFiltrados = pacientesEncontrados;
    
    if (celularNormalizado && celularNormalizado.length >= 10) {
      console.log('🔍 Aplicando filtro fuzzy de celular com tolerância nos últimos dígitos...');
      
      // Extrair últimos 4 dígitos do celular fornecido
      const sufixoFornecido = celularNormalizado.slice(-4);
      
      pacientesFiltrados = pacientesEncontrados.filter((p: any) => {
        if (!p.celular) return true; // Se não tem celular, mantém no resultado
        
        // Normalizar celular do paciente
        const celularPaciente = normalizarTelefone(p.celular);
        if (!celularPaciente || celularPaciente.length < 10) return true;
        
        // Extrair últimos 4 dígitos do celular do paciente
        const sufixoPaciente = celularPaciente.slice(-4);
        
        // Calcular diferença entre os últimos 4 dígitos
        const diff = Math.abs(parseInt(sufixoPaciente) - parseInt(sufixoFornecido));
        
        // Tolerância: aceitar diferença de até 5 nos últimos dígitos
        // Ex: 1991 vs 1992 (diff=1) ✅ | 1991 vs 1995 (diff=4) ✅ | 1991 vs 1998 (diff=7) ❌
        const tolerado = diff <= 5;
        
        if (!tolerado) {
          console.log(`⚠️ Celular rejeitado por diferença: ${sufixoPaciente} vs ${sufixoFornecido} (diff=${diff})`);
        } else if (diff > 0) {
          console.log(`✅ Celular aceito com diferença tolerada: ${sufixoPaciente} vs ${sufixoFornecido} (diff=${diff})`);
        }
        
        return tolerado;
      });
      
      console.log(`🔍 Após filtro fuzzy: ${pacientesFiltrados.length} de ${pacientesEncontrados.length} pacientes mantidos`);
    }

    console.log(`🔍 Total de registros após filtragem: ${pacientesFiltrados.length}`);

    // 🔄 PASSO 2: CONSOLIDAR DUPLICATAS
    // Buscar último convênio usado em agendamentos para cada paciente
    const pacienteIds = pacientesFiltrados.map((p: any) => p.id);
    const { data: ultimosAgendamentos } = await supabase
      .from('agendamentos')
      .select('paciente_id, convenio, data_agendamento, hora_agendamento')
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

    const { data: agendamentos, error: agendamentoError } = await supabase
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
      .in('paciente_id', paciente_ids)
      .in('status', ['agendado', 'confirmado'])
      .gte('data_agendamento', new Date().toISOString().split('T')[0])
      .order('data_agendamento', { ascending: true });

    if (agendamentoError) {
      return errorResponse(`Erro ao buscar agendamentos: ${agendamentoError.message}`);
    }

    // Se não tem agendamentos FUTUROS, informar que existe mas sem consultas futuras
    if (!agendamentos || agendamentos.length === 0) {
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

    // 📋 PASSO 3: Montar resposta com agendamentos futuros
    const consultas = agendamentos.map((a: any) => ({
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

    console.log(`✅ ${consultas.length} consulta(s) futura(s) encontrada(s)`);
    return successResponse({
      encontrado: true,
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

    // ⚠️ MIGRAÇÃO: Bloquear remarcações antes de janeiro/2026
    if (nova_data < MINIMUM_BOOKING_DATE) {
      console.log(`🚫 Tentativa de remarcar para antes da data mínima: ${nova_data}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'DATA_BLOQUEADA',
        message: getMigrationBlockMessage(agendamento.medicos?.nome),
        data_solicitada: nova_data,
        data_minima: MINIMUM_BOOKING_DATE,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
      
      // ⚠️ MIGRAÇÃO: Ajustar data mínima e continuar busca
      if (data_consulta < MINIMUM_BOOKING_DATE) {
        console.log(`🚫 Data solicitada (${data_consulta}) é anterior à data mínima (${MINIMUM_BOOKING_DATE})`);
        console.log(`📅 Ajustando para buscar a partir de: ${MINIMUM_BOOKING_DATE}`);
        
        // Salvar mensagem especial mas continuar o fluxo para buscar datas disponíveis
        mensagemEspecial = getMigrationBlockMessage(medico_nome);
        
        // Ajustar a data para iniciar a busca a partir da data mínima
        data_consulta = MINIMUM_BOOKING_DATE;
      }
      
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
        .select('id, nome, ativo')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      
      if (error) {
        console.error('❌ Erro ao buscar médicos:', error);
        return errorResponse(`Erro ao buscar médicos: ${error.message}`);
      }
      
      if (!todosMedicos || todosMedicos.length === 0) {
        return businessErrorResponse({
          codigo_erro: 'NENHUM_MEDICO_ATIVO',
          mensagem_usuario: '❌ Não há médicos ativos cadastrados no sistema no momento.\n\n📞 Por favor, entre em contato com a clínica para mais informações.',
          detalhes: {}
        });
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
        const sugestoes = todosMedicos.map(m => m.nome).slice(0, 10);
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
      
      // 🎫 LÓGICA PARA ORDEM DE CHEGADA (todos os médicos)
      console.log('🎫 Buscando períodos disponíveis (ordem de chegada)...');
      
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
              .gte('data_agendamento', MINIMUM_BOOKING_DATE)
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
              .gte('data_agendamento', MINIMUM_BOOKING_DATE)
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
        message: mensagemEspecial || `${proximasDatas.length} datas disponíveis encontradas`,
        medico: medico.nome,
        medico_id: medico.id,
        tipo_atendimento: 'ordem_chegada',
        proximas_datas: proximasDatas,
        data_solicitada: data_consulta_original || data_consulta,
        data_minima: mensagemEspecial ? MINIMUM_BOOKING_DATE : undefined,
        observacao: mensagemEspecial ? 'Sistema em migração - sugestões a partir de janeiro/2026' : undefined,
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
  quantidade: number = 5
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
    
    // Verificar se data é válida (>= MINIMUM_BOOKING_DATE)
    if (dataCheckStr < MINIMUM_BOOKING_DATE) {
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
      .gte('data_agendamento', MINIMUM_BOOKING_DATE)
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

/**
 * 🆕 Retorna erro de VALIDAÇÃO DE NEGÓCIO (não erro técnico)
 * Status 200 para que n8n/LLM possa processar a resposta
 */
function businessErrorResponse(config: {
  codigo_erro: string;
  mensagem_usuario: string;
  detalhes?: any;
  sugestoes?: any;
}) {
  return new Response(JSON.stringify({
    success: false,
    codigo_erro: config.codigo_erro,
    mensagem_usuario: config.mensagem_usuario,
    mensagem_whatsapp: config.mensagem_usuario, // Compatibilidade
    detalhes: config.detalhes || {},
    sugestoes: config.sugestoes || null,
    timestamp: new Date().toISOString()
  }), {
    status: 200, // ✅ Status 200 para n8n processar
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
