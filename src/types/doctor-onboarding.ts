// Types for the complete doctor onboarding form

export interface PeriodoConfig {
  ativo: boolean;
  horario_inicio: string;
  horario_fim: string;
  limite_pacientes: number;
  // Campos específicos para "ordem de chegada"
  horario_inicio_medico?: string;
  horario_distribuicao_fichas?: string;
}

export interface ServicoConfig {
  id?: string;
  nome: string;
  tipo: 'exame' | 'consulta' | 'procedimento';
  permite_online: boolean;
  mensagem_personalizada?: string;
  dias_atendimento: number[]; // 0-6 (domingo-sábado)
  periodos: {
    manha: PeriodoConfig;
    tarde: PeriodoConfig;
    noite: PeriodoConfig;
  };
}

export interface PreparoConfig {
  id?: string;
  nome: string;
  exame: string;
  jejum_horas: number | null;
  restricoes_alimentares: string;
  medicacao_suspender: string;
  dias_suspensao: number | null;
  itens_levar: string;
  valor_particular: number | null;
  valor_convenio: number | null;
  forma_pagamento: string;
  observacoes_especiais: string;
}

export interface DoctorOnboardingFormData {
  // Seção 1: Dados Básicos
  nome: string;
  especialidade: string;
  ativo: boolean;
  
  // Seção 2: Restrições de Idade
  idade_minima: number | null;
  idade_maxima: number | null;
  atende_criancas: boolean;
  atende_adultos: boolean;
  
  // Seção 3: Convênios
  convenios_aceitos: string[];
  convenio_personalizado: string;
  convenios_restricoes: Record<string, string>;
  
  // Seção 4: Tipo de Agendamento
  tipo_agendamento: 'ordem_chegada' | 'hora_marcada';
  permite_agendamento_online: boolean;
  
  // Seção 5: Serviços/Atendimentos
  servicos: ServicoConfig[];
  
  // Seção 6: Observações
  observacoes_gerais: string;
  regras_especiais: string;
  restricoes_gerais: string;
  
  // Seção 7: Preparos (para exames)
  preparos: PreparoConfig[];
}

export const CONVENIOS_PADRAO = [
  'PARTICULAR',
  'UNIMED NACIONAL',
  'UNIMED REGIONAL',
  'UNIMED 40%',
  'UNIMED 20%',
  'UNIMED INTERCÂMBIO',
  'BRADESCO',
  'SULAMERICA',
  'AMIL',
  'HAPVIDA',
  'NOTREDAME',
  'CASSI',
  'GEAP',
  'IPSEMG',
  'PLANSERV',
] as const;

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
] as const;

export const TIPOS_SERVICO = [
  { value: 'exame', label: 'Exame' },
  { value: 'consulta', label: 'Consulta' },
  { value: 'procedimento', label: 'Procedimento' },
] as const;

export const initialPeriodoConfig: PeriodoConfig = {
  ativo: false,
  horario_inicio: '08:00',
  horario_fim: '12:00',
  limite_pacientes: 10,
};

export const initialServicoConfig: ServicoConfig = {
  nome: '',
  tipo: 'consulta',
  permite_online: true,
  mensagem_personalizada: '',
  dias_atendimento: [1, 2, 3, 4, 5], // Segunda a sexta por padrão
  periodos: {
    manha: { ...initialPeriodoConfig, ativo: true },
    tarde: { ...initialPeriodoConfig, ativo: false, horario_inicio: '14:00', horario_fim: '18:00' },
    noite: { ...initialPeriodoConfig, ativo: false, horario_inicio: '18:00', horario_fim: '21:00' },
  },
};

export const initialPreparoConfig: PreparoConfig = {
  nome: '',
  exame: '',
  jejum_horas: null,
  restricoes_alimentares: '',
  medicacao_suspender: '',
  dias_suspensao: null,
  itens_levar: '',
  valor_particular: null,
  valor_convenio: null,
  forma_pagamento: '',
  observacoes_especiais: '',
};

export const initialDoctorFormData: DoctorOnboardingFormData = {
  nome: '',
  especialidade: '',
  ativo: true,
  idade_minima: 0,
  idade_maxima: null,
  atende_criancas: true,
  atende_adultos: true,
  convenios_aceitos: [],
  convenio_personalizado: '',
  convenios_restricoes: {},
  tipo_agendamento: 'ordem_chegada',
  permite_agendamento_online: true,
  servicos: [],
  observacoes_gerais: '',
  regras_especiais: '',
  restricoes_gerais: '',
  preparos: [],
};
