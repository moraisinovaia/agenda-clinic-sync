import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v2.0.0 - LLM Agent API para Clínica Vênus (compatível com llm-agent-api)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🏥 ID da Clínica Vênus
const CLINICA_VENUS_ID = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a';

// 📞 Contatos da Clínica Vênus
const CLINIC_INFO = {
  nome: 'Clínica Vênus',
  endereco: 'Rua das Orquídeas, 210 – Centro, Cidade Vênus – SP',
  whatsapp: '(11) 90000-0000',
  telefone: '(11) 4000-0000',
  email: 'contato@clinicavenus.com',
  horario_funcionamento: 'Segunda a Sexta: 08h às 19h | Sábado: 08h às 12h',
  formas_pagamento: 'Pix, cartão ou dinheiro',
  limite_pacientes: {
    seg_sex: 5,
    sabado: 4
  }
};

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

function getDataAtualBrasil(): string {
  return getDataHoraAtualBrasil().data;
}

// Função auxiliar para obter dia da semana (0=dom, 1=seg, ...)
function getDiaSemana(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}

const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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

// Regras de negócio para Clínica Vênus
const BUSINESS_RULES_VENUS = {
  medicos: {
    // Dr. João Silva - Cardiologista - HORA MARCADA
    '25440cf9-7832-4034-9e2a-9d8ee9b4d12d': {
      nome: 'DR. JOÃO SILVA',
      especialidade: 'Cardiologista',
      tipo_agendamento: 'hora_marcada',
      servicos: {
        'Consulta Cardiológica': {
          permite_online: true,
          tipo: 'hora_marcada',
          dias_semana: [1, 3, 5], // segunda, quarta, sexta
          periodos: {
            tarde: { 
              inicio: '14:00', 
              fim: '19:00', 
              intervalo_minutos: 30,
              limite: 6, // 6 pacientes seg/qua
              dias_especificos: [1, 3] // seg e qua
            },
            manha: { 
              inicio: '08:00', 
              fim: '12:00', 
              intervalo_minutos: 30,
              limite: 3, // 3 pacientes sexta
              dias_especificos: [5] // sexta
            }
          },
          valor: 300.00,
          retorno_gratuito_dias: 30,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL']
        },
        'Eletrocardiograma': {
          permite_online: true,
          tipo: 'hora_marcada',
          dias_semana: [1, 3, 5],
          periodos: {
            tarde: { 
              inicio: '14:00', 
              fim: '19:00', 
              intervalo_minutos: 20,
              limite: 6,
              dias_especificos: [1, 3]
            },
            manha: { 
              inicio: '08:00', 
              fim: '12:00', 
              intervalo_minutos: 20,
              limite: 3,
              dias_especificos: [5]
            }
          },
          valor: 150.00,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL']
        }
      }
    },
    
    // Dra. Gabriela Batista - Gastroenterologista - ORDEM DE CHEGADA
    '4361d620-4c9b-4602-aab1-e835cc63c8a2': {
      nome: 'DRA. GABRIELA BATISTA',
      especialidade: 'Gastroenterologista',
      tipo_agendamento: 'ordem_chegada',
      idade_minima: 15, // Atende apenas pacientes com 15+ anos
      servicos: {
        'Consulta Gastroenterológica': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [2, 4, 6], // terça, quinta, sábado
          periodos: {
            integral: { 
              inicio: '08:00', 
              fim: '16:00', 
              limite: 6,
              distribuicao_fichas: '08:00 às 16:00',
              dias_especificos: [2, 4] // ter e qui
            },
            manha: { 
              inicio: '08:00', 
              fim: '12:00', 
              limite: 6,
              distribuicao_fichas: '08:00 às 12:00',
              dias_especificos: [6] // sábado
            }
          },
          valor: 280.00,
          retorno_gratuito_dias: 20,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL']
        },
        'Endoscopia Digestiva Alta': {
          permite_online: true,
          tipo: 'ordem_chegada',
          dias_semana: [2, 4, 6],
          periodos: {
            integral: { 
              inicio: '08:00', 
              fim: '16:00', 
              limite: 6,
              distribuicao_fichas: '08:00 às 16:00',
              dias_especificos: [2, 4]
            },
            manha: { 
              inicio: '08:00', 
              fim: '12:00', 
              limite: 6,
              distribuicao_fichas: '08:00 às 12:00',
              dias_especificos: [6]
            }
          },
          valor: 500.00,
          convenios_aceitos: ['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL'],
          requer_preparo: true
        }
      }
    }
  }
};

// ============= FUNÇÕES DE RESPOSTA =============

function successResponse(data: any) {
  return new Response(JSON.stringify({
    success: true,
    ...data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
}

function businessErrorResponse(data: any) {
  return new Response(JSON.stringify({
    success: false,
    ...data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
}

function errorResponse(message: string) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
}

// ============= FUNÇÕES DE NORMALIZAÇÃO =============

function normalizarDataNascimento(data: string | null | undefined): string | null {
  if (!data) return null;
  const limpo = data.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(limpo)) {
    const [dia, mes, ano] = limpo.split(/[\/\-]/);
    return `${ano}-${mes}-${dia}`;
  }
  if (/^\d{4}[\/]\d{2}[\/]\d{2}$/.test(limpo)) {
    return limpo.replace(/\//g, '-');
  }
  console.warn(`⚠️ Formato de data_nascimento não reconhecido: "${data}"`);
  return null;
}

function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  const apenasNumeros = telefone.replace(/\D/g, '');
  if (apenasNumeros.startsWith('55') && apenasNumeros.length > 11) {
    return apenasNumeros.substring(2);
  }
  return apenasNumeros;
}

function normalizarNome(nome: string | null | undefined): string | null {
  if (!nome) return null;
  return nome.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * 🛡️ Sanitiza valores inválidos vindos do N8N/LLM
 * Converte: "indefinido", "undefined", "null", "", "None" → undefined
 */
function sanitizarCampoOpcional(valor: any): any {
  if (valor === null || valor === undefined) return undefined;
  
  if (typeof valor === 'string') {
    const valorTrim = valor.trim().toLowerCase();
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

/**
 * Mapeia dados flexivelmente de diferentes formatos de input
 */
function mapSchedulingData(body: any) {
  const mapped = {
    paciente_nome: normalizarNome(
      body.paciente_nome || body.nome_paciente || body.nome_completo || body.patient_name
    ),
    data_nascimento: normalizarDataNascimento(
      body.data_nascimento || body.paciente_nascimento || body.birth_date || body.nascimento
    ),
    convenio: body.convenio || body.insurance || body.plano_saude,
    telefone: normalizarTelefone(body.telefone || body.phone || body.telefone_fixo),
    celular: normalizarTelefone(body.celular || body.mobile || body.whatsapp || body.telefone_celular),
    medico_nome: body.medico_nome || body.doctor_name || body.nome_medico,
    medico_id: body.medico_id || body.doctor_id,
    atendimento_nome: body.atendimento_nome || body.tipo_consulta || body.service_name || body.procedimento,
    atendimento_id: body.atendimento_id,
    data_consulta: body.data_consulta || body.data_agendamento || body.appointment_date || body.data,
    hora_consulta: body.hora_consulta || body.hora_agendamento || body.appointment_time || body.hora,
    observacoes: body.observacoes || body.notes || body.comments || body.obs,
    periodo: body.periodo || body.period || body.turno
  };
  
  console.log('📝 Dados normalizados:', {
    paciente_nome: mapped.paciente_nome ? '✓' : '✗',
    data_nascimento: mapped.data_nascimento,
    celular: mapped.celular ? `${mapped.celular.substring(0, 4)}****` : '✗',
    periodo: mapped.periodo
  });
  
  return mapped;
}

function formatarConvenioParaBanco(convenio: string): string {
  if (!convenio) return 'PARTICULAR';
  return convenio.trim().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase();
}

function formatarDataPorExtenso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Classifica um horário no período correto (manhã/tarde)
 */
function classificarPeriodoSimples(hora: string): string {
  const [h] = hora.split(':').map(Number);
  return h < 12 ? 'manha' : 'tarde';
}

/**
 * Normaliza período preferido do paciente
 */
function normalizarPeriodo(periodo: string | null | undefined): string | null {
  if (!periodo) return null;
  
  const periodoLower = periodo.toLowerCase().trim();
  
  if (periodoLower.includes('manh') || periodoLower === 'morning') return 'manha';
  if (periodoLower.includes('tard') || periodoLower === 'afternoon') return 'tarde';
  if (periodoLower.includes('integr') || periodoLower === 'full' || periodoLower === 'qualquer') return 'integral';
  
  return null;
}

// ============= FUNÇÃO DE BUSCA DE MÉDICO =============

async function buscarMedico(supabase: any, identificador: string) {
  const nomeNormalizado = identificador.toLowerCase().trim();
  
  const { data: medicos, error } = await supabase
    .from('medicos')
    .select('*')
    .eq('cliente_id', CLINICA_VENUS_ID)
    .eq('ativo', true);

  if (error || !medicos || medicos.length === 0) {
    return null;
  }

  for (const medico of medicos) {
    const nomeMedico = medico.nome.toLowerCase();
    if (nomeMedico.includes(nomeNormalizado) || 
        nomeNormalizado.includes('joao') && nomeMedico.includes('joao') ||
        nomeNormalizado.includes('joão') && nomeMedico.includes('joao') ||
        nomeNormalizado.includes('gabriela') && nomeMedico.includes('gabriela') ||
        nomeNormalizado.includes('cardiolog') && nomeMedico.includes('joao') ||
        nomeNormalizado.includes('gastro') && nomeMedico.includes('gabriela')) {
      return medico;
    }
  }

  return null;
}

/**
 * Busca o próximo horário livre no período
 */
async function buscarProximoHorarioLivre(
  supabase: any,
  medicoId: string,
  dataConsulta: string,
  periodoConfig: { inicio: string, fim: string, limite: number, intervalo_minutos?: number }
): Promise<{ horario: string, tentativas: number } | null> {
  
  const [horaInicio, minInicio] = periodoConfig.inicio.split(':').map(Number);
  const [horaFim, minFim] = periodoConfig.fim.split(':').map(Number);
  
  const minutoInicio = horaInicio * 60 + minInicio;
  const minutoFim = horaFim * 60 + minFim;
  
  // Buscar todos os agendamentos do dia
  const { data: agendamentosDia } = await supabase
    .from('agendamentos')
    .select('hora_agendamento')
    .eq('medico_id', medicoId)
    .eq('data_agendamento', dataConsulta)
    .eq('cliente_id', CLINICA_VENUS_ID)
    .is('excluido_em', null)
    .in('status', ['agendado', 'confirmado']);

  // Filtrar apenas agendamentos do período
  const agendamentos = agendamentosDia?.filter(a => {
    const [h, m] = a.hora_agendamento.split(':').map(Number);
    const minutoAgendamento = h * 60 + m;
    return minutoAgendamento >= minutoInicio && minutoAgendamento < minutoFim;
  }) || [];

  console.log(`📊 Agendamentos do período (${periodoConfig.inicio}-${periodoConfig.fim}): ${agendamentos.length}/${periodoConfig.limite}`);

  if (agendamentos.length >= periodoConfig.limite) {
    console.log(`❌ Período lotado (${agendamentos.length}/${periodoConfig.limite})`);
    return null;
  }

  const horariosOcupados = new Set(
    agendamentos.map(a => a.hora_agendamento.substring(0, 5))
  );
  
  const intervalo = periodoConfig.intervalo_minutos || 30;
  let tentativas = 0;
  let minutoAtual = minutoInicio;
  
  while (minutoAtual < minutoFim) {
    tentativas++;
    const hora = Math.floor(minutoAtual / 60);
    const min = minutoAtual % 60;
    const horarioTeste = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    
    if (!horariosOcupados.has(horarioTeste)) {
      console.log(`✅ Horário livre encontrado: ${horarioTeste} (após ${tentativas} tentativas)`);
      return { horario: horarioTeste + ':00', tentativas };
    }
    
    minutoAtual += intervalo;
  }
  
  console.log(`❌ Nenhum horário livre encontrado após ${tentativas} tentativas`);
  return null;
}

// ============= HANDLER DE DISPONIBILIDADE =============

async function handleAvailability(supabase: any, body: any) {
  const { 
    medico_nome,
    medico_id,
    atendimento_nome,
    data_consulta,
    periodo: periodoPreferido,
    quantidade_dias = 14
  } = body;

  console.log('📥 [AVAILABILITY] Parâmetros:', { medico_nome, medico_id, atendimento_nome, data_consulta, periodoPreferido });

  // Normalizar período preferido
  const periodoNormalizado = normalizarPeriodo(periodoPreferido);
  console.log(`🕐 Período normalizado: "${periodoPreferido}" → "${periodoNormalizado}"`);

  // Buscar médico
  let medico;
  if (medico_id) {
    const { data } = await supabase
      .from('medicos')
      .select('*')
      .eq('id', medico_id)
      .eq('cliente_id', CLINICA_VENUS_ID)
      .single();
    medico = data;
  } else if (medico_nome) {
    medico = await buscarMedico(supabase, medico_nome);
  }

  if (!medico) {
    return businessErrorResponse({
      codigo_erro: 'MEDICO_NAO_ENCONTRADO',
      mensagem_usuario: `Médico não encontrado. Médicos disponíveis na Clínica Vênus:\n\n• Dr. João Silva - Cardiologista\n• Dra. Gabriela Batista - Gastroenterologista\n\n📞 Contato: ${CLINIC_INFO.whatsapp}`,
      medicos_disponiveis: ['Dr. João Silva', 'Dra. Gabriela Batista']
    });
  }

  const regras = BUSINESS_RULES_VENUS.medicos[medico.id];
  if (!regras) {
    return businessErrorResponse({
      codigo_erro: 'MEDICO_SEM_REGRAS',
      mensagem_usuario: `${medico.nome} não tem agenda online configurada. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Identificar serviço
  let servicoKey = Object.keys(regras.servicos)[0];
  if (atendimento_nome) {
    const nomeNorm = atendimento_nome.toLowerCase();
    for (const [key] of Object.entries(regras.servicos)) {
      if (key.toLowerCase().includes(nomeNorm) || nomeNorm.includes(key.toLowerCase().split(' ')[0])) {
        servicoKey = key;
        break;
      }
    }
  }

  const servico = regras.servicos[servicoKey];
  const tipoAtendimento = servico.tipo;
  const dataAtual = getDataAtualBrasil();

  // Busca expandida: começa com 14 dias, expande para 45 se não encontrar
  const proximasDatas: any[] = [];
  let diasBusca = quantidade_dias;
  let expandiuBusca = false;

  const buscarDatas = async (maxDias: number) => {
    const resultados: any[] = [];
    let dataBase = data_consulta || dataAtual;
    
    for (let diasBuscados = 0; diasBuscados < maxDias && resultados.length < 5; diasBuscados++) {
      const [ano, mes, dia] = dataBase.split('-').map(Number);
      const dataObj = new Date(ano, mes - 1, dia);
      dataObj.setDate(dataObj.getDate() + diasBuscados);
      
      // Não buscar datas passadas
      const dataStr = dataObj.toISOString().split('T')[0];
      if (dataStr < dataAtual) continue;
      
      const diaSemana = dataObj.getDay();
      
      if (!servico.dias_semana.includes(diaSemana)) continue;

      // Verificar bloqueios
      const { data: bloqueios } = await supabase
        .from('bloqueios_agenda')
        .select('id')
        .eq('medico_id', medico.id)
        .eq('cliente_id', CLINICA_VENUS_ID)
        .eq('status', 'ativo')
        .lte('data_inicio', dataStr)
        .gte('data_fim', dataStr);

      if (bloqueios && bloqueios.length > 0) continue;

      // Verificar vagas em cada período
      for (const [periodo, config] of Object.entries(servico.periodos)) {
        const configTyped = config as any;
        
        // Verificar dias específicos do período
        if (configTyped.dias_especificos && !configTyped.dias_especificos.includes(diaSemana)) {
          continue;
        }

        // Filtrar por período preferido
        if (periodoNormalizado && periodoNormalizado !== 'integral') {
          const periodoAtual = periodo.includes('manha') || periodo === 'manha' ? 'manha' : 
                              periodo.includes('tarde') || periodo === 'tarde' ? 'tarde' : 'integral';
          if (periodoNormalizado !== periodoAtual && periodoAtual !== 'integral') {
            continue;
          }
        }

        // Contar agendamentos do período
        const [hInicio, mInicio] = configTyped.inicio.split(':').map(Number);
        const [hFim, mFim] = configTyped.fim.split(':').map(Number);
        const minutoInicio = hInicio * 60 + mInicio;
        const minutoFim = hFim * 60 + mFim;

        const { data: agendamentosDia } = await supabase
          .from('agendamentos')
          .select('hora_agendamento')
          .eq('medico_id', medico.id)
          .eq('data_agendamento', dataStr)
          .eq('cliente_id', CLINICA_VENUS_ID)
          .is('excluido_em', null)
          .in('status', ['agendado', 'confirmado']);

        const agendamentosPeriodo = agendamentosDia?.filter(a => {
          const [h, m] = a.hora_agendamento.split(':').map(Number);
          const minutoAgendamento = h * 60 + m;
          return minutoAgendamento >= minutoInicio && minutoAgendamento < minutoFim;
        }) || [];

        const limite = configTyped.limite || 20;
        const vagasDisponiveis = limite - agendamentosPeriodo.length;

        if (vagasDisponiveis > 0) {
          // Determinar nome do período para exibição
          let nomePeriodo = 'Integral';
          if (periodo.includes('manha') || periodo === 'manha') nomePeriodo = 'Manhã';
          else if (periodo.includes('tarde') || periodo === 'tarde') nomePeriodo = 'Tarde';

          resultados.push({
            data: formatarDataPorExtenso(dataStr),
            data_iso: dataStr,
            dia_semana: diasNomes[diaSemana],
            periodo: nomePeriodo,
            periodo_key: periodo,
            horario_inicio: configTyped.inicio,
            horario_fim: configTyped.fim,
            horario_distribuicao: `${configTyped.inicio} às ${configTyped.fim}`,
            vagas_disponiveis: vagasDisponiveis,
            vagas_total: limite,
            tipo_atendimento: tipoAtendimento
          });
          break; // Apenas um período por dia
        }
      }
    }
    
    return resultados;
  };

  // Primeira busca
  proximasDatas.push(...await buscarDatas(diasBusca));

  // Se não encontrou e não expandiu, expandir para 45 dias
  if (proximasDatas.length === 0 && diasBusca < 45) {
    console.log('🔄 Expandindo busca de 14 para 45 dias...');
    expandiuBusca = true;
    diasBusca = 45;
    proximasDatas.push(...await buscarDatas(diasBusca));
  }

  if (proximasDatas.length === 0) {
    return businessErrorResponse({
      codigo_erro: 'SEM_DISPONIBILIDADE',
      mensagem_usuario: `Não encontramos vagas para ${regras.nome} nos próximos ${diasBusca} dias.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`,
      busca_expandida: expandiuBusca
    });
  }

  // Determinar se há baixa disponibilidade
  const baixaDisponibilidade = proximasDatas.length <= 3;

  // Montar mensagem
  let mensagem = `✅ ${regras.nome} - ${servicoKey}\n\n`;
  mensagem += `📅 Próximas datas disponíveis:\n\n`;
  
  proximasDatas.forEach((d: any) => {
    mensagem += `• ${d.dia_semana}, ${d.data}\n`;
    mensagem += `  Período: ${d.periodo} (${d.horario_distribuicao})\n`;
    mensagem += `  Vagas: ${d.vagas_disponiveis}\n\n`;
  });

  if (baixaDisponibilidade) {
    mensagem += `⚠️ POUCAS VAGAS disponíveis. Recomendamos agendar logo!\n\n`;
  }

  if (tipoAtendimento === 'hora_marcada') {
    mensagem += `📋 HORA MARCADA: Você receberá um horário específico.\n`;
  }

  if (servico.valor) {
    mensagem += `\n💰 Valor: R$ ${servico.valor.toFixed(2)}`;
    if (servico.retorno_gratuito_dias) {
      mensagem += ` (retorno gratuito em até ${servico.retorno_gratuito_dias} dias)`;
    }
    mensagem += '\n';
  }

  mensagem += `\n💬 Qual data funciona melhor para você?`;

  return successResponse({
    disponivel: true,
    tipo_agendamento: tipoAtendimento,
    medico: regras.nome,
    medico_id: medico.id,
    especialidade: regras.especialidade,
    servico: servicoKey,
    proximas_datas: proximasDatas,
    total_datas_encontradas: proximasDatas.length,
    baixa_disponibilidade: baixaDisponibilidade,
    busca_expandida: expandiuBusca,
    periodo_filtrado: periodoNormalizado,
    valor: servico.valor,
    convenios_aceitos: servico.convenios_aceitos,
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= HANDLER DE AGENDAMENTO =============

async function handleSchedule(supabase: any, body: any) {
  console.log('📥 [SCHEDULE] Dados recebidos:', JSON.stringify(body, null, 2));

  // Sanitização automática
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string' && value.startsWith('=')) {
      const cleaned = value.substring(1);
      console.log(`🧹 Sanitizado: "${value}" → "${cleaned}"`);
      return cleaned;
    }
    return value;
  };
  
  const sanitizedBody = Object.fromEntries(
    Object.entries(body).map(([key, value]) => [key, sanitizeValue(value)])
  );
  
  const robustSanitizedBody = {
    ...sanitizedBody,
    data_nascimento: sanitizarCampoOpcional(sanitizedBody.data_nascimento),
    telefone: sanitizarCampoOpcional(sanitizedBody.telefone),
    celular: sanitizarCampoOpcional(sanitizedBody.celular)
  };
  
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
    atendimento_id: inputAtendimentoId,
    data_consulta, 
    hora_consulta, 
    observacoes,
    periodo
  } = mappedData;

  // Validar campos obrigatórios
  if (!paciente_nome || !celular || (!medico_nome && !medico_id) || !data_consulta) {
    const missingFields: string[] = [];
    if (!paciente_nome) missingFields.push('paciente_nome');
    if (!celular) missingFields.push('celular');
    if (!medico_nome && !medico_id) missingFields.push('medico_nome ou medico_id');
    if (!data_consulta) missingFields.push('data_consulta');
    
    return businessErrorResponse({
      codigo_erro: 'DADOS_INCOMPLETOS',
      mensagem_usuario: `❌ Faltam informações obrigatórias:\n\n${missingFields.map(f => `• ${f}`).join('\n')}\n\n💡 Por favor, forneça todos os dados necessários.`,
      detalhes: { campos_faltando: missingFields }
    });
  }

  // Buscar médico
  let medico;
  if (medico_id) {
    const { data } = await supabase
      .from('medicos')
      .select('*')
      .eq('id', medico_id)
      .eq('cliente_id', CLINICA_VENUS_ID)
      .single();
    medico = data;
  } else if (medico_nome) {
    medico = await buscarMedico(supabase, medico_nome);
  }

  if (!medico) {
    return businessErrorResponse({
      codigo_erro: 'MEDICO_NAO_ENCONTRADO',
      mensagem_usuario: `Médico não encontrado. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Buscar regras do médico
  const regras = BUSINESS_RULES_VENUS.medicos[medico.id];

  // Validar idade mínima (se configurada)
  if (regras?.idade_minima && data_nascimento) {
    const idade = calcularIdade(data_nascimento);
    if (idade < regras.idade_minima) {
      console.log(`❌ Idade incompatível: ${idade} anos < ${regras.idade_minima} anos mínimo`);
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
    console.log(`✅ Validação de idade OK: ${idade} anos >= ${regras.idade_minima} anos`);
  }
  
  // Buscar atendimento
  let atendimento;
  if (inputAtendimentoId) {
    const { data } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('id', inputAtendimentoId)
      .eq('cliente_id', CLINICA_VENUS_ID)
      .single();
    atendimento = data;
  } else if (atendimento_nome) {
    const { data } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .eq('medico_id', medico.id)
      .ilike('nome', `%${atendimento_nome}%`)
      .single();
    atendimento = data;
  } else {
    const { data } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .eq('medico_id', medico.id)
      .eq('ativo', true)
      .limit(1)
      .single();
    atendimento = data;
  }

  if (!atendimento) {
    return businessErrorResponse({
      codigo_erro: 'ATENDIMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Tipo de atendimento não encontrado para ${medico.nome}. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Determinar horário final
  let horarioFinal = hora_consulta;
  
  // Se não tem horário ou é um período (manhã/tarde), buscar primeiro horário disponível
  if (!hora_consulta || normalizarPeriodo(hora_consulta)) {
    const periodoNormalizado = normalizarPeriodo(hora_consulta || periodo) || 'integral';
    console.log(`🕐 Buscando horário disponível para período: ${periodoNormalizado}`);
    
    if (regras) {
      const servicoKey = Object.keys(regras.servicos).find(s => 
        s.toLowerCase().includes((atendimento_nome || '').toLowerCase()) ||
        (atendimento_nome || '').toLowerCase().includes(s.toLowerCase())
      ) || Object.keys(regras.servicos)[0];
      
      const servico = regras.servicos[servicoKey];
      const diaSemana = getDiaSemana(data_consulta);
      
      // Encontrar período válido para o dia
      for (const [periodoKey, config] of Object.entries(servico.periodos)) {
        const configTyped = config as any;
        
        // Verificar se o período atende no dia da semana
        if (configTyped.dias_especificos && !configTyped.dias_especificos.includes(diaSemana)) {
          continue;
        }
        
        // Filtrar por período preferido
        if (periodoNormalizado !== 'integral') {
          const periodoAtual = periodoKey.includes('manha') || periodoKey === 'manha' ? 'manha' : 
                              periodoKey.includes('tarde') || periodoKey === 'tarde' ? 'tarde' : 'integral';
          if (periodoNormalizado !== periodoAtual && periodoAtual !== 'integral') {
            continue;
          }
        }
        
        // Buscar próximo horário livre
        const resultado = await buscarProximoHorarioLivre(supabase, medico.id, data_consulta, configTyped);
        
        if (resultado) {
          horarioFinal = resultado.horario;
          console.log(`✅ Horário encontrado: ${horarioFinal}`);
          break;
        }
      }
      
      if (!horarioFinal || horarioFinal === hora_consulta) {
        return businessErrorResponse({
          codigo_erro: 'SEM_HORARIO_DISPONIVEL',
          mensagem_usuario: `❌ Não há horários disponíveis para ${medico.nome} em ${formatarDataPorExtenso(data_consulta)}.\n\n💡 Por favor, consulte a disponibilidade para ver outras datas.`
        });
      }
    } else {
      // Sem regras, usar horário padrão
      horarioFinal = '08:00:00';
    }
  }
  
  // Garantir formato correto do horário
  if (horarioFinal && !horarioFinal.includes(':')) {
    horarioFinal = horarioFinal + ':00:00';
  } else if (horarioFinal && horarioFinal.length === 5) {
    horarioFinal = horarioFinal + ':00';
  }

  console.log(`📅 Criando agendamento: ${paciente_nome} com ${medico.nome} em ${data_consulta} às ${horarioFinal}`);

  // Chamar RPC de agendamento
  const { data: resultado, error } = await supabase.rpc('criar_agendamento_atomico_externo', {
    p_cliente_id: CLINICA_VENUS_ID,
    p_nome_completo: paciente_nome,
    p_data_nascimento: data_nascimento || '1990-01-01',
    p_convenio: formatarConvenioParaBanco(convenio || 'PARTICULAR'),
    p_telefone: telefone || '',
    p_celular: celular,
    p_medico_id: medico.id,
    p_atendimento_id: atendimento.id,
    p_data_agendamento: data_consulta,
    p_hora_agendamento: horarioFinal,
    p_observacoes: observacoes || 'Agendamento via WhatsApp Bot Venus',
    p_criado_por: 'whatsapp_bot_venus'
  });

  if (error) {
    console.error('❌ Erro RPC:', error);
    return businessErrorResponse({
      codigo_erro: 'ERRO_AGENDAMENTO',
      mensagem_usuario: `Não foi possível criar o agendamento: ${error.message}\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  if (!resultado?.success) {
    // Se for conflito, tentar encontrar outro horário
    if (resultado?.error === 'CONFLICT') {
      console.log('🔄 Conflito detectado, buscando outro horário...');
      
      if (regras) {
        const servicoKey = Object.keys(regras.servicos)[0];
        const servico = regras.servicos[servicoKey];
        
        for (const [, config] of Object.entries(servico.periodos)) {
          const configTyped = config as any;
          const resultado2 = await buscarProximoHorarioLivre(supabase, medico.id, data_consulta, configTyped);
          
          if (resultado2) {
            // Tentar novamente com o novo horário
            const { data: resultado3, error: error3 } = await supabase.rpc('criar_agendamento_atomico_externo', {
              p_cliente_id: CLINICA_VENUS_ID,
              p_nome_completo: paciente_nome,
              p_data_nascimento: data_nascimento || '1990-01-01',
              p_convenio: formatarConvenioParaBanco(convenio || 'PARTICULAR'),
              p_telefone: telefone || '',
              p_celular: celular,
              p_medico_id: medico.id,
              p_atendimento_id: atendimento.id,
              p_data_agendamento: data_consulta,
              p_hora_agendamento: resultado2.horario,
              p_observacoes: observacoes || 'Agendamento via WhatsApp Bot Venus',
              p_criado_por: 'whatsapp_bot_venus'
            });
            
            if (!error3 && resultado3?.success) {
              horarioFinal = resultado2.horario;
              return montarRespostaSucesso(resultado3, paciente_nome, medico, atendimento, data_consulta, horarioFinal, regras);
            }
          }
        }
      }
    }
    
    return businessErrorResponse({
      codigo_erro: resultado?.error || 'ERRO_AGENDAMENTO',
      mensagem_usuario: resultado?.message || `Erro ao criar agendamento. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  return montarRespostaSucesso(resultado, paciente_nome, medico, atendimento, data_consulta, horarioFinal, regras);
}

function montarRespostaSucesso(resultado: any, paciente_nome: string, medico: any, atendimento: any, data_consulta: string, horarioFinal: string, regras: any) {
  const tipoAtendimento = regras?.tipo_agendamento || 'hora_marcada';

  let mensagem = `✅ AGENDAMENTO CONFIRMADO!\n\n`;
  mensagem += `👤 Paciente: ${paciente_nome}\n`;
  mensagem += `👨‍⚕️ Médico: ${medico.nome}\n`;
  mensagem += `📋 Atendimento: ${atendimento.nome}\n`;
  mensagem += `📅 Data: ${formatarDataPorExtenso(data_consulta)}\n`;
  mensagem += `⏰ Horário: ${horarioFinal.substring(0, 5)}\n`;
  mensagem += `\n📍 Local: ${CLINIC_INFO.endereco}\n`;
  mensagem += `📞 Contato: ${CLINIC_INFO.whatsapp}\n`;

  return successResponse({
    agendamento_id: resultado.agendamento_id,
    paciente_id: resultado.paciente_id,
    data: data_consulta,
    hora: horarioFinal,
    medico: medico.nome,
    atendimento: atendimento.nome,
    tipo_agendamento: tipoAtendimento,
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= HANDLER DE VERIFICAR PACIENTE =============

async function handleCheckPatient(supabase: any, body: any) {
  const mappedData = mapSchedulingData(body);
  const { paciente_nome, celular } = mappedData;

  console.log('📥 [CHECK-PATIENT] Parâmetros:', { paciente_nome, celular });

  let query = supabase
    .from('agendamentos')
    .select(`
      *,
      pacientes!inner(nome_completo, data_nascimento, celular, convenio),
      medicos(nome, especialidade),
      atendimentos(nome, tipo)
    `)
    .eq('cliente_id', CLINICA_VENUS_ID)
    .is('excluido_em', null)
    .in('status', ['agendado', 'confirmado'])
    .order('data_agendamento', { ascending: true });

  if (paciente_nome) {
    query = query.ilike('pacientes.nome_completo', `%${paciente_nome}%`);
  }
  if (celular) {
    query = query.ilike('pacientes.celular', `%${celular}%`);
  }

  const { data: agendamentos, error } = await query;

  if (error) {
    console.error('❌ Erro ao buscar:', error);
    return businessErrorResponse({
      codigo_erro: 'ERRO_BUSCA',
      mensagem_usuario: `Erro ao buscar agendamentos. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  if (!agendamentos || agendamentos.length === 0) {
    return successResponse({
      encontrado: false,
      agendamentos: [],
      mensagem_whatsapp: `Não encontrei agendamentos para este paciente na Clínica Vênus.\n\n📞 Para agendar: ${CLINIC_INFO.whatsapp}`,
      message: 'Nenhum agendamento encontrado'
    });
  }

  let mensagem = `📋 Agendamentos encontrados:\n\n`;
  agendamentos.forEach((ag: any, i: number) => {
    mensagem += `${i + 1}. ${ag.medicos?.nome || 'Médico'}\n`;
    mensagem += `   📅 ${formatarDataPorExtenso(ag.data_agendamento)} às ${ag.hora_agendamento.substring(0, 5)}\n`;
    mensagem += `   📋 ${ag.atendimentos?.nome || 'Consulta'}\n`;
    mensagem += `   ✅ Status: ${ag.status === 'confirmado' ? 'Confirmado' : 'Agendado'}\n\n`;
  });

  mensagem += `📍 ${CLINIC_INFO.endereco}`;

  return successResponse({
    encontrado: true,
    total: agendamentos.length,
    agendamentos: agendamentos.map((ag: any) => ({
      id: ag.id,
      data: ag.data_agendamento,
      hora: ag.hora_agendamento,
      medico: ag.medicos?.nome,
      medico_id: ag.medico_id,
      atendimento: ag.atendimentos?.nome,
      status: ag.status,
      paciente_nome: ag.pacientes?.nome_completo
    })),
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= HANDLER DE CANCELAMENTO =============

async function handleCancel(supabase: any, body: any) {
  const { agendamento_id } = body;
  const mappedData = mapSchedulingData(body);
  const { paciente_nome, celular } = mappedData;

  console.log('📥 [CANCEL] Parâmetros:', { agendamento_id, paciente_nome, celular });

  let agendamentoId = agendamento_id;

  if (!agendamentoId && (paciente_nome || celular)) {
    let query = supabase
      .from('agendamentos')
      .select('id, pacientes!inner(nome_completo, celular)')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado'])
      .order('data_agendamento', { ascending: true })
      .limit(1);

    if (paciente_nome) {
      query = query.ilike('pacientes.nome_completo', `%${paciente_nome}%`);
    }
    if (celular) {
      query = query.ilike('pacientes.celular', `%${celular}%`);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      agendamentoId = data[0].id;
    }
  }

  if (!agendamentoId) {
    return businessErrorResponse({
      codigo_erro: 'AGENDAMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Não encontrei agendamento para cancelar.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  const { data: resultado, error } = await supabase.rpc('cancelar_agendamento_soft', {
    p_agendamento_id: agendamentoId,
    p_cancelado_por: 'whatsapp_bot_venus'
  });

  if (error || !resultado?.success) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_CANCELAMENTO',
      mensagem_usuario: `Não foi possível cancelar: ${error?.message || resultado?.error}\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  return successResponse({
    agendamento_id: agendamentoId,
    mensagem_whatsapp: `✅ Agendamento cancelado com sucesso!\n\nSe precisar reagendar:\n📞 ${CLINIC_INFO.whatsapp}`,
    message: 'Agendamento cancelado'
  });
}

// ============= HANDLER DE CONFIRMAÇÃO =============

async function handleConfirm(supabase: any, body: any) {
  const { agendamento_id } = body;
  const mappedData = mapSchedulingData(body);
  const { paciente_nome, celular } = mappedData;

  console.log('📥 [CONFIRM] Parâmetros:', { agendamento_id, paciente_nome, celular });

  let agendamentoId = agendamento_id;

  if (!agendamentoId && (paciente_nome || celular)) {
    let query = supabase
      .from('agendamentos')
      .select('id, pacientes!inner(nome_completo, celular)')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .is('excluido_em', null)
      .eq('status', 'agendado')
      .order('data_agendamento', { ascending: true })
      .limit(1);

    if (paciente_nome) {
      query = query.ilike('pacientes.nome_completo', `%${paciente_nome}%`);
    }
    if (celular) {
      query = query.ilike('pacientes.celular', `%${celular}%`);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      agendamentoId = data[0].id;
    }
  }

  if (!agendamentoId) {
    return businessErrorResponse({
      codigo_erro: 'AGENDAMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Não encontrei agendamento para confirmar.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  const { data: resultado, error } = await supabase.rpc('confirmar_agendamento', {
    p_agendamento_id: agendamentoId,
    p_confirmado_por: 'whatsapp_bot_venus'
  });

  if (error || !resultado?.success) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_CONFIRMACAO',
      mensagem_usuario: `Não foi possível confirmar: ${error?.message || resultado?.error}\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  return successResponse({
    agendamento_id: agendamentoId,
    mensagem_whatsapp: `✅ Presença confirmada!\n\nAguardamos você na data marcada.\n\n📍 ${CLINIC_INFO.endereco}`,
    message: 'Agendamento confirmado'
  });
}

// ============= HANDLER DE REAGENDAMENTO =============

async function handleReschedule(supabase: any, body: any) {
  const { agendamento_id, nova_data, novo_horario } = body;
  const mappedData = mapSchedulingData(body);
  const { paciente_nome, celular, data_consulta, hora_consulta } = mappedData;

  console.log('📥 [RESCHEDULE] Parâmetros:', { agendamento_id, nova_data, novo_horario, paciente_nome });

  // Determinar nova data e horário
  const dataFinal = nova_data || data_consulta;
  const horarioFinal = novo_horario || hora_consulta;

  if (!dataFinal) {
    return businessErrorResponse({
      codigo_erro: 'DATA_OBRIGATORIA',
      mensagem_usuario: 'Por favor, informe a nova data desejada para o reagendamento.'
    });
  }

  // Buscar agendamento original
  let agendamentoId = agendamento_id;

  if (!agendamentoId && (paciente_nome || celular)) {
    let query = supabase
      .from('agendamentos')
      .select('id, medico_id, atendimento_id, paciente_id, pacientes!inner(nome_completo, celular, convenio, data_nascimento)')
      .eq('cliente_id', CLINICA_VENUS_ID)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado'])
      .order('data_agendamento', { ascending: true })
      .limit(1);

    if (paciente_nome) {
      query = query.ilike('pacientes.nome_completo', `%${paciente_nome}%`);
    }
    if (celular) {
      query = query.ilike('pacientes.celular', `%${celular}%`);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      agendamentoId = data[0].id;
    }
  }

  if (!agendamentoId) {
    return businessErrorResponse({
      codigo_erro: 'AGENDAMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Não encontrei agendamento para reagendar.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Buscar dados do agendamento original
  const { data: agendamentoOriginal, error: erroOriginal } = await supabase
    .from('agendamentos')
    .select(`
      *,
      pacientes(nome_completo, data_nascimento, celular, telefone, convenio),
      medicos(id, nome),
      atendimentos(id, nome)
    `)
    .eq('id', agendamentoId)
    .single();

  if (erroOriginal || !agendamentoOriginal) {
    return businessErrorResponse({
      codigo_erro: 'AGENDAMENTO_NAO_ENCONTRADO',
      mensagem_usuario: `Não foi possível encontrar os dados do agendamento original.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Cancelar o agendamento original
  const { error: erroCancelamento } = await supabase.rpc('cancelar_agendamento_soft', {
    p_agendamento_id: agendamentoId,
    p_cancelado_por: 'whatsapp_bot_venus (reagendamento)'
  });

  if (erroCancelamento) {
    console.error('❌ Erro ao cancelar agendamento original:', erroCancelamento);
    return businessErrorResponse({
      codigo_erro: 'ERRO_CANCELAMENTO',
      mensagem_usuario: `Não foi possível cancelar o agendamento original para reagendar.\n\n📞 Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  // Criar novo agendamento com a nova data/horário
  const novoBody = {
    paciente_nome: agendamentoOriginal.pacientes?.nome_completo,
    data_nascimento: agendamentoOriginal.pacientes?.data_nascimento,
    convenio: agendamentoOriginal.pacientes?.convenio,
    telefone: agendamentoOriginal.pacientes?.telefone,
    celular: agendamentoOriginal.pacientes?.celular,
    medico_id: agendamentoOriginal.medico_id,
    atendimento_id: agendamentoOriginal.atendimento_id,
    data_consulta: dataFinal,
    hora_consulta: horarioFinal,
    observacoes: `Reagendamento do agendamento ${agendamentoId}`
  };

  return await handleSchedule(supabase, novoBody);
}

// ============= HANDLER DE BUSCA DE PACIENTES =============

async function handlePatientSearch(supabase: any, body: any) {
  const mappedData = mapSchedulingData(body);
  const { paciente_nome, celular } = mappedData;

  console.log('📥 [PATIENT-SEARCH] Parâmetros:', { paciente_nome, celular });

  if (!paciente_nome && !celular) {
    return businessErrorResponse({
      codigo_erro: 'PARAMETRO_OBRIGATORIO',
      mensagem_usuario: 'Informe o nome ou telefone do paciente para buscar.'
    });
  }

  let query = supabase
    .from('pacientes')
    .select('id, nome_completo, data_nascimento, celular, telefone, convenio')
    .eq('cliente_id', CLINICA_VENUS_ID);

  if (paciente_nome) {
    query = query.ilike('nome_completo', `%${paciente_nome}%`);
  }
  if (celular) {
    query = query.ilike('celular', `%${celular}%`);
  }

  const { data: pacientes, error } = await query.limit(10);

  if (error) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_BUSCA',
      mensagem_usuario: `Erro ao buscar pacientes. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  if (!pacientes || pacientes.length === 0) {
    return successResponse({
      encontrado: false,
      pacientes: [],
      message: 'Nenhum paciente encontrado com os dados informados.'
    });
  }

  return successResponse({
    encontrado: true,
    total: pacientes.length,
    pacientes: pacientes.map((p: any) => ({
      id: p.id,
      nome: p.nome_completo,
      data_nascimento: p.data_nascimento,
      celular: p.celular,
      telefone: p.telefone,
      convenio: p.convenio
    })),
    message: `Encontrado(s) ${pacientes.length} paciente(s).`
  });
}

// ============= HANDLER DE LISTAR AGENDAMENTOS =============

async function handleListAppointments(supabase: any, body: any) {
  const { medico_id, medico_nome, data_inicio, data_fim, status: statusFiltro } = body;

  console.log('📥 [LIST-APPOINTMENTS] Parâmetros:', { medico_nome, data_inicio, data_fim });

  let query = supabase
    .from('agendamentos')
    .select(`
      *,
      pacientes(nome_completo, celular, convenio),
      medicos(nome, especialidade),
      atendimentos(nome)
    `)
    .eq('cliente_id', CLINICA_VENUS_ID)
    .is('excluido_em', null)
    .order('data_agendamento', { ascending: true })
    .order('hora_agendamento', { ascending: true });

  if (medico_id) {
    query = query.eq('medico_id', medico_id);
  } else if (medico_nome) {
    const medico = await buscarMedico(supabase, medico_nome);
    if (medico) {
      query = query.eq('medico_id', medico.id);
    }
  }

  if (data_inicio) {
    query = query.gte('data_agendamento', data_inicio);
  }
  if (data_fim) {
    query = query.lte('data_agendamento', data_fim);
  }
  if (statusFiltro) {
    query = query.eq('status', statusFiltro);
  } else {
    query = query.in('status', ['agendado', 'confirmado']);
  }

  const { data: agendamentos, error } = await query.limit(50);

  if (error) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_BUSCA',
      mensagem_usuario: `Erro ao listar agendamentos. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  return successResponse({
    total: agendamentos?.length || 0,
    agendamentos: agendamentos?.map((ag: any) => ({
      id: ag.id,
      data: ag.data_agendamento,
      hora: ag.hora_agendamento,
      status: ag.status,
      paciente: ag.pacientes?.nome_completo,
      paciente_celular: ag.pacientes?.celular,
      medico: ag.medicos?.nome,
      atendimento: ag.atendimentos?.nome,
      convenio: ag.pacientes?.convenio
    })) || [],
    message: `Encontrado(s) ${agendamentos?.length || 0} agendamento(s).`
  });
}

// ============= HANDLER DE LISTAR MÉDICOS =============

async function handleListDoctors(supabase: any) {
  const { data: medicos, error } = await supabase
    .from('medicos')
    .select('id, nome, especialidade, convenios_aceitos')
    .eq('cliente_id', CLINICA_VENUS_ID)
    .eq('ativo', true);

  if (error) {
    return businessErrorResponse({
      codigo_erro: 'ERRO_BUSCA',
      mensagem_usuario: `Erro ao buscar médicos. Entre em contato: ${CLINIC_INFO.whatsapp}`
    });
  }

  let mensagem = `👨‍⚕️ MÉDICOS DA CLÍNICA VÊNUS:\n\n`;
  
  medicos?.forEach((m: any) => {
    const regras = BUSINESS_RULES_VENUS.medicos[m.id];
    mensagem += `• ${m.nome}\n`;
    mensagem += `  ${m.especialidade}\n`;
    if (regras) {
      mensagem += `  Tipo: ${regras.tipo_agendamento === 'hora_marcada' ? 'Hora Marcada' : 'Ordem de Chegada'}\n`;
      const servicos = Object.keys(regras.servicos).join(', ');
      mensagem += `  Serviços: ${servicos}\n`;
    }
    mensagem += '\n';
  });

  mensagem += `📍 ${CLINIC_INFO.endereco}\n`;
  mensagem += `📞 ${CLINIC_INFO.whatsapp}\n`;
  mensagem += `⏰ ${CLINIC_INFO.horario_funcionamento}`;

  return successResponse({
    medicos: medicos?.map((m: any) => ({
      id: m.id,
      nome: m.nome,
      especialidade: m.especialidade,
      convenios: m.convenios_aceitos,
      tipo_agendamento: BUSINESS_RULES_VENUS.medicos[m.id]?.tipo_agendamento || 'hora_marcada'
    })),
    mensagem_whatsapp: mensagem,
    message: mensagem
  });
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const action = pathSegments[pathSegments.length - 1];

    console.log(`\n🏥 [CLÍNICA VÊNUS v2.0] Ação: ${action}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = req.method === 'POST' ? await req.json() : {};

    switch (action) {
      case 'availability':
        return await handleAvailability(supabase, body);
      
      case 'schedule':
        return await handleSchedule(supabase, body);
      
      case 'check-patient':
        return await handleCheckPatient(supabase, body);
      
      case 'cancel':
        return await handleCancel(supabase, body);
      
      case 'confirm':
        return await handleConfirm(supabase, body);
      
      case 'reschedule':
        return await handleReschedule(supabase, body);
      
      case 'patient-search':
        return await handlePatientSearch(supabase, body);
      
      case 'list-appointments':
        return await handleListAppointments(supabase, body);
      
      case 'list-doctors':
      case 'doctors':
        return await handleListDoctors(supabase);
      
      case 'clinic-info':
        return successResponse({
          clinica: CLINIC_INFO,
          message: `🏥 ${CLINIC_INFO.nome}\n📍 ${CLINIC_INFO.endereco}\n📞 ${CLINIC_INFO.whatsapp}\n⏰ ${CLINIC_INFO.horario_funcionamento}`
        });

      default:
        return businessErrorResponse({
          codigo_erro: 'ACAO_INVALIDA',
          mensagem_usuario: `Ação "${action}" não reconhecida.\n\nAções disponíveis:\n• availability - Verificar disponibilidade\n• schedule - Agendar consulta\n• check-patient - Verificar agendamentos\n• cancel - Cancelar agendamento\n• confirm - Confirmar presença\n• reschedule - Reagendar consulta\n• patient-search - Buscar pacientes\n• list-appointments - Listar agendamentos\n• list-doctors - Listar médicos\n• clinic-info - Informações da clínica`
        });
    }

  } catch (error: any) {
    console.error('❌ [ERRO CRÍTICO]:', error);
    return businessErrorResponse({
      codigo_erro: 'ERRO_SISTEMA',
      mensagem_usuario: `Ocorreu um erro. Entre em contato: ${CLINIC_INFO.whatsapp}`,
      detalhes: error?.message
    });
  }
});
