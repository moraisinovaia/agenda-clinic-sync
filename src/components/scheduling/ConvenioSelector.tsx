import React from 'react';
import { ConsolidatedPatient, PatientConvenio } from '@/types/consolidated-patient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ConvenioSelectorProps {
  patient: ConsolidatedPatient;
  onConvenioSelect: (patient: ConsolidatedPatient, convenio: PatientConvenio) => void;
  onBack: () => void;
}

// Componente deprecado - não é mais necessário pois mostramos apenas o último convênio usado
export function ConvenioSelector({ patient, onConvenioSelect, onBack }: ConvenioSelectorProps) {
  const convenio: PatientConvenio = {
    id: patient.id,
    convenio: patient.ultimo_convenio || '',
    created_at: patient.created_at,
    updated_at: patient.updated_at,
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Convênio do Paciente</CardTitle>
        <CardDescription>
          Paciente: <strong>{patient.nome_completo}</strong> ({patient.data_nascimento})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Último convênio utilizado pelo paciente:
          </p>
          
          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => onConvenioSelect(patient, convenio)}
              className="justify-start h-auto p-4 text-left"
            >
              <div>
                <div className="font-medium">{patient.ultimo_convenio || 'Convênio não informado'}</div>
                <div className="text-xs text-muted-foreground">
                  Atualizado em: {new Date(patient.updated_at).toLocaleDateString()}
                </div>
              </div>
            </Button>
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