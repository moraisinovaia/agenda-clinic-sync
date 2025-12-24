import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DoctorOnboardingFormData } from '@/types/doctor-onboarding';
import { Calendar, Clock, Users, Globe } from 'lucide-react';

interface SchedulingTypeSectionProps {
  formData: DoctorOnboardingFormData;
  updateField: <K extends keyof DoctorOnboardingFormData>(
    field: K,
    value: DoctorOnboardingFormData[K]
  ) => void;
}

export function SchedulingTypeSection({ formData, updateField }: SchedulingTypeSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Tipo de Agendamento</h3>
      </div>

      <RadioGroup
        value={formData.tipo_agendamento}
        onValueChange={(value) => updateField('tipo_agendamento', value as 'ordem_chegada' | 'hora_marcada')}
        className="space-y-4"
      >
        <div
          className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
            formData.tipo_agendamento === 'ordem_chegada'
              ? 'bg-primary/10 border-primary'
              : 'hover:bg-muted/50'
          }`}
          onClick={() => updateField('tipo_agendamento', 'ordem_chegada')}
        >
          <RadioGroupItem value="ordem_chegada" id="ordem_chegada" />
          <div className="flex-1">
            <Label htmlFor="ordem_chegada" className="flex items-center gap-2 cursor-pointer font-medium">
              <Users className="h-4 w-4" />
              Ordem de Chegada
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Pacientes são atendidos por ordem de chegada no dia. 
              Ideal para clínicas com distribuição de fichas.
            </p>
            {formData.tipo_agendamento === 'ordem_chegada' && (
              <div className="mt-3 p-3 bg-muted/50 rounded text-sm">
                <strong>Como funciona:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                  <li>Pacientes recebem fichas numeradas</li>
                  <li>Limite de pacientes por período (manhã/tarde)</li>
                  <li>Horário de distribuição de fichas configurável</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div
          className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
            formData.tipo_agendamento === 'hora_marcada'
              ? 'bg-primary/10 border-primary'
              : 'hover:bg-muted/50'
          }`}
          onClick={() => updateField('tipo_agendamento', 'hora_marcada')}
        >
          <RadioGroupItem value="hora_marcada" id="hora_marcada" />
          <div className="flex-1">
            <Label htmlFor="hora_marcada" className="flex items-center gap-2 cursor-pointer font-medium">
              <Clock className="h-4 w-4" />
              Hora Marcada
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Pacientes são agendados em horários específicos. 
              Ideal para consultas e procedimentos com duração definida.
            </p>
            {formData.tipo_agendamento === 'hora_marcada' && (
              <div className="mt-3 p-3 bg-muted/50 rounded text-sm">
                <strong>Como funciona:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                  <li>Horários específicos para cada paciente</li>
                  <li>Intervalos configuráveis entre consultas</li>
                  <li>Visualização por horário no calendário</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </RadioGroup>

      <div className="flex items-center gap-3 pt-6 border-t">
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border flex-1 cursor-pointer transition-colors ${
            formData.permite_agendamento_online
              ? 'bg-success/10 border-success'
              : 'hover:bg-muted/50'
          }`}
          onClick={() => updateField('permite_agendamento_online', !formData.permite_agendamento_online)}
        >
          <Globe className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <Label className="cursor-pointer font-medium">
              Permitir Agendamento Online
            </Label>
            <p className="text-xs text-muted-foreground">
              Pacientes podem agendar via WhatsApp/chatbot
            </p>
          </div>
          <Switch
            checked={formData.permite_agendamento_online}
            onCheckedChange={(checked) => updateField('permite_agendamento_online', checked)}
          />
        </div>
      </div>
    </div>
  );
}
