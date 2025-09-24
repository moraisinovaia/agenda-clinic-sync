import React, { useState } from 'react';
import { ConsolidatedPatientSearch } from './ConsolidatedPatientSearch';
import { ConsolidatedPatient, PatientConvenio, consolidatedToPatient } from '@/types/consolidated-patient';
import { Patient } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PatientSearchExampleProps {
  onPatientSelected?: (patient: Patient) => void;
}

export function PatientSearchExample({ onPatientSelected }: PatientSearchExampleProps) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const handlePatientWithConvenioSelect = (
    consolidatedPatient: ConsolidatedPatient, 
    convenio: PatientConvenio
  ) => {
    // Converter de volta para Patient tradicional
    const patient = consolidatedToPatient(consolidatedPatient, convenio);
    setSelectedPatient(patient);
    onPatientSelected?.(patient);
  };

  const clearSelection = () => {
    setSelectedPatient(null);
  };

  return (
    <div className="space-y-6">
      <ConsolidatedPatientSearch
        onPatientWithConvenioSelect={handlePatientWithConvenioSelect}
      />
      
      {selectedPatient && (
        <Card>
          <CardHeader>
            <CardTitle>Paciente Selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Nome:</strong> {selectedPatient.nome_completo}</p>
              <p><strong>Data de Nascimento:</strong> {selectedPatient.data_nascimento}</p>
              <p><strong>Convênio:</strong> {selectedPatient.convenio}</p>
              <p><strong>Celular:</strong> {selectedPatient.celular || 'Não informado'}</p>
              <p><strong>Telefone:</strong> {selectedPatient.telefone || 'Não informado'}</p>
            </div>
            <div className="mt-4">
              <Button onClick={clearSelection} variant="outline">
                Limpar Seleção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}