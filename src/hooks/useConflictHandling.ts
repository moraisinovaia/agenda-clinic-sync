import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useConflictHandling() {
  const [conflictWarning, setConflictWarning] = useState<string>('');
  const [hasConflict, setHasConflict] = useState(false);
  const { toast } = useToast();

  const checkTimeConflict = useCallback(async (
    checkFunction: (doctorId: string, date: string, time: string) => Promise<any>,
    doctorId: string,
    date: string,
    time: string,
    excludeAppointmentId?: string
  ) => {
    if (!doctorId || !date || !time) {
      setConflictWarning('');
      setHasConflict(false);
      return;
    }

    try {
      const conflict = await checkFunction(doctorId, date, time);
      
      if (conflict && conflict.id !== excludeAppointmentId) {
        const patientName = conflict.pacientes?.nome_completo || 'Paciente não identificado';
        const warningMessage = `⚠️ ATENÇÃO: Este horário já está ocupado por ${patientName}`;
        setConflictWarning(warningMessage);
        setHasConflict(true);
      } else {
        setConflictWarning('');
        setHasConflict(false);
      }
    } catch (error) {
      console.error('Erro ao verificar conflito:', error);
      setConflictWarning('');
      setHasConflict(false);
    }
  }, []);

  const handleSubmitWithConflictCheck = useCallback(async (
    onSubmit: () => Promise<void>,
    preserveFormData?: boolean
  ) => {
    if (hasConflict) {
      toast({
        title: "Conflito de Horário",
        description: "Este horário já está ocupado. Por favor, escolha outro horário.",
        variant: "destructive",
      });
      return;
    }

    try {
      await onSubmit();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Se for erro de conflito, não limpar o formulário
      if (errorMessage.includes('já está ocupado')) {
        const patientMatch = errorMessage.match(/por (.+?)$/);
        const patientName = patientMatch ? patientMatch[1] : 'outro paciente';
        
        setConflictWarning(`⚠️ CONFLITO: Este horário está ocupado por ${patientName}`);
        setHasConflict(true);
        
        toast({
          title: "Conflito de Horário",
          description: `Este horário já está ocupado por ${patientName}. Escolha outro horário.`,
          variant: "destructive",
        });
      } else {
        // Para outros erros, mostrar toast normal
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      throw error; // Re-throw para que o formulário possa decidir se limpa ou não
    }
  }, [hasConflict, toast]);

  const clearConflict = useCallback(() => {
    setConflictWarning('');
    setHasConflict(false);
  }, []);

  return {
    conflictWarning,
    hasConflict,
    checkTimeConflict,
    handleSubmitWithConflictCheck,
    clearConflict
  };
}