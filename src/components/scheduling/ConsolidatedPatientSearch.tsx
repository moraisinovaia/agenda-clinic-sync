import React, { useState, useCallback } from 'react';
import { ConsolidatedPatient, PatientConvenio } from '@/types/consolidated-patient';
import { useUnifiedPatientSearch } from '@/hooks/useUnifiedPatientSearch';
import { ConvenioSelector } from './ConvenioSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, User } from 'lucide-react';

interface ConsolidatedPatientSearchProps {
  onPatientWithConvenioSelect: (patient: ConsolidatedPatient, convenio: PatientConvenio) => void;
  initialBirthDate?: string;
  initialName?: string;
}

export function ConsolidatedPatientSearch({ 
  onPatientWithConvenioSelect, 
  initialBirthDate = '',
  initialName = ''
}: ConsolidatedPatientSearchProps) {
  const [searchType, setSearchType] = useState<'birthDate' | 'name'>('birthDate');
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [name, setName] = useState(initialName);
  const [selectedPatient, setSelectedPatient] = useState<ConsolidatedPatient | null>(null);
  
  const {
    loading,
    foundPatients,
    showResults,
    searchByBirthDate,
    searchByName,
    clearSearch,
  } = useUnifiedPatientSearch();

  // Buscar por data de nascimento
  const handleBirthDateChange = useCallback((value: string) => {
    setBirthDate(value);
    setName(''); // Limpar busca por nome
    if (value.length === 10) {
      searchByBirthDate(value);
    } else {
      clearSearch();
    }
  }, [searchByBirthDate, clearSearch]);

  // Buscar por nome
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setBirthDate(''); // Limpar busca por data
    if (value.trim().length >= 3) {
      searchByName(value);
    } else {
      clearSearch();
    }
  }, [searchByName, clearSearch]);

  // Selecionar paciente para escolher convênio
  const handlePatientSelect = useCallback((patient: ConsolidatedPatient) => {
    if (patient.convenios.length === 1) {
      // Se há apenas um convênio, selecionar automaticamente
      onPatientWithConvenioSelect(patient, patient.convenios[0]);
    } else {
      // Se há múltiplos convênios, mostrar seletor
      setSelectedPatient(patient);
    }
  }, [onPatientWithConvenioSelect]);

  // Confirmar seleção do convênio
  const handleConvenioSelect = useCallback((patient: ConsolidatedPatient, convenio: PatientConvenio) => {
    onPatientWithConvenioSelect(patient, convenio);
    setSelectedPatient(null);
  }, [onPatientWithConvenioSelect]);

  // Voltar à busca
  const handleBack = useCallback(() => {
    setSelectedPatient(null);
  }, []);

  // Se um paciente foi selecionado e tem múltiplos convênios, mostrar o seletor
  if (selectedPatient) {
    return (
      <ConvenioSelector
        patient={selectedPatient}
        onConvenioSelect={handleConvenioSelect}
        onBack={handleBack}
      />
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Buscar Paciente
        </CardTitle>
        <CardDescription>
          Busque por data de nascimento ou nome para encontrar pacientes existentes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alternar tipo de busca */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={searchType === 'birthDate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSearchType('birthDate');
              setName('');
              clearSearch();
            }}
          >
            Buscar por Data de Nascimento
          </Button>
          <Button
            type="button"
            variant={searchType === 'name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSearchType('name');
              setBirthDate('');
              clearSearch();
            }}
          >
            Buscar por Nome
          </Button>
        </div>

        {/* Campo de busca */}
        {searchType === 'birthDate' ? (
          <div className="space-y-2">
            <Label htmlFor="birthDate">Data de Nascimento</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => handleBirthDateChange(e.target.value)}
              placeholder="DD/MM/AAAA"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="patientName">Nome do Paciente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="patientName"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Digite pelo menos 3 caracteres..."
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Indicador de loading */}
        {loading && (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground bg-muted/50 rounded-md">
            <Search className="h-4 w-4 animate-spin" />
            Buscando pacientes...
          </div>
        )}

        {/* Resultados da busca */}
        {showResults && foundPatients.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {foundPatients.length === 1 
                ? '1 paciente encontrado' 
                : `${foundPatients.length} pacientes encontrados`
              }
            </h4>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {foundPatients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handlePatientSelect(patient)}
                  className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{patient.nome_completo}</div>
                    <div className="text-sm text-muted-foreground">
                      Data: {patient.data_nascimento}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Convênios: {patient.convenios.map(c => c.convenio).join(', ')}
                      {patient.convenios.length > 1 && (
                        <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                          {patient.convenios.length} opções
                        </span>
                      )}
                    </div>
                    {patient.celular && (
                      <div className="text-sm text-muted-foreground">
                        Celular: {patient.celular}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagem quando nenhum resultado */}
        {showResults && foundPatients.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground bg-muted/50 rounded-md text-center">
            Nenhum paciente encontrado com os critérios informados
          </div>
        )}
      </CardContent>
    </Card>
  );
}