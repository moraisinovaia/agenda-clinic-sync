import { useState, useCallback } from 'react';

export interface AppointmentFormData {
  nomeCompleto: string;
  dataNascimento: string;
  convenio: string;
  telefone: string;
  celular: string;
  medicoId: string;
  atendimentoId: string;
  dataAgendamento: string;
  horaAgendamento: string;
  observacoes: string;
}

const initialFormData: AppointmentFormData = {
  nomeCompleto: '',
  dataNascimento: '',
  convenio: '',
  telefone: '',
  celular: '',
  medicoId: '',
  atendimentoId: '',
  dataAgendamento: '',
  horaAgendamento: '',
  observacoes: ''
};

export function useFormState() {
  const [formData, setFormData] = useState<AppointmentFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const updateField = useCallback((field: keyof AppointmentFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpar erro do campo quando usuário digita
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const setFieldTouched = useCallback((field: keyof AppointmentFormData) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setTouched({});
  }, []);

  const isFieldValid = useCallback((field: keyof AppointmentFormData) => {
    return !errors[field] && touched[field];
  }, [errors, touched]);

  return {
    formData,
    errors,
    touched,
    updateField,
    setFieldTouched,
    setFieldError,
    clearErrors,
    resetForm,
    isFieldValid
  };
}