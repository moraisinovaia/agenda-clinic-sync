import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Doctor, Atendimento, SchedulingFormData } from '@/types/scheduling';
import { PatientDataFormFixed } from './PatientDataFormFixed';
import { AppointmentDataForm } from './AppointmentDataForm';
import { useSchedulingForm } from '@/hooks/useSchedulingForm';
import { useToast } from '@/hooks/use-toast';

interface ImprovedSchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  onSubmit: (data: SchedulingFormData) => Promise<void>;
  onCancel: () => void;
  getAtendimentosByDoctor: (doctorId: string) => Atendimento[];
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
  editingAppointment?: any;
  isTimeSlotOccupied?: (doctorId: string, date: string, time: string) => boolean;
  preSelectedDoctor?: string;
  preSelectedDate?: string;
}

export function ImprovedSchedulingForm({ 
  doctors, 
  atendimentos, 
  onSubmit, 
  onCancel, 
  getAtendimentosByDoctor,
  searchPatientsByBirthDate,
  editingAppointment,
  isTimeSlotOccupied,
  preSelectedDoctor,
  preSelectedDate
}: ImprovedSchedulingFormProps) {
  const [conflictWarning, setConflictWarning] = useState<string>('');
  const { toast } = useToast();

  // Preparar dados iniciais para edição
  const initialEditData = editingAppointment ? {
    nomeCompleto: editingAppointment.pacientes?.nome_completo || '',
    dataNascimento: editingAppointment.pacientes?.data_nascimento || '',
    convenio: editingAppointment.pacientes?.convenio || '',
    telefone: editingAppointment.pacientes?.telefone || '',
    celular: editingAppointment.pacientes?.celular || '',
    medicoId: editingAppointment.medico_id,
    atendimentoId: editingAppointment.atendimento_id,
    dataAgendamento: editingAppointment.data_agendamento,
    horaAgendamento: editingAppointment.hora_agendamento,
    observacoes: editingAppointment.observacoes || '',
  } : undefined;

  const { formData, setFormData, loading, handleSubmit } = useSchedulingForm({
    initialData: initialEditData,
    preSelectedDoctor,
    preSelectedDate
  });

  // Verificar conflitos de horário
  const checkTimeConflict = useCallback(() => {
    if (formData.medicoId && formData.dataAgendamento && formData.horaAgendamento) {
      if (isTimeSlotOccupied && isTimeSlotOccupied(formData.medicoId, formData.dataAgendamento, formData.horaAgendamento)) {
        setConflictWarning(`⚠️ Horário ${formData.horaAgendamento} já ocupado para este médico na data ${formData.dataAgendamento}`);
        return true;
      }
    }
    setConflictWarning('');
    return false;
  }, [formData.medicoId, formData.dataAgendamento, formData.horaAgendamento, isTimeSlotOccupied]);

  // Wrapper do onSubmit que preserva dados em caso de erro
  const handleImprovedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar conflito antes de submeter - apenas avisar, não impedir
    if (checkTimeConflict()) {
      toast({
        title: "⚠️ Conflito de horário detectado",
        description: "Este horário já está ocupado. Verifique se realmente deseja continuar.",
        variant: "default",
      });
    }
    
    try {
      // Sempre tentar submeter - deixar o backend validar e retornar erro se necessário
      await onSubmit(formData);
      // Só limpar em caso de sucesso (o onSubmit original já trata isso)
    } catch (error) {
      // Em caso de erro, preservar todos os dados do formulário
      console.error('Erro ao submeter agendamento:', error);
      // O formulário manterá todos os dados preenchidos
      // O erro será exibido pelo useSchedulingForm ou componente pai
    }
  };

  const selectedDoctor = doctors.find(doctor => doctor.id === formData.medicoId);
  const availableConvenios = selectedDoctor?.convenios_aceitos || [];
  const medicoSelected = !!formData.medicoId;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleImprovedSubmit} className="space-y-6">
          {/* Alerta de conflito */}
          {conflictWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {conflictWarning}
              </AlertDescription>
            </Alert>
          )}

          <PatientDataFormFixed
            formData={formData}
            setFormData={setFormData}
            availableConvenios={availableConvenios}
            medicoSelected={medicoSelected}
            selectedDoctor={selectedDoctor}
          />

          <AppointmentDataForm
            formData={formData}
            setFormData={setFormData}
            doctors={doctors}
            atendimentos={atendimentos}
          />

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1"
            >
              {loading 
                ? (editingAppointment ? 'Atualizando...' : 'Agendando...') 
                : (editingAppointment ? 'Atualizar Agendamento' : 'Confirmar Agendamento')
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}