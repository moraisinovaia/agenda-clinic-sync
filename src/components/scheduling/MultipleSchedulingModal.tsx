import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, X } from "lucide-react";
import { PatientDataFormFixed } from './PatientDataFormFixed';
import { AppointmentDataFormMultiple } from './AppointmentDataFormMultiple';
import { ExamSelectionForm } from './ExamSelectionForm';
import { MultipleAppointmentPreview } from './MultipleAppointmentPreview';
import { useMultipleAppointments } from '@/hooks/useMultipleAppointments';
import { SchedulingFormData, Doctor, Atendimento } from '@/types/scheduling';
import { SelectedExam, MultipleAppointmentData } from '@/types/multiple-appointments';

interface MultipleSchedulingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  atendimentos: Atendimento[];
  availableConvenios: string[];
  onSuccess: () => void;
}

export function MultipleSchedulingModal({
  open,
  onOpenChange,
  doctors,
  atendimentos,
  availableConvenios,
  onSuccess
}: MultipleSchedulingModalProps) {
  const { createMultipleAppointments, loading } = useMultipleAppointments();
  
  const [formData, setFormData] = useState<SchedulingFormData>({
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
  });
  
  const [selectedExams, setSelectedExams] = useState<SelectedExam[]>([]);

  const selectedDoctor = doctors.find(d => d.id === formData.medicoId) || null;
  const availableExams = selectedDoctor ? 
    atendimentos.filter(a => a.medico_id === selectedDoctor.id && a.ativo) : 
    [];

  // Filtrar convênios baseado no médico selecionado
  const filteredConvenios = selectedDoctor && selectedDoctor.convenios_aceitos 
    ? availableConvenios.filter(convenio => 
        selectedDoctor.convenios_aceitos?.some(medConvenio => 
          medConvenio.toLowerCase() === convenio.toLowerCase()
        )
      )
    : availableConvenios;

  const handleExamChange = (exam: Atendimento, checked: boolean) => {
    setSelectedExams(prev => {
      if (checked) {
        return [...prev, { id: exam.id, nome: exam.nome, tipo: exam.tipo }];
      } else {
        return prev.filter(selected => selected.id !== exam.id);
      }
    });
  };

  const handleRemoveExam = (examId: string) => {
    setSelectedExams(prev => prev.filter(exam => exam.id !== examId));
  };

  const handleDoctorChange = () => {
    // Limpar exames selecionados quando trocar de médico
    setSelectedExams([]);
  };

  useEffect(() => {
    handleDoctorChange();
  }, [formData.medicoId]);

  const handleSubmit = async () => {
    if (selectedExams.length === 0) {
      return;
    }

    try {
      const multipleData: MultipleAppointmentData = {
        nomeCompleto: formData.nomeCompleto,
        dataNascimento: formData.dataNascimento,
        convenio: formData.convenio,
        telefone: formData.telefone,
        celular: formData.celular,
        medicoId: formData.medicoId,
        atendimentoIds: selectedExams.map(exam => exam.id),
        dataAgendamento: formData.dataAgendamento,
        horaAgendamento: formData.horaAgendamento,
        observacoes: formData.observacoes
      };

      await createMultipleAppointments(multipleData);
      onSuccess();
      handleClose();
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleClose = () => {
    setFormData({
      nomeCompleto: '',
      dataNascimento: '',
      convenio: '',
      telefone: '',
      celular: '',
      medicoId: '',
      atendimentoId: '', // Mantido para compatibilidade, mas não será usado
      dataAgendamento: '',
      horaAgendamento: '',
      observacoes: ''
    });
    setSelectedExams([]);
    onOpenChange(false);
  };

  const isFormValid = formData.nomeCompleto && 
                     formData.dataNascimento && 
                     formData.convenio && 
                     formData.medicoId && 
                     formData.dataAgendamento && 
                     formData.horaAgendamento && 
                     selectedExams.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Agendar Múltiplos Exames
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção 1: Dados do Paciente */}
          <PatientDataFormFixed
            formData={formData}
            setFormData={setFormData}
            availableConvenios={filteredConvenios}
            medicoSelected={!!formData.medicoId}
            selectedDoctor={selectedDoctor}
          />

          <Separator />

          {/* Seção 2: Dados do Agendamento */}
          <AppointmentDataFormMultiple
            formData={formData}
            setFormData={setFormData}
            doctors={doctors}
          />

          {/* Seção 3: Seleção de Múltiplos Exames */}
          {formData.medicoId && (
            <>
              <Separator />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ExamSelectionForm
                  availableExams={availableExams}
                  selectedExams={selectedExams}
                  onExamChange={handleExamChange}
                />

                <div className="space-y-4">
                  {/* Exames Selecionados */}
                  {selectedExams.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        Exames selecionados ({selectedExams.length}):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedExams.map((exam) => (
                          <Badge 
                            key={exam.id} 
                            variant="secondary" 
                            className="flex items-center gap-1"
                          >
                            {exam.nome}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleRemoveExam(exam.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview do Agendamento */}
                  <MultipleAppointmentPreview
                    selectedExams={selectedExams}
                    selectedDoctor={selectedDoctor}
                    patientName={formData.nomeCompleto}
                    appointmentDate={formData.dataAgendamento}
                    appointmentTime={formData.horaAgendamento}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          
          <Button 
            onClick={handleSubmit}
            disabled={!isFormValid || loading}
            className="min-w-[140px]"
          >
            {loading ? 'Agendando...' : `Agendar ${selectedExams.length} exames`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}