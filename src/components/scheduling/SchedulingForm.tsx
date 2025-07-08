import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { Doctor, Atendimento, SchedulingFormData } from '@/types/scheduling';
import { PatientDataForm } from './PatientDataForm';
import { AppointmentDataForm } from './AppointmentDataForm';
import { useSchedulingForm } from '@/hooks/useSchedulingForm';

interface SchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  onSubmit: (data: SchedulingFormData) => Promise<void>;
  onCancel: () => void;
  getAtendimentosByDoctor: (doctorId: string) => Atendimento[];
}

export function SchedulingForm({ 
  doctors, 
  atendimentos, 
  onSubmit, 
  onCancel,
  getAtendimentosByDoctor 
}: SchedulingFormProps) {
  const { formData, setFormData, loading, handleSubmit } = useSchedulingForm();

  const selectedDoctor = doctors.find(doctor => doctor.id === formData.medicoId);
  const availableConvenios = selectedDoctor?.convenios_aceitos || [];
  const medicoSelected = !!formData.medicoId;

  console.log('Form medicoId:', formData.medicoId);
  console.log('Doctors array:', doctors);
  console.log('Selected doctor:', selectedDoctor);
  console.log('Available convenios:', availableConvenios);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Novo Agendamento
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={(e) => handleSubmit(e, onSubmit)} className="space-y-4">
          <PatientDataForm
            formData={formData}
            setFormData={setFormData}
            availableConvenios={availableConvenios}
            medicoSelected={medicoSelected}
          />

          <AppointmentDataForm
            formData={formData}
            setFormData={setFormData}
            doctors={doctors}
          />

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Agendando...' : 'Confirmar Agendamento'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}