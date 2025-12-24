import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DoctorOnboardingFormData } from '@/types/doctor-onboarding';
import { FileText, AlertTriangle, Ban } from 'lucide-react';

interface ObservationsSectionProps {
  formData: DoctorOnboardingFormData;
  updateField: <K extends keyof DoctorOnboardingFormData>(
    field: K,
    value: DoctorOnboardingFormData[K]
  ) => void;
}

export function ObservationsSection({ formData, updateField }: ObservationsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Observações Gerais</h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="observacoes_gerais" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Observações Gerais
          </Label>
          <Textarea
            id="observacoes_gerais"
            placeholder="Informações gerais sobre o médico, formação, experiência, etc."
            value={formData.observacoes_gerais}
            onChange={(e) => updateField('observacoes_gerais', e.target.value)}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            Essas informações podem ser usadas pelo chatbot para responder perguntas sobre o médico.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regras_especiais" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Regras Especiais de Agendamento
          </Label>
          <Textarea
            id="regras_especiais"
            placeholder="Ex: Não agendar dois procedimentos no mesmo dia. Colonoscopia requer preparo com 3 dias de antecedência."
            value={formData.regras_especiais}
            onChange={(e) => updateField('regras_especiais', e.target.value)}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            Regras que devem ser consideradas ao fazer agendamentos para este médico.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="restricoes_gerais" className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-destructive" />
            Restrições
          </Label>
          <Textarea
            id="restricoes_gerais"
            placeholder="Ex: Não atende gestantes para colonoscopia. Não realiza procedimentos em diabéticos descompensados."
            value={formData.restricoes_gerais}
            onChange={(e) => updateField('restricoes_gerais', e.target.value)}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            Casos em que o médico não pode atender ou realizar determinados procedimentos.
          </p>
        </div>
      </div>
    </div>
  );
}
