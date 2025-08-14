import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateOfBirthInput } from '@/components/ui/date-of-birth-input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { User, Search, UserCheck, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { SchedulingFormData } from '@/types/scheduling';
import { useUnifiedPatientSearch } from '@/hooks/useUnifiedPatientSearch';

interface PatientDataFormProps {
  formData: SchedulingFormData;
  setFormData: React.Dispatch<React.SetStateAction<SchedulingFormData>>;
  availableConvenios: string[];
  medicoSelected: boolean;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
  selectedDoctor?: {
    nome: string;
    idade_minima?: number;
    idade_maxima?: number;
    convenios_aceitos?: string[];
  };
}

export function PatientDataForm({ 
  formData, 
  setFormData, 
  availableConvenios, 
  medicoSelected,
  searchPatientsByBirthDate,
  selectedDoctor
}: PatientDataFormProps) {
  // Hook unificado para busca por nome e data
  const {
    loading,
    foundPatients,
    showResults,
    selectedPatient,
    searchByBirthDate,
    searchByName,
    selectPatient: selectPatientFromHook,
    clearSearch,
    hideResults
  } = useUnifiedPatientSearch();

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

  // Buscar pacientes por data de nascimento
  useEffect(() => {
    if (formData.dataNascimento && formData.dataNascimento.length === 10) {
      searchByBirthDate(formData.dataNascimento);
    }
  }, [formData.dataNascimento, searchByBirthDate]);

  // Buscar pacientes por nome (3+ caracteres)
  useEffect(() => {
    if (formData.nomeCompleto && formData.nomeCompleto.trim().length >= 3) {
      // Se também tem data preenchida, priorizar busca por data
      if (!formData.dataNascimento || formData.dataNascimento.length < 10) {
        searchByName(formData.nomeCompleto.trim());
      }
    }
  }, [formData.nomeCompleto, formData.dataNascimento, searchByName]);

  // Função para selecionar um paciente encontrado
  const selectPatient = (patient: any) => {
    setFormData(prev => ({
      ...prev,
      nomeCompleto: patient.nome_completo,
      telefone: patient.telefone || '',
      celular: patient.celular,
      convenio: patient.convenio,
    }));
    selectPatientFromHook(patient);
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
    clearSearch();
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
    <>
      
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
          <div className="relative">
            <DateOfBirthInput
              value={formData.dataNascimento}
              onChange={(value) => setFormData(prev => ({ ...prev, dataNascimento: value }))}
              required
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {loading ? 'Buscando pacientes...' : 'Digite nome (3+ caracteres) ou data para buscar pacientes'}
          </p>
        </div>
      </div>
      
      {/* Lista de pacientes encontrados */}
      {showResults && (
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
            <div 
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                overflowX: 'hidden',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                padding: '12px',
                backgroundColor: 'hsl(var(--background))'
              }}
              className="space-y-2 scrollbar-thin scrollbar-track-muted scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground"
            >
              {foundPatients.map((patient, index) => (
                <div 
                  key={patient.id || `patient-${index}`} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer group"
                  onClick={() => selectPatient(patient)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{patient.nome_completo}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 truncate">
                      {patient.data_nascimento && (
                        <span>Nascimento: {patient.data_nascimento}</span>
                      )}
                      {patient.convenio && (
                        <span className="ml-3">Convênio: {patient.convenio}</span>
                      )}
                      {(patient.telefone || patient.celular) && (
                        <span className="ml-3">
                          {patient.telefone || patient.celular}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectPatient(patient);
                    }}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Selecionar
                  </Button>
                </div>
              ))}
            </div>
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
    </>
  );
}