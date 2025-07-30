import { useState, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, AlertTriangle, Clock } from 'lucide-react';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { useMultipleScheduling } from '@/hooks/useMultipleScheduling';

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
  const [lastAppointmentWarning, setLastAppointmentWarning] = useState<string>('');
  
  const { checkLastAppointment } = useMultipleScheduling();

  // Função de busca isolada e estabilizada
  const performSearch = useCallback(async (searchDate: string) => {
    if (!searchDate || searchDate.length !== 10) {
      setFoundPatients([]);
      setShowSuggestions(false);
      setLastAppointmentWarning('');
      return;
    }

    setIsSearching(true);
    try {
      const patients = await searchPatientsByBirthDate(searchDate);
      setFoundPatients(patients || []);
      setShowSuggestions(patients && patients.length > 0);
      
      // Verificar último agendamento para cada paciente
      if (patients && patients.length > 0) {
        for (const patient of patients) {
          const hasOldAppointment = await checkLastAppointment(patient.nome_completo, patient.data_nascimento);
          if (hasOldAppointment) {
            setLastAppointmentWarning(`⚠️ ${patient.nome_completo} - último agendamento há mais de 30 dias`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar pacientes:', error);
      setFoundPatients([]);
      setShowSuggestions(false);
      setLastAppointmentWarning('');
    } finally {
      setIsSearching(false);
    }
  }, [searchPatientsByBirthDate, checkLastAppointment]);

  // Debounce para evitar chamadas excessivas
  const debouncedSearch = useDebouncedCallback(performSearch, 600);

  // Realizar busca quando birthDate muda
  useEffect(() => {
    debouncedSearch(birthDate);
  }, [birthDate, debouncedSearch]);

  const handlePatientSelect = useCallback((patient: Patient) => {
    onPatientSelect(patient);
    setShowSuggestions(false);
  }, [onPatientSelect]);

  return (
    <>
      {/* Alerta de último agendamento */}
      {lastAppointmentWarning && (
        <Alert className="mt-2">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            {lastAppointmentWarning}
          </AlertDescription>
        </Alert>
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