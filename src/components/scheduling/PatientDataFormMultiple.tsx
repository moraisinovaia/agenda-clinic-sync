import { useCallback, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Search, UserCheck } from 'lucide-react';
import { Doctor } from '@/types/scheduling';
import { MultipleSchedulingFormData } from '@/types/multiple-scheduling';
import { useDebounce } from '@/hooks/useDebounce';

interface PatientDataFormMultipleProps {
  formData: MultipleSchedulingFormData;
  setFormData: (data: MultipleSchedulingFormData | ((prev: MultipleSchedulingFormData) => MultipleSchedulingFormData)) => void;
  availableConvenios: string[];
  medicoSelected: boolean;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
  selectedDoctor?: Doctor;
}

export function PatientDataFormMultiple({
  formData,
  setFormData,
  availableConvenios,
  medicoSelected,
  searchPatientsByBirthDate,
  selectedDoctor
}: PatientDataFormMultipleProps) {
  
  // Estado para busca de pacientes
  const [foundPatients, setFoundPatients] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [showPatientsList, setShowPatientsList] = useState(false);
  
  // Debounce da data de nascimento para evitar muitas requisições
  const debouncedBirthDate = useDebounce(formData.dataNascimento, 800);

  // Busca automática de pacientes
  useEffect(() => {
    const searchPatients = async () => {
      if (debouncedBirthDate && debouncedBirthDate.length === 10) {
        setSearchingPatients(true);
        try {
          const patients = await searchPatientsByBirthDate(debouncedBirthDate);
          setFoundPatients(patients);
          setShowPatientsList(patients.length > 0);
          console.log('📋 Pacientes encontrados:', patients);
        } catch (error) {
          console.error('❌ Erro ao buscar pacientes:', error);
          setFoundPatients([]);
          setShowPatientsList(false);
        } finally {
          setSearchingPatients(false);
        }
      } else {
        setFoundPatients([]);
        setShowPatientsList(false);
      }
    };

    searchPatients();
  }, [debouncedBirthDate, searchPatientsByBirthDate]);
  
  // Função estabilizada para seleção de paciente
  const handlePatientSelect = useCallback((patient: any) => {
    console.log('👤 Selecionando paciente:', patient);
    setFormData(prev => ({
      ...prev,
      nomeCompleto: patient.nome_completo,
      dataNascimento: patient.data_nascimento,
      convenio: patient.convenio,
      telefone: patient.telefone || '',
      celular: patient.celular || ''
    }));
    setShowPatientsList(false);
  }, [setFormData]);

  // Função para criar novo paciente
  const createNewPatient = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      nomeCompleto: '',
      telefone: '',
      celular: '',
      convenio: ''
    }));
    setShowPatientsList(false);
  }, [setFormData]);

  // Verificação de compatibilidade do convênio
  const isConvenioCompatible = useCallback((convenio: string) => {
    if (!selectedDoctor || !selectedDoctor.convenios_aceitos) return true;
    return selectedDoctor.convenios_aceitos.includes(convenio);
  }, [selectedDoctor]);

  // Função estabilizada para onChange dos campos
  const updateField = useCallback((field: keyof MultipleSchedulingFormData) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log(`📝 Atualizando campo ${field}:`, e.target.value);
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };
  }, [setFormData]);

  // Função para seleção de convênio via badge
  const selectConvenio = useCallback((convenio: string) => {
    setFormData(prev => ({ ...prev, convenio }));
  }, [setFormData]);

  return (
    <div className="space-y-4">
      {/* Nome Completo */}
      <div className="space-y-2">
        <Label htmlFor="nomeCompleto">Nome Completo *</Label>
        <Input
          id="nomeCompleto"
          type="text"
          value={formData.nomeCompleto}
          onChange={updateField('nomeCompleto')}
          placeholder="Digite o nome completo do paciente"
          required
        />
      </div>

      {/* Data de Nascimento */}
      <div className="space-y-2">
        <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
        <div className="relative">
          <Input
            id="dataNascimento"
            type="date"
            value={formData.dataNascimento}
            onChange={updateField('dataNascimento')}
            required
          />
          {searchingPatients && (
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {searchingPatients ? 'Buscando pacientes...' : 'Ao inserir a data, buscaremos pacientes existentes'}
        </p>
      </div>

      {/* Lista de pacientes encontrados */}
      {showPatientsList && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="h-4 w-4 text-green-600" />
              <h4 className="font-medium text-green-700">
                {foundPatients.length === 1 
                  ? 'Paciente encontrado!' 
                  : `${foundPatients.length} pacientes encontrados`
                }
              </h4>
            </div>
            <div className="space-y-2">
              {foundPatients.map((patient) => (
                <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{patient.nome_completo}</p>
                    <p className="text-sm text-muted-foreground">
                      {patient.convenio} • {patient.celular}
                      {patient.telefone && ` • ${patient.telefone}`}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handlePatientSelect(patient)}
                    className="ml-2"
                  >
                    Selecionar
                  </Button>
                </div>
              ))}
              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={createNewPatient}
                  className="w-full"
                >
                  Criar novo paciente com esta data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Convênio */}
      <div className="space-y-2">
        <Label htmlFor="convenio">Convênio *</Label>
        <Input
          id="convenio"
          type="text"
          value={formData.convenio}
          onChange={updateField('convenio')}
          placeholder="Digite o nome do convênio"
          required
        />
        
        {/* Verificação de compatibilidade do convênio */}
        {medicoSelected && formData.convenio && !isConvenioCompatible(formData.convenio) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Atenção: O convênio "{formData.convenio}" pode não ser aceito por este médico.
              {availableConvenios.length > 0 && (
                <>
                  <br />Convênios aceitos: {availableConvenios.join(', ')}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Mostrar convênios aceitos como sugestões */}
        {medicoSelected && availableConvenios.length > 0 && !formData.convenio && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Convênios aceitos por este médico:</div>
            <div className="flex flex-wrap gap-1">
              {availableConvenios.map((convenio) => (
                <Badge 
                  key={convenio}
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => selectConvenio(convenio)}
                >
                  {convenio}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Telefones */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            type="tel"
            value={formData.telefone}
            onChange={updateField('telefone')}
            placeholder="(00) 0000-0000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="celular">Celular</Label>
          <Input
            id="celular"
            type="tel"
            value={formData.celular}
            onChange={updateField('celular')}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>
    </div>
  );
}