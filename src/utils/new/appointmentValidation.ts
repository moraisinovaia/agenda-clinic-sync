import { AppointmentFormData } from '@/hooks/new/useFormState';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateAppointmentForm(data: AppointmentFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Nome completo
  if (!data.nomeCompleto.trim()) {
    errors.nomeCompleto = 'Nome completo é obrigatório';
  } else if (data.nomeCompleto.trim().length < 3) {
    errors.nomeCompleto = 'Nome deve ter pelo menos 3 caracteres';
  }

  // Data de nascimento
  if (!data.dataNascimento) {
    errors.dataNascimento = 'Data de nascimento é obrigatória';
  } else {
    const birthDate = new Date(data.dataNascimento);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    if (age > 120 || age < 0) {
      errors.dataNascimento = 'Data de nascimento inválida';
    }
  }

  // Convênio
  if (!data.convenio.trim()) {
    errors.convenio = 'Convênio é obrigatório';
  }

  // Telefone ou celular
  if (!data.telefone.trim() && !data.celular.trim()) {
    errors.telefone = 'Telefone ou celular é obrigatório';
  }

  // Médico
  if (!data.medicoId) {
    errors.medicoId = 'Médico é obrigatório';
  }

  // Atendimento
  if (!data.atendimentoId) {
    errors.atendimentoId = 'Tipo de atendimento é obrigatório';
  }

  // Data do agendamento
  if (!data.dataAgendamento) {
    errors.dataAgendamento = 'Data do agendamento é obrigatória';
  } else {
    const appointmentDate = new Date(data.dataAgendamento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      errors.dataAgendamento = 'Data não pode ser no passado';
    }
  }

  // Hora do agendamento
  if (!data.horaAgendamento) {
    errors.horaAgendamento = 'Hora do agendamento é obrigatória';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateField(field: keyof AppointmentFormData, value: string, allData?: AppointmentFormData): string | null {
  switch (field) {
    case 'nomeCompleto':
      if (!value.trim()) return 'Nome completo é obrigatório';
      if (value.trim().length < 3) return 'Nome deve ter pelo menos 3 caracteres';
      break;
      
    case 'dataNascimento':
      if (!value) return 'Data de nascimento é obrigatória';
      const birthDate = new Date(value);
      const now = new Date();
      const age = now.getFullYear() - birthDate.getFullYear();
      if (age > 120 || age < 0) return 'Data de nascimento inválida';
      break;
      
    case 'convenio':
      if (!value.trim()) return 'Convênio é obrigatório';
      break;
      
    case 'medicoId':
      if (!value) return 'Médico é obrigatório';
      break;
      
    case 'atendimentoId':
      if (!value) return 'Tipo de atendimento é obrigatório';
      break;
      
    case 'dataAgendamento':
      if (!value) return 'Data do agendamento é obrigatória';
      const appointmentDate = new Date(value);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      if (appointmentDate < currentDate) return 'Data não pode ser no passado';
      break;
      
    case 'horaAgendamento':
      if (!value) return 'Hora do agendamento é obrigatória';
      break;
  }
  
  return null;
}