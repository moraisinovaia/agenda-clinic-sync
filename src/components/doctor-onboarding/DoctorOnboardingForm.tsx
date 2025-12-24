import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDoctorOnboardingForm } from '@/hooks/useDoctorOnboardingForm';
import {
  BasicInfoSection,
  AgeRestrictionsSection,
  ConveniosSection,
  SchedulingTypeSection,
  ServicesSection,
  ObservationsSection,
  PreparosSection,
} from '@/components/doctor-onboarding';
import { ChevronLeft, ChevronRight, Save, Loader2, Stethoscope, CheckCircle } from 'lucide-react';

interface DoctorOnboardingFormProps {
  clienteId: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const STEPS = [
  { title: 'Dados Básicos', description: 'Nome e especialidade' },
  { title: 'Idade', description: 'Restrições de idade' },
  { title: 'Convênios', description: 'Convênios aceitos' },
  { title: 'Agendamento', description: 'Tipo de agendamento' },
  { title: 'Serviços', description: 'Serviços realizados' },
  { title: 'Observações', description: 'Regras e restrições' },
  { title: 'Preparos', description: 'Preparos de exames' },
];

export function DoctorOnboardingForm({ clienteId, onSuccess, onCancel }: DoctorOnboardingFormProps) {
  const {
    formData,
    currentStep,
    totalSteps,
    isSubmitting,
    errors,
    updateField,
    addServico,
    updateServico,
    removeServico,
    addPreparo,
    updatePreparo,
    removePreparo,
    toggleConvenio,
    nextStep,
    prevStep,
    goToStep,
    submitForm,
  } = useDoctorOnboardingForm({ clienteId, onSuccess });

  const progress = ((currentStep + 1) / totalSteps) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicInfoSection formData={formData} errors={errors} updateField={updateField} />;
      case 1:
        return <AgeRestrictionsSection formData={formData} errors={errors} updateField={updateField} />;
      case 2:
        return <ConveniosSection formData={formData} errors={errors} updateField={updateField} toggleConvenio={toggleConvenio} />;
      case 3:
        return <SchedulingTypeSection formData={formData} updateField={updateField} />;
      case 4:
        return <ServicesSection formData={formData} errors={errors} addServico={addServico} updateServico={updateServico} removeServico={removeServico} />;
      case 5:
        return <ObservationsSection formData={formData} updateField={updateField} />;
      case 6:
        return <PreparosSection formData={formData} errors={errors} addPreparo={addPreparo} updatePreparo={updatePreparo} removePreparo={removePreparo} />;
      default:
        return null;
    }
  };

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Cadastro Completo de Médico</CardTitle>
            <CardDescription>Preencha todas as informações do médico</CardDescription>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{STEPS[currentStep].title}</span>
            <span className="text-muted-foreground">Etapa {currentStep + 1} de {totalSteps}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-2">
          {STEPS.map((step, index) => (
            <button
              key={index}
              onClick={() => index < currentStep && goToStep(index)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                index === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : index < currentStep
                  ? 'bg-success/20 text-success hover:bg-success/30 cursor-pointer'
                  : 'bg-muted text-muted-foreground'
              }`}
              disabled={index > currentStep}
            >
              {index < currentStep && <CheckCircle className="h-3 w-3" />}
              {step.title}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderStep()}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <div>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={prevStep} disabled={isSubmitting}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            
            {isLastStep ? (
              <Button onClick={submitForm} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Médico
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={nextStep}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
