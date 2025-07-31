import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, ArrowLeft } from 'lucide-react';
import { Doctor, Atendimento } from '@/types/scheduling';
import { MultipleSchedulingFormData } from '@/types/multiple-scheduling';
import { PatientDataFormMultiple } from './PatientDataFormMultiple';
import { MultipleAppointmentDataForm } from './MultipleAppointmentDataForm';
import { useMultipleScheduling } from '@/hooks/useMultipleScheduling';

interface MultipleSchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  onSuccess: () => void;
  onCancel: () => void;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
}

const initialFormData: MultipleSchedulingFormData = {
  nomeCompleto: '',
  dataNascimento: '',
  convenio: '',
  telefone: '',
  celular: '',
  medicoId: '',
  atendimentoIds: [],
  dataAgendamento: '',
  horaAgendamento: '',
  observacoes: '',
};

export function MultipleSchedulingForm({
  doctors,
  atendimentos,
  onSuccess,
  onCancel,
  searchPatientsByBirthDate
}: MultipleSchedulingFormProps) {
  const [formData, setFormData] = useState<MultipleSchedulingFormData>(initialFormData);
  const { loading, createMultipleAppointment } = useMultipleScheduling();

  const selectedDoctor = doctors.find(doctor => doctor.id === formData.medicoId);
  const availableConvenios = selectedDoctor?.convenios_aceitos || [];
  const medicoSelected = !!formData.medicoId;
  const selectedAtendimentos = atendimentos.filter(a => formData.atendimentoIds.includes(a.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.atendimentoIds.length === 0) {
      alert('Selecione pelo menos um exame/procedimento');
      return;
    }

    try {
      await createMultipleAppointment(formData);
      onSuccess();
    } catch (error) {
      // Erro já tratado no hook
      console.error('Erro no formulário:', error);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Agendamento Múltiplo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Agende múltiplos exames para o mesmo paciente em uma única sessão
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados do Paciente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados do Paciente</CardTitle>
              </CardHeader>
              <CardContent>
                <PatientDataFormMultiple
                  formData={formData}
                  setFormData={setFormData}
                  availableConvenios={availableConvenios}
                  medicoSelected={medicoSelected}
                  selectedDoctor={selectedDoctor}
                  foundPatients={[]}
                  searchingPatients={false}
                  showPatientsList={false}
                  onSearchPatients={async () => {}}
                  onSelectPatient={() => {}}
                  onCreateNewPatient={() => {}}
                />
              </CardContent>
            </Card>

            {/* Dados do Agendamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados do Agendamento</CardTitle>
              </CardHeader>
              <CardContent>
                <MultipleAppointmentDataForm
                  formData={formData}
                  setFormData={setFormData}
                  doctors={doctors}
                  atendimentos={atendimentos}
                />
              </CardContent>
            </Card>

            {/* Preview dos Agendamentos */}
            {selectedAtendimentos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo do Agendamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Paciente:</span> {formData.nomeCompleto || 'Não informado'}
                    </div>
                    <div>
                      <span className="font-medium">Médico:</span> {selectedDoctor?.nome || 'Não selecionado'}
                    </div>
                    <div>
                      <span className="font-medium">Data:</span> {formData.dataAgendamento || 'Não informada'}
                    </div>
                    <div>
                      <span className="font-medium">Horário:</span> {formData.horaAgendamento || 'Não informado'}
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium text-sm">Exames/Procedimentos:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedAtendimentos.map((atendimento) => (
                        <Badge key={atendimento.id} variant="secondary">
                          {atendimento.nome}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {formData.observacoes && (
                    <div>
                      <span className="font-medium text-sm">Observações:</span>
                      <p className="text-sm text-muted-foreground mt-1">{formData.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || formData.atendimentoIds.length === 0} 
                className="flex-1"
              >
                {loading ? 'Agendando...' : `Confirmar Agendamento (${selectedAtendimentos.length} exames)`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}