/**
 * Regras de negócio para status de agendamentos
 * Define quais ações são permitidas para cada status
 */

export type AppointmentStatus = 
  | 'agendado' 
  | 'confirmado' 
  | 'cancelado' 
  | 'cancelado_bloqueio'
  | 'realizado'
  | 'excluido';

export interface StatusRules {
  canConfirm: boolean;
  canUnconfirm: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canEdit: boolean;
  confirmDisabledReason?: string;
  cancelDisabledReason?: string;
  deleteDisabledReason?: string;
}

/**
 * Mapa de regras baseado no status atual do agendamento
 * Alinhado com as funções RPC do Supabase:
 * - confirmar_agendamento: só permite status 'agendado'
 * - desconfirmar_agendamento: só permite status 'confirmado'
 * - cancelar_agendamento_soft: só permite 'agendado' ou 'confirmado'
 * - excluir_agendamento_soft: só permite 'cancelado'
 */
export const APPOINTMENT_STATUS_RULES: Record<AppointmentStatus, StatusRules> = {
  agendado: {
    canConfirm: true,
    canUnconfirm: false,
    canCancel: true,
    canDelete: false,
    canEdit: true,
    deleteDisabledReason: 'Só é possível excluir agendamentos cancelados'
  },
  
  confirmado: {
    canConfirm: false,
    canUnconfirm: true,
    canCancel: true,
    canDelete: false,
    canEdit: true,
    confirmDisabledReason: 'Agendamento já está confirmado',
    deleteDisabledReason: 'Só é possível excluir agendamentos cancelados'
  },
  
  cancelado: {
    canConfirm: false,
    canUnconfirm: false,
    canCancel: false,
    canDelete: true,
    canEdit: false,
    confirmDisabledReason: 'Não é possível confirmar agendamento cancelado',
    cancelDisabledReason: 'Agendamento já está cancelado'
  },
  
  cancelado_bloqueio: {
    canConfirm: false,
    canUnconfirm: false,
    canCancel: false,
    canDelete: false,
    canEdit: false,
    confirmDisabledReason: 'Agendamento cancelado por bloqueio de agenda. Aguarde a reabertura da agenda.',
    cancelDisabledReason: 'Agendamento já foi cancelado automaticamente por bloqueio',
    deleteDisabledReason: 'Agendamento será restaurado quando a agenda for reaberta'
  },
  
  realizado: {
    canConfirm: false,
    canUnconfirm: false,
    canCancel: false,
    canDelete: false,
    canEdit: false,
    confirmDisabledReason: 'Agendamento já foi realizado',
    cancelDisabledReason: 'Não é possível cancelar agendamento já realizado',
    deleteDisabledReason: 'Não é possível excluir agendamento realizado'
  },
  
  excluido: {
    canConfirm: false,
    canUnconfirm: false,
    canCancel: false,
    canDelete: false,
    canEdit: false,
    confirmDisabledReason: 'Agendamento foi excluído',
    cancelDisabledReason: 'Agendamento foi excluído',
    deleteDisabledReason: 'Agendamento já foi excluído'
  }
};

/**
 * Obtém as regras de negócio para um status específico
 */
export function getStatusRules(status: string): StatusRules {
  const normalizedStatus = (status || 'agendado') as AppointmentStatus;
  return APPOINTMENT_STATUS_RULES[normalizedStatus] || APPOINTMENT_STATUS_RULES.agendado;
}

/**
 * Mensagens de erro amigáveis para exibir ao usuário
 */
export const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  'Agendamento não encontrado ou já foi cancelado': 'Este agendamento já está cancelado ou não pode mais ser cancelado.',
  'Agendamento não encontrado ou não pode ser confirmado': 'Este agendamento não está em um status que permita confirmação.',
  'Agendamento não encontrado ou não pode ser excluído': 'Só é possível excluir agendamentos que foram cancelados.',
  'Agendamento não encontrado ou não pode ser desconfirmado': 'Este agendamento não está confirmado.',
};

/**
 * Converte mensagem de erro técnica em mensagem amigável
 */
export function getFriendlyErrorMessage(technicalError: string): string {
  return FRIENDLY_ERROR_MESSAGES[technicalError] || technicalError;
}
