import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Doctor, Atendimento, SchedulingFormData } from '@/types/scheduling';
import { PatientDataFormFixed } from './PatientDataFormFixed';
import { AppointmentDataForm } from './AppointmentDataForm';
import { ConflictConfirmationModal } from './ConflictConfirmationModal';
import { useSchedulingForm } from '@/hooks/useSchedulingForm';
import { useToast } from '@/hooks/use-toast';

interface ImprovedSchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  onSubmit: (data: SchedulingFormData) => Promise<void>;
  onSubmitWithForce: (data: SchedulingFormData) => Promise<void>;
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
  onSubmitWithForce,
  onCancel, 
  getAtendimentosByDoctor,
  searchPatientsByBirthDate,
  editingAppointment,
  isTimeSlotOccupied,
  preSelectedDoctor,
  preSelectedDate
}: ImprovedSchedulingFormProps) {
  const [conflictWarning, setConflictWarning] = useState<string>('');
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingConflictData, setPendingConflictData] = useState<{
    formData: SchedulingFormData;
    conflictDetails: any;
  } | null>(null);
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
    
    try {
      // Tentar submeter normalmente
      await onSubmit(formData);
    } catch (error: any) {
      // Se é erro de conflito, mostrar modal de confirmação
      if (error.isConflict) {
        setPendingConflictData({
          formData,
          conflictDetails: error.conflictDetails
        });
        setShowConflictModal(true);
        return;
      }
      
      // Para outros erros, não fazer nada - dados já estão preservados
      console.error('Erro ao submeter agendamento:', error);
    }
  };

  const handleConfirmConflict = async () => {
    if (!pendingConflictData) return;
    
    try {
      // Chamar onSubmitWithForce com flag para forçar conflito
      await onSubmitWithForce(pendingConflictData.formData);
      setShowConflictModal(false);
      setPendingConflictData(null);
    } catch (error) {
      console.error('Erro ao forçar agendamento:', error);
      toast({
        title: "Erro ao criar agendamento",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    }
  };

  const handleCancelConflict = () => {
    setShowConflictModal(false);
    setPendingConflictData(null);
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
      
      <ConflictConfirmationModal
        open={showConflictModal}
        onConfirm={handleConfirmConflict}
        onCancel={handleCancelConflict}
        conflictMessage={pendingConflictData?.conflictDetails?.conflict_message || "Este horário já está ocupado"}
        conflictDetails={pendingConflictData?.conflictDetails}
      />
    </Card>
  );
}