// ============= FUNÇÕES DE NORMALIZAÇÃO E DATA =============

/**
 * Formata data em português por extenso (ex: "06/02/2026")
 */
export function formatarDataPorExtenso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Função auxiliar para obter dia da semana (0=dom, 1=seg, ...)
// ✅ CORRIGIDO: Forçar interpretação local da data (evitar deslocamento UTC)
export function getDiaSemana(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay(); // Mês é 0-indexed
}

/**
 * Normaliza data de nascimento de vários formatos para YYYY-MM-DD
 * Aceita: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD
 */
export function normalizarDataNascimento(data: string | null | undefined): string | null {
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
export function normalizarTelefone(telefone: string | null | undefined): string | null {
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
 * Normaliza convênio para comparação — espelha o regexp do banco:
 *   regexp_replace(upper(trim(c)), '[^A-Z0-9%]+', '', 'g')
 * Remove tudo exceto letras A-Z, dígitos e %. Usar só para comparar,
 * nunca para armazenar (armazenamento usa upper(trim())).
 */
export function normalizarConvenioParaComparacao(convenio: string): string {
  return convenio.toUpperCase().trim().replace(/[^A-Z0-9%]/g, '');
}

/**
 * Normaliza nome do paciente
 * Remove espaços extras e capitaliza corretamente
 */
export function normalizarNome(nome: string | null | undefined): string | null {
  if (!nome) return null;

  return nome
    .trim()
    .replace(/\s+/g, ' ') // Remove espaços duplicados
    .toUpperCase();
}

/**
 * 🛡️ Sanitiza valores inválidos vindos do N8N/LLM
 * Converte: "indefinido", "undefined", "null", "", "None" → undefined
 * Também trata textos conversacionais como "próximas datas disponíveis" → undefined
 */
export function sanitizarCampoOpcional(valor: any): any {
  if (valor === null || valor === undefined) return undefined;

  if (typeof valor === 'string') {
    const valorTrim = valor.trim().toLowerCase();

    // Lista de valores inválidos comuns
    const valoresInvalidos = [
      'indefinido', 'undefined', 'null', 'none',
      'n/a', 'na', '', 'empty'
    ];

    // 🆕 Padrões de texto conversacional que indicam "buscar datas automaticamente"
    const padroesConversacionais = [
      'próximas datas',
      'proximas datas',
      'datas disponíveis',
      'datas disponiveis',
      'qualquer data',
      'qualquer dia',
      'primeiro horário',
      'primeiro horario',
      'próximo horário',
      'proximo horario',
      'mais próxima',
      'mais proxima',
      'próxima data',
      'proxima data',
      'próximo disponível',
      'proximo disponivel',
      'qualquer horário',
      'qualquer horario',
      'o mais rápido',
      'o mais rapido',
      'mais cedo possível',
      'mais cedo possivel'
    ];

    if (valoresInvalidos.includes(valorTrim)) {
      console.log(`🧹 Campo com valor inválido "${valor}" convertido para undefined`);
      return undefined;
    }

    // 🆕 Verificar se contém padrão conversacional
    for (const padrao of padroesConversacionais) {
      if (valorTrim.includes(padrao)) {
        console.log(`🧹 Campo com texto conversacional "${valor}" convertido para undefined (trigger: "${padrao}")`);
        return undefined;
      }
    }
  }

  return valor;
}

// Função para mapear dados flexivelmente
export function mapSchedulingData(body: any) {
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
