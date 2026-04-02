
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PatientDataFormStable } from './PatientDataFormStable';
import { AppointmentDataForm } from './AppointmentDataForm';
import { Doctor, SchedulingFormData, Atendimento, AppointmentWithRelations } from '@/types/scheduling';
import { useSchedulingForm } from '@/hooks/useSchedulingForm';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useDebounce } from '@/hooks/useDebounce';
import { SchedulingErrorBoundary } from '@/components/error/SchedulingErrorBoundary';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface SchedulingFormStableProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  appointments: AppointmentWithRelations[];
  blockedDates: string[];
  isDateBlocked: (doctorId: string, date: Date) => boolean;
  onSubmit: (data: SchedulingFormData) => Promise<void>;
  onCancel: () => void;
  getAtendimentosByDoctor: (doctorId: string) => Atendimento[];
  editingAppointment?: AppointmentWithRelations;
}

export function SchedulingFormStable({
  doctors,
  atendimentos,
  appointments,
  blockedDates,
  isDateBlocked,
  onSubmit,
  onCancel,
  getAtendimentosByDoctor,
  editingAppointment
}: SchedulingFormStableProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preparar dados iniciais se estiver editando
  const initialData = editingAppointment ? {
    nomeCompleto: editingAppointment.pacientes?.nome_completo || '',
    dataNascimento: editingAppointment.pacientes?.data_nascimento || '',
    convenio: editingAppointment.pacientes?.convenio || '',
    telefone: editingAppointment.pacientes?.telefone || '',
    celular: editingAppointment.pacientes?.celular || '',
    medicoId: editingAppointment.medico_id || '',
    atendimentoId: editingAppointment.atendimento_id || '',
    dataAgendamento: editingAppointment.data_agendamento || '',
    horaAgendamento: editingAppointment.hora_agendamento || '',
    observacoes: editingAppointment.observacoes || '',
  } : undefined;

  const {
    formData,
    setFormData,
    loading,
    error,
    resetForm,
    handleSubmit,
  } = useSchedulingForm({ initialData });
  
  const { validateForm } = useFormValidation();

  // Debounce para prevenir múltiplas submissões
  const debouncedIsSubmitting = useDebounce(isSubmitting, 300);

  // Determinar step apropriado quando há erro
  useEffect(() => {
    if (error) {
      // Se o erro é sobre horário ocupado ou agenda bloqueada, ir para step 2
      if (error.includes('horário já está ocupado') || error.includes('agenda está bloqueada')) {
        setStep(2); // Ir para dados do agendamento para correção
      } else {
        setStep(1); // Outros erros, voltar para dados do paciente
      }
    }
  }, [error]);

  // Normalizar array de convênios - separar itens com vírgula em itens individuais
  const normalizeConvenios = (convenios: string[]): string[] => {
    const normalized: string[] = [];
    for (const item of convenios) {
      if (item.includes(',')) {
        const parts = item.split(',').map(s => s.trim()).filter(Boolean);
        normalized.push(...parts);
      } else {
        normalized.push(item.trim());
      }
    }
    return [...new Set(normalized)].filter(Boolean);
  };

  // Calcular convênios disponíveis baseado no médico selecionado
  const getAvailableConvenios = () => {
    if (!formData.medicoId) return [];
    
    const selectedDoctor = doctors.find(d => d.id === formData.medicoId);
    if (!selectedDoctor) return [];
    
    // Se o médico tem lista de convênios aceitos, usar essa lista
    if (selectedDoctor.convenios_aceitos && selectedDoctor.convenios_aceitos.length > 0) {
      return normalizeConvenios(selectedDoctor.convenios_aceitos);
    }
    
    // Se não tem restrição, retornar lista padrão de convênios
    return ['Particular', 'Unimed', 'Bradesco Saúde', 'SulAmérica', 'Amil', 'Golden Cross'];
  };

  // Verificar se médico foi selecionado
  const medicoSelected = !!formData.medicoId;

  // Buscar dados do médico selecionado
  const selectedDoctor = doctors.find(d => d.id === formData.medicoId);

  // ✅ VALIDAÇÃO ROBUSTA: Função para validar se o passo atual está válido
  const isStepValid = (step: number): boolean => {
    if (step === 1) {
      // Validar dados do paciente
      const hasRequiredFields = !!(
        formData.nomeCompleto?.trim() && 
        formData.dataNascimento && 
        formData.convenio?.trim() && 
        formData.celular?.trim()
      );
      return hasRequiredFields;
    } else if (step === 2) {
      // Validar dados do agendamento COM VERIFICAÇÃO EXPLÍCITA DO ATENDIMENTO
      const hasRequiredFields = !!(
        formData.medicoId && 
        formData.atendimentoId && // ← CRÍTICO: atendimento é obrigatório
        formData.dataAgendamento && 
        formData.horaAgendamento
      );
      
      // Log para debug
      console.log('🔍 Validação Step 2:', {
        medicoId: !!formData.medicoId,
        atendimentoId: !!formData.atendimentoId,
        dataAgendamento: !!formData.dataAgendamento,
        horaAgendamento: !!formData.horaAgendamento,
        isValid: hasRequiredFields
      });
      
      return hasRequiredFields;
    }
    return false;
  };

  const handleNext = () => {
    if (isStepValid(1)) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  // ✅ CORREÇÃO: Submissão do formulário com validação robusta
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 SchedulingFormStable: Tentativa de submissão', formData);
    
    // ✅ VALIDAÇÃO PRÉ-SUBMISSÃO: Verificar todos os campos obrigatórios
    const validation = validateForm(formData);
    if (!validation.isValid) {
      console.log('❌ Validação falhou:', validation.errors);
      
      // Se atendimento não está selecionado, mostrar erro específico
      if (!formData.atendimentoId) {
        console.log('🚨 ERRO ESPECÍFICO: Tipo de atendimento não selecionado');
        return; // Bloquear submissão
      }
      
      return; // Bloquear submissão para qualquer erro
    }
    
    if (isSubmitting || debouncedIsSubmitting) {
      console.log('🛑 SchedulingFormStable: Submissão em andamento, ignorando...');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await handleSubmit(e, onSubmit);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SchedulingErrorBoundary onRetry={() => window.location.reload()}>
      <div className="w-full max-w-4xl mx-auto">
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCancel}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {/* Indicador de passos */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  1
                </div>
                <span className="text-sm font-medium">Dados do Paciente</span>
              </div>
              
              <div className={`w-8 h-1 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              
              <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  2
                </div>
                <span className="text-sm font-medium">Dados do Agendamento</span>
              </div>
            </div>
          </div>

          {/* Exibir erro se houver */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Erro ao criar agendamento</span>
              </div>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="bg-background hover:bg-muted"
                >
                  Corrigir horário
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="bg-background hover:bg-muted"
                >
                  Corrigir dados do paciente
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {step === 1 && (
              <PatientDataFormStable
                formData={formData}
                setFormData={setFormData}
                availableConvenios={getAvailableConvenios()}
                medicoSelected={medicoSelected}
                selectedDoctor={selectedDoctor}
              />
            )}

            {step === 2 && (
              <AppointmentDataForm
                formData={formData}
                setFormData={setFormData}
                doctors={doctors}
                atendimentos={atendimentos}
              />
            )}

            <div className="flex gap-2 pt-4">
              {step === 1 ? (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleNext}
                    disabled={!isStepValid(1) || loading}
                    className="flex-1"
                  >
                    Próximo
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleBack}
                    disabled={loading}
                  >
                    Voltar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!isStepValid(2) || loading || isSubmitting || debouncedIsSubmitting}
                    className="flex-1"
                  >
                    {(loading || isSubmitting || debouncedIsSubmitting) ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {editingAppointment ? 'Atualizando...' : 'Criando...'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {editingAppointment ? 'Atualizar Agendamento' : 'Criar Agendamento'}
                      </div>
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
        </Card>
      </div>
    </SchedulingErrorBoundary>
  );
}
