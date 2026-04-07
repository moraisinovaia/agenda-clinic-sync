export interface CountByPeriodParams {
  medicoId: string;
  clienteId: string;
  date: string;        // YYYY-MM-DD
  start: string;       // "07:00"
  end: string;         // "12:00"
  minimumDate?: string;
}

/**
 * Conta agendamentos dentro de uma janela de capacidade (pool de fichas/vagas).
 * Semântica: quantas unidades de um pool de capacidade já foram consumidas.
 * Usado para o modo capacity_window.
 */
export interface CountByPoolParams {
  medicoId: string;
  clienteId: string;
  date: string;        // YYYY-MM-DD
  poolStart: string;   // início da janela do pool
  poolEnd: string;     // fim da janela do pool
  minimumDate?: string;
}

// ─── BookAppointmentUseCase params ───────────────────────────────────────────

export interface IsSlotTakenParams {
  medicoId: string;
  clienteId: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM:SS — exact match
}

export interface FindDuplicateParams {
  idempotencyKey: string;
  clienteId: string;
}

export interface DuplicateResult {
  found: boolean;
  appointmentId?: string;
  patientId?: string;
}

export interface CreateAppointmentParams {
  clienteId: string;
  nomeCompleto: string;   // pre-uppercased
  dataNascimento: string;
  convenio: string;       // pre-formatted
  telefone?: string | null;
  celular: string;
  medicoId: string;
  atendimentoId: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM:SS
  observacoes: string;
  criadoPor: string;
  idempotencyKey: string;
}

export interface CreateAppointmentResult {
  appointmentId: string;
  patientId: string;
  backendMessage?: string;
}

export interface AppointmentRepository {
  /** Para time_slot: conta agendamentos num intervalo de tempo específico */
  countByPeriod(params: CountByPeriodParams): Promise<number>;

  /** Para capacity_window: conta unidades consumidas de um pool de capacidade */
  countByPool(params: CountByPoolParams): Promise<number>;

  /** Pré-check de UX: verifica se um slot específico já está ocupado */
  isSlotTaken(params: IsSlotTakenParams): Promise<boolean>;

  /**
   * Idempotency check: busca agendamento existente pela chave heurística.
   * Chave gerada pelo adapter: clienteId:celular:medicoId:date:time
   */
  findDuplicate(params: FindDuplicateParams): Promise<DuplicateResult>;

  /** Cria o agendamento via RPC atômica. Lança SlotAlreadyTakenError em caso de CONFLICT. */
  create(params: CreateAppointmentParams): Promise<CreateAppointmentResult>;

  /** Busca agendamento pelo ID com isolamento por tenant. Retorna null se não encontrado. */
  findById(params: { id: string; clienteId: string }): Promise<import('../domain/types.ts').AppointmentDetails | null>;

  /**
   * Cancela o agendamento: seta status='cancelado' e appenda o motivo nas observacoes.
   * O append de observacoes é responsabilidade do repository.
   */
  cancel(params: CancelAppointmentRepoParams): Promise<void>;
}

export interface CancelAppointmentRepoParams {
  id: string;
  clienteId: string;
  motivo?: string;
  canceladoPor: string;
}
