import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { DoctorOnboardingFormData, CONVENIOS_PADRAO } from '@/types/doctor-onboarding';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ConveniosSectionProps {
  formData: DoctorOnboardingFormData;
  errors: Record<string, string>;
  updateField: <K extends keyof DoctorOnboardingFormData>(
    field: K,
    value: DoctorOnboardingFormData[K]
  ) => void;
  toggleConvenio: (convenio: string) => void;
}

export function ConveniosSection({ formData, errors, updateField, toggleConvenio }: ConveniosSectionProps) {
  const handleRestrictionChange = (convenio: string, restriction: string) => {
    updateField('convenios_restricoes', {
      ...formData.convenios_restricoes,
      [convenio]: restriction,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Convênios Aceitos</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Selecione os convênios que este médico aceita. Se não selecionar nenhum, 
        o médico aceitará todos os convênios da clínica.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {CONVENIOS_PADRAO.map((convenio) => (
          <div
            key={convenio}
            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              formData.convenios_aceitos.includes(convenio)
                ? 'bg-primary/10 border-primary'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => toggleConvenio(convenio)}
          >
            <Checkbox
              checked={formData.convenios_aceitos.includes(convenio)}
              onCheckedChange={() => toggleConvenio(convenio)}
            />
            <span className="text-sm font-medium">{convenio}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="convenio_personalizado">Outros Convênios</Label>
        <Input
          id="convenio_personalizado"
          placeholder="Digite outros convênios separados por vírgula"
          value={formData.convenio_personalizado}
          onChange={(e) => updateField('convenio_personalizado', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Ex: IPASGO, IPSM, SES
        </p>
      </div>

      {formData.convenios_aceitos.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <h4 className="font-medium">Restrições por Convênio (opcional)</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Adicione restrições específicas para cada convênio selecionado
          </p>

          <div className="space-y-3">
            {formData.convenios_aceitos.map((convenio) => (
              <div key={convenio} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{convenio}</Badge>
                </div>
                <Textarea
                  placeholder={`Restrições para ${convenio}... (ex: apenas consultas, não cobre exames)`}
                  value={formData.convenios_restricoes[convenio] || ''}
                  onChange={(e) => handleRestrictionChange(convenio, e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
