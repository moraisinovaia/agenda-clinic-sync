// ============= TIPOS E INTERFACES CENTRAIS =============

export interface StructuredLog {
  timestamp: string;
  request_id: string;
  cliente_id: string;
  config_id?: string;
  medico_id?: string;
  action: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  phase: 'request' | 'processing' | 'response';
  duration_ms?: number;
  success?: boolean;
  error_code?: string;
  metadata?: Record<string, any>;
}

export interface DynamicConfig {
  clinic_info: {
    nome_clinica: string;
    telefone: string;
    whatsapp: string;
    endereco: string;
    data_minima_agendamento: string;
    dias_busca_inicial: number;
    dias_busca_expandida: number;
    mensagem_bloqueio_padrao: string;
  } | null;
  business_rules: Record<string, {
    medico_id: string;
    medico_nome: string;
    config: any;
  }>;
  mensagens: Record<string, {
    id: string;
    tipo: string;
    medico_id: string | null;
    mensagem: string;
    ativo: boolean;
  }> | Array<{
    id: string;
    tipo: string;
    medico_id: string | null;
    mensagem: string;
  }>;
  loadedAt: number;
}

export interface ConfigCache {
  data: DynamicConfig;
  clienteId: string;
}

export interface RequestScope {
  doctorIds: string[];
  doctorNames: string[];
  serviceNames: string[];
}

export interface LimiteCompartilhadoResult {
  permitido: boolean;
  erro_codigo?: 'LIMITE_POOL_ATINGIDO' | 'SUBLIMITE_PROPRIO_ATINGIDO';
  mensagem?: string;
  detalhes?: {
    pool_nome?: string;
    pool_limite?: number;
    pool_ocupado?: number;
    sublimite?: number;
    sublimite_ocupado?: number;
    servicos_pool?: string[];
  };
}

export interface ConvenioSublimiteResult {
  permitido: boolean;
  erro_codigo?: 'SUBLIMITE_CONVENIO_ATINGIDO';
  mensagem?: string;
  detalhes?: {
    convenio: string;
    sublimite: number;
    ocupado: number;
    limite_geral_turno: number;
  };
}

export interface ConsolidatedPatient {
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
