import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DoctorOnboardingFormData } from '@/types/doctor-onboarding';
import { User, Stethoscope } from 'lucide-react';

const ESPECIALIDADES = [
  'Gastroenterologia',
  'Endoscopia',
  'Colonoscopia',
  'Clínica Geral',
  'Cardiologia',
  'Dermatologia',
  'Ginecologia',
  'Ortopedia',
  'Pediatria',
  'Neurologia',
  'Urologia',
  'Pneumologia',
  'Endocrinologia',
  'Reumatologia',
  'Outra',
];

interface BasicInfoSectionProps {
  formData: DoctorOnboardingFormData;
  errors: Record<string, string>;
  updateField: <K extends keyof DoctorOnboardingFormData>(
    field: K,
    value: DoctorOnboardingFormData[K]
  ) => void;
}

export function BasicInfoSection({ formData, errors, updateField }: BasicInfoSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Dados Básicos do Médico</h3>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">
            Nome Completo <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nome"
            placeholder="Dr. João da Silva"
            value={formData.nome}
            onChange={(e) => updateField('nome', e.target.value)}
            className={errors.nome ? 'border-destructive' : ''}
          />
          {errors.nome && (
            <p className="text-sm text-destructive">{errors.nome}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="especialidade">
            Especialidade <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.especialidade}
            onValueChange={(value) => updateField('especialidade', value)}
          >
            <SelectTrigger className={errors.especialidade ? 'border-destructive' : ''}>
              <SelectValue placeholder="Selecione a especialidade" />
            </SelectTrigger>
            <SelectContent>
              {ESPECIALIDADES.map((esp) => (
                <SelectItem key={esp} value={esp}>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    {esp}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.especialidade === 'Outra' && (
            <Input
              placeholder="Digite a especialidade"
              className="mt-2"
              onChange={(e) => updateField('especialidade', e.target.value)}
            />
          )}
          {errors.especialidade && (
            <p className="text-sm text-destructive">{errors.especialidade}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t">
        <Switch
          id="ativo"
          checked={formData.ativo}
          onCheckedChange={(checked) => updateField('ativo', checked)}
        />
        <Label htmlFor="ativo" className="cursor-pointer">
          Médico ativo (aceita agendamentos)
        </Label>
      </div>
    </div>
  );
}
