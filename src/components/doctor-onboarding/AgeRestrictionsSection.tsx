import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DoctorOnboardingFormData } from '@/types/doctor-onboarding';
import { Baby, User } from 'lucide-react';

interface AgeRestrictionsSectionProps {
  formData: DoctorOnboardingFormData;
  errors: Record<string, string>;
  updateField: <K extends keyof DoctorOnboardingFormData>(
    field: K,
    value: DoctorOnboardingFormData[K]
  ) => void;
}

export function AgeRestrictionsSection({ formData, errors, updateField }: AgeRestrictionsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Baby className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Restrições de Idade</h3>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="idade_minima">Idade Mínima (anos)</Label>
          <Input
            id="idade_minima"
            type="number"
            min={0}
            max={120}
            placeholder="0"
            value={formData.idade_minima ?? ''}
            onChange={(e) => updateField('idade_minima', e.target.value ? parseInt(e.target.value) : null)}
            className={errors.idade_minima ? 'border-destructive' : ''}
          />
          {errors.idade_minima && (
            <p className="text-sm text-destructive">{errors.idade_minima}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Deixe em branco ou 0 para não haver restrição mínima
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="idade_maxima">Idade Máxima (anos)</Label>
          <Input
            id="idade_maxima"
            type="number"
            min={0}
            max={120}
            placeholder="Sem limite"
            value={formData.idade_maxima ?? ''}
            onChange={(e) => updateField('idade_maxima', e.target.value ? parseInt(e.target.value) : null)}
          />
          <p className="text-xs text-muted-foreground">
            Deixe em branco para não haver restrição máxima
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
          <Baby className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <Label htmlFor="atende_criancas" className="cursor-pointer font-medium">
              Atende crianças (0-12 anos)
            </Label>
            <p className="text-xs text-muted-foreground">
              Pacientes até 12 anos de idade
            </p>
          </div>
          <Switch
            id="atende_criancas"
            checked={formData.atende_criancas}
            onCheckedChange={(checked) => updateField('atende_criancas', checked)}
          />
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
          <User className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <Label htmlFor="atende_adultos" className="cursor-pointer font-medium">
              Atende adultos (13+ anos)
            </Label>
            <p className="text-xs text-muted-foreground">
              Pacientes a partir de 13 anos
            </p>
          </div>
          <Switch
            id="atende_adultos"
            checked={formData.atende_adultos}
            onCheckedChange={(checked) => updateField('atende_adultos', checked)}
          />
        </div>
      </div>
    </div>
  );
}
