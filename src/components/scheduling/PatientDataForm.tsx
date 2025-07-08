import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Search, UserCheck } from 'lucide-react';
import { SchedulingFormData } from '@/types/scheduling';

interface PatientDataFormProps {
  formData: SchedulingFormData;
  setFormData: React.Dispatch<React.SetStateAction<SchedulingFormData>>;
  availableConvenios: string[];
  medicoSelected: boolean;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
}

export function PatientDataForm({ 
  formData, 
  setFormData, 
  availableConvenios, 
  medicoSelected,
  searchPatientsByBirthDate
}: PatientDataFormProps) {
  const [foundPatients, setFoundPatients] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [showPatientsList, setShowPatientsList] = useState(false);

  // Buscar pacientes quando a data de nascimento for alterada
  useEffect(() => {
    const searchPatients = async () => {
      if (formData.dataNascimento && formData.dataNascimento.length === 10) {
        setSearchingPatients(true);
        try {
          const patients = await searchPatientsByBirthDate(formData.dataNascimento);
          setFoundPatients(patients);
          setShowPatientsList(patients.length > 0);
        } catch (error) {
          console.error('Erro ao buscar pacientes:', error);
        } finally {
          setSearchingPatients(false);
        }
      } else {
        setFoundPatients([]);
        setShowPatientsList(false);
      }
    };

    const timeoutId = setTimeout(searchPatients, 500); // Debounce de 500ms
    return () => clearTimeout(timeoutId);
  }, [formData.dataNascimento, searchPatientsByBirthDate]);

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
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Aplica máscara baseada no tamanho
    if (numbers.length <= 10) {
      // Telefone fixo: (xx) xxxx-xxxx
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    } else {
      // Celular: (xx) xxxxx-xxxx
      return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
  };

  // Função para validar se o número está completo
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