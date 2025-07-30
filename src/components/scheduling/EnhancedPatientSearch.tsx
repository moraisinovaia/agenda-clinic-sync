import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Clock } from 'lucide-react';

interface Patient {
  nome_completo: string;
  data_nascimento: string;
  convenio: string;
  telefone?: string;
  celular?: string;
}

interface EnhancedPatientSearchProps {
  birthDate: string;
  onPatientSelect: (patient: Patient) => void;
  searchPatientsByBirthDate: (birthDate: string) => Promise<Patient[]>;
}

export function EnhancedPatientSearch({
  birthDate,
  onPatientSelect,
  searchPatientsByBirthDate
}: EnhancedPatientSearchProps) {
  const [foundPatients, setFoundPatients] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Função de busca manual (evita debounce automático)
  const searchPatients = useCallback(async () => {
    if (!birthDate || birthDate.length !== 10) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const patients = await searchPatientsByBirthDate(birthDate);
      setFoundPatients(patients || []);
      setShowSuggestions(patients && patients.length > 0);
    } catch (error) {
      console.error('Erro ao buscar pacientes:', error);
      setFoundPatients([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, [birthDate, searchPatientsByBirthDate]);

  const handlePatientSelect = useCallback((patient: Patient) => {
    onPatientSelect(patient);
    setShowSuggestions(false);
  }, [onPatientSelect]);

  return (
    <>
      {/* Botão para buscar pacientes */}
      {birthDate && birthDate.length === 10 && !hasSearched && (
        <div className="mt-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={searchPatients}
            disabled={isSearching}
          >
            <Search className="h-4 w-4 mr-2" />
            Buscar pacientes com esta data
          </Button>
        </div>
      )}

      {isSearching && (
        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4 animate-spin" />
          Buscando pacientes...
        </div>
      )}

      {showSuggestions && foundPatients.length > 0 && (
        <div className="border rounded-md bg-background shadow-sm mt-2">
          <div className="p-2 text-sm font-medium border-b bg-muted">
            Pacientes encontrados ({foundPatients.length}):
          </div>
          <div className="max-h-48 overflow-y-auto">
            {foundPatients.map((patient, index) => (
              <div
                key={`${patient.nome_completo}-${patient.convenio}-${index}`}
                className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                onClick={() => handlePatientSelect(patient)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{patient.nome_completo}</div>
                    <div className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2 text-xs">
                        {patient.convenio}
                      </Badge>
                      {patient.celular || patient.telefone || 'Sem telefone'}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0">
                    Selecionar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}