import React from 'react';
import { ConsolidatedPatient, PatientConvenio } from '@/types/consolidated-patient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ConvenioSelectorProps {
  patient: ConsolidatedPatient;
  onConvenioSelect: (patient: ConsolidatedPatient, convenio: PatientConvenio) => void;
  onBack: () => void;
}

export function ConvenioSelector({ patient, onConvenioSelect, onBack }: ConvenioSelectorProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Selecionar Convênio</CardTitle>
        <CardDescription>
          Paciente: <strong>{patient.nome_completo}</strong> ({patient.data_nascimento})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Este paciente possui múltiplos convênios. Selecione o convênio desejado para o agendamento:
          </p>
          
          <div className="grid gap-2">
            {patient.convenios.map((convenio, index) => (
              <Button
                key={convenio.id}
                variant="outline"
                onClick={() => onConvenioSelect(patient, convenio)}
                className="justify-start h-auto p-4 text-left"
              >
                <div>
                  <div className="font-medium">{convenio.convenio}</div>
                  <div className="text-xs text-muted-foreground">
                    Atualizado em: {new Date(convenio.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </Button>
            ))}
          </div>
          
          <div className="pt-4 border-t">
            <Button variant="ghost" onClick={onBack}>
              ← Voltar à busca
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}