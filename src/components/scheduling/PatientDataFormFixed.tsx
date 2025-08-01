import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Search, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { SchedulingFormData } from '@/types/scheduling';
import { usePatientSearch } from '@/hooks/usePatientSearch';
import { useDebounce } from '@/hooks/useDebounce';

interface PatientDataFormFixedProps {
  formData: SchedulingFormData;
  setFormData: React.Dispatch<React.SetStateAction<SchedulingFormData>>;
  availableConvenios: string[];
  medicoSelected: boolean;
  selectedDoctor?: {
    nome: string;
    idade_minima?: number;
    idade_maxima?: number;
    convenios_aceitos?: string[];
  };
}

export function PatientDataFormFixed({ 
  formData, 
  setFormData, 
  availableConvenios, 
  medicoSelected,
  selectedDoctor
}: PatientDataFormFixedProps) {
  const [showPatientsList, setShowPatientsList] = useState(false);
  const { loading: searchingPatients, foundPatients, searchPatients, clearResults } = usePatientSearch();
  
  // Debounce da data de nascimento
  const debouncedBirthDate = useDebounce(formData.dataNascimento, 500);

  // Calcular idade do paciente
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const patientAge = calculateAge(formData.dataNascimento);

  // Validações de idade vs médico
  const getAgeValidation = () => {
    if (!selectedDoctor || !patientAge) return null;

    const { idade_minima, idade_maxima } = selectedDoctor;
    
    if (idade_minima && patientAge < idade_minima) {
      return {
        type: 'warning',
        message: `ATENÇÃO: Paciente com ${patientAge} anos está abaixo da idade mínima (${idade_minima} anos) para ${selectedDoctor.nome}`
      };
    }
    
    if (idade_maxima && patientAge > idade_maxima) {
      return {
        type: 'warning',
        message: `ATENÇÃO: Paciente com ${patientAge} anos está acima da idade máxima (${idade_maxima} anos) para ${selectedDoctor.nome}`
      };
    }

    if (idade_minima || idade_maxima) {
      return {
        type: 'success',
        message: `Idade compatível com ${selectedDoctor.nome} (${patientAge} anos)`
      };
    }

    return null;
  };

  const ageValidation = getAgeValidation();

  // Buscar pacientes quando a data de nascimento debounced muda
  useEffect(() => {
    if (debouncedBirthDate && debouncedBirthDate.length === 10) {
      searchPatients(debouncedBirthDate).then(patients => {
        setShowPatientsList(patients.length > 0);
      });
    } else {
      clearResults();
      setShowPatientsList(false);
    }
  }, [debouncedBirthDate, searchPatients, clearResults]);

  // Função para selecionar um paciente encontrado
  const selectPatient = (patient: any) => {
    setFormData(prev => ({
      ...prev,
      nomeCompleto: patient.nome_completo,
      telefone: patient.telefone || '',
      celular: patient.celular,
      convenio: patient.convenio,
    }));
    setShowPatientsList(false);
  };

  // Função para criar novo paciente (limpar seleção)
  const createNewPatient = () => {
    setFormData(prev => ({
      ...prev,
      nomeCompleto: '',
      telefone: '',
      celular: '',
      convenio: '',
    }));
    setShowPatientsList(false);
  };

  // Função para aplicar máscara de telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
  };

  const isValidPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.length === 10 || numbers.length === 11;
  };

  const handlePhoneChange = (value: string, field: 'telefone' | 'celular') => {
    const formatted = formatPhone(value);
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <User className="h-4 w-4" />
        Dados do Paciente
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nomeCompleto">Nome Completo *</Label>
          <Input
            id="nomeCompleto"
            value={formData.nomeCompleto}
            onChange={(e) => setFormData(prev => ({ ...prev, nomeCompleto: e.target.value }))}
            placeholder="Nome completo do paciente"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
          <div className="relative">
            <Input
              id="dataNascimento"
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData(prev => ({ ...prev, dataNascimento: e.target.value }))}
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
              {foundPatients.map((patient, index) => (
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
                    onClick={() => selectPatient(patient)}
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

      {/* Alerta de validação de idade */}
      {ageValidation && (
        <Alert variant={ageValidation.type === 'warning' ? 'default' : ageValidation.type === 'success' ? 'default' : 'destructive'}>
          {ageValidation.type === 'warning' ? (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          ) : ageValidation.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {ageValidation.message}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div>
          <Label htmlFor="convenio">Convênio *</Label>
          <Select 
            value={formData.convenio} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, convenio: value }))}
            disabled={!medicoSelected}
          >
            <SelectTrigger>
              <SelectValue placeholder={medicoSelected ? "Selecione o convênio" : "Primeiro selecione um médico"} />
            </SelectTrigger>
            <SelectContent>
              {availableConvenios.map((convenio) => (
                <SelectItem key={convenio} value={convenio}>
                  {convenio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            value={formData.telefone}
            onChange={(e) => handlePhoneChange(e.target.value, 'telefone')}
            placeholder="(xx) xxxx-xxxx"
            maxLength={15}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Opcional - Formato: (11) 1234-5678
          </p>
        </div>
        
        <div>
          <Label htmlFor="celular">Celular *</Label>
          <Input
            id="celular"
            value={formData.celular}
            onChange={(e) => handlePhoneChange(e.target.value, 'celular')}
            placeholder="(xx) xxxxx-xxxx"
            maxLength={15}
            required
            className={!isValidPhone(formData.celular) && formData.celular ? 'border-red-500' : ''}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Obrigatório - Formato: (11) 91234-5678
          </p>
          {!isValidPhone(formData.celular) && formData.celular && (
            <p className="text-xs text-red-500 mt-1">
              Número de celular inválido
            </p>
          )}
        </div>
      </div>
    </div>
  );
}