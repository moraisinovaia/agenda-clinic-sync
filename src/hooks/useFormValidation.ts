import { useState, useCallback } from 'react';
import { SchedulingFormData } from '@/types/scheduling';

interface ValidationErrors {
  [key: string]: string;
}

interface UseFormValidationReturn {
  errors: ValidationErrors;
  isValid: boolean;
  validateField: (field: string, value: any, formData?: SchedulingFormData) => string | null;
  validateForm: (formData: SchedulingFormData) => { isValid: boolean; errors: ValidationErrors };
  clearError: (field: string) => void;
  setError: (field: string, error: string) => void;
  clearAllErrors: () => void;
}

// Helper function to check if doctor is one of Dr. Marcelo's
const isMedicoMarcelo = (medicoId?: string): boolean => {
  if (!medicoId) return false;
  const marceloIds = [
    '1e110923-50df-46ff-a57a-29d88e372900', // Dr. Marcelo D'Carli
    'e6453b94-840d-4adf-ab0f-fc22be7cd7f5', // MAPA - Dr. Marcelo  
    '9d5d0e63-098b-4282-aa03-db3c7e012579'  // Teste Ergométrico - Dr. Marcelo
  ];
  return marceloIds.includes(medicoId);
};

export function useFormValidation(): UseFormValidationReturn {
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = useCallback((field: string, value: any, formData?: SchedulingFormData): string | null => {
    let error: string | null = null;

    switch (field) {
      case 'nomeCompleto':
        if (!value || value.trim().length < 2) {
          error = 'Nome completo é obrigatório (mínimo 2 caracteres)';
        }
        break;

      case 'dataNascimento':
        // Skip birth date validation for Dr. Marcelo's appointments
        if (!value && !isMedicoMarcelo(formData?.medicoId)) {
          error = 'Data de nascimento é obrigatória';
        } else if (value) {
          const birthDate = new Date(value);
          const today = new Date();
          if (birthDate >= today) {
            error = 'Data de nascimento deve ser anterior à data atual';
          }
        }
        break;

      case 'convenio':
        if (!value || value.trim().length === 0) {
          error = 'Convênio é obrigatório';
        }
        break;

      case 'celular':
        if (!value || value.trim().length < 10) {
          error = 'Celular é obrigatório (mínimo 10 dígitos)';
        }
        break;

      case 'medicoId':
        if (!value) {
          error = 'Médico é obrigatório';
        }
        break;

      case 'atendimentoId':
        if (!value) {
          error = 'Tipo de atendimento é obrigatório';
        }
        break;

      case 'dataAgendamento':
        if (!value) {
          error = 'Data do agendamento é obrigatória';
        } else {
          const appointmentDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (appointmentDate < today) {
            error = 'Data do agendamento não pode ser no passado';
          }
        }
        break;

      case 'horaAgendamento':
        if (!value) {
          error = 'Horário do agendamento é obrigatório';
        }
        break;

      default:
        break;
    }

    return error;
  }, []);

  const validateForm = useCallback((formData: SchedulingFormData) => {
    const newErrors: ValidationErrors = {};
    const fieldsToValidate = [
      'nomeCompleto',
      'dataNascimento', 
      'convenio',
      'celular',
      'medicoId',
      'atendimentoId',
      'dataAgendamento',
      'horaAgendamento'
    ];

    fieldsToValidate.forEach(field => {
      const value = formData[field as keyof SchedulingFormData];
      const error = validateField(field, value, formData);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors
    };
  }, [validateField]);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    errors,
    isValid,
    validateField,
    validateForm,
    clearError,
    setError,
    clearAllErrors
  };
}