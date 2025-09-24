import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateOfBirthInput } from '@/components/ui/date-of-birth-input';
import { User, Search, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { SchedulingFormData } from '@/types/scheduling';
import { useUnifiedPatientSearch } from '@/hooks/useUnifiedPatientSearch';

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
  const { 
    loading: searchingPatients, 
    foundPatients, 
    showResults, 
    selectPatient: selectSearchedPatient,
    searchByBirthDate,
    searchByName,
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

  // Validação de convênio vs médico
  const getConvenioValidation = () => {
    if (!selectedDoctor || !formData.convenio) return null;

    const { convenios_aceitos } = selectedDoctor;
    
    if (convenios_aceitos && convenios_aceitos.length > 0) {
      const convenioAceito = convenios_aceitos.some(convenio => 
        convenio.toLowerCase() === formData.convenio.toLowerCase()
      );
      
      if (!convenioAceito) {
        return {
          type: 'warning',
          message: `ATENÇÃO: Convênio "${formData.convenio}" pode não ser aceito por ${selectedDoctor.nome}`
        };
      } else {
        return {
          type: 'success',
          message: `Convênio aceito por ${selectedDoctor.nome}`
        };
      }
    }

    return null;
  };

  const ageValidation = getAgeValidation();
  const convenioValidation = getConvenioValidation();

  // Buscar por data de nascimento quando ela muda
  useEffect(() => {
    if (formData.dataNascimento) {
      searchByBirthDate(formData.dataNascimento);
    }
  }, [formData.dataNascimento, searchByBirthDate]);

  // Auto-selecionar paciente único se encontrado apenas um
  useEffect(() => {
    if (foundPatients.length === 1 && showResults) {
      console.log('🎯 Apenas um paciente encontrado, auto-selecionando...');
      autoSelectPatient(foundPatients[0]);
    }
  }, [foundPatients, showResults]);

  // Buscar por nome quando ele muda e não há data válida
  useEffect(() => {
    const hasValidBirthDate = formData.dataNascimento && formData.dataNascimento.length === 10;
    if (!hasValidBirthDate && formData.nomeCompleto) {
      searchByName(formData.nomeCompleto);
    }
  }, [formData.nomeCompleto, formData.dataNascimento, searchByName]);

  // Função para auto-selecionar paciente com convênio mais recente
  const autoSelectPatient = (patient: any) => {
    // Pegar o convênio mais recente (primeiro da lista já ordenada)
    const mostRecentConvenio = patient.convenios[0];
    
    console.log('🎯 Auto-selecionando paciente:', patient.nome_completo, 'Convênio mais recente:', mostRecentConvenio.convenio);
    
    // Verificar se o médico aceita este convênio
    const doctorAcceptsConvenio = !selectedDoctor?.convenios_aceitos || 
      selectedDoctor.convenios_aceitos.length === 0 ||
      selectedDoctor.convenios_aceitos.some(convenio => 
        convenio.toLowerCase() === mostRecentConvenio.convenio.toLowerCase()
      );
    
    // Preencher dados do formulário
    setFormData(prev => ({
      ...prev,
      nomeCompleto: patient.nome_completo,
      dataNascimento: patient.data_nascimento,
      telefone: patient.telefone || '',
      celular: patient.celular,
      convenio: doctorAcceptsConvenio ? mostRecentConvenio.convenio : '',
    }));
    
    // Registrar seleção e esconder resultados
    selectSearchedPatient(patient);
    
    console.log('🎯 Convênio aceito pelo médico:', doctorAcceptsConvenio);
  };

  // Função para selecionar um paciente encontrado (compatibilidade)
  const selectPatient = (patient: any) => autoSelectPatient(patient);

  // Função para criar novo paciente (manter dados atuais)
  const createNewPatient = () => {
    hideResults();
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
          <div className="relative">
            <DateOfBirthInput
              value={formData.dataNascimento}
              onChange={(value) => setFormData(prev => ({ ...prev, dataNascimento: value }))}
              required
            />
            {searchingPatients && (
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {searchingPatients ? 'Buscando pacientes...' : 'Ao inserir a data ou nome, buscaremos pacientes existentes'}
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
              className="h-[300px] overflow-y-scroll overflow-x-hidden border rounded-md bg-background"
            >
              <div className="space-y-2 p-2">
                {foundPatients.map((patient, index) => {
                  const mostRecentConvenio = patient.convenios[0];
                  const doctorAcceptsConvenio = !selectedDoctor?.convenios_aceitos || 
                    selectedDoctor.convenios_aceitos.length === 0 ||
                    selectedDoctor.convenios_aceitos.some(convenio => 
                      convenio.toLowerCase() === mostRecentConvenio.convenio.toLowerCase()
                    );
                  
                  return (
                    <div 
                      key={patient.id} 
                      className="p-3 border rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => selectPatient(patient)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{patient.nome_completo}</p>
                          <p className="text-sm text-muted-foreground">
                            Convênio mais recente: <span className="font-medium">{mostRecentConvenio.convenio}</span> • {patient.celular}
                            {patient.telefone && ` • ${patient.telefone}`}
                          </p>
                          {patient.convenios.length > 1 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              + {patient.convenios.length - 1} outros convênios
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {doctorAcceptsConvenio ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Compatível</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">Selecionar convênio</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="pt-2 border-t mt-2">
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

      {/* Alerta de validação de convênio */}
      {convenioValidation && (
        <Alert variant={convenioValidation.type === 'warning' ? 'default' : convenioValidation.type === 'success' ? 'default' : 'destructive'}>
          {convenioValidation.type === 'warning' ? (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          ) : convenioValidation.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {convenioValidation.message}
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
              {/* Filtrar convênios apenas pelos aceitos pelo médico se houver restrição */}
              {(selectedDoctor?.convenios_aceitos && selectedDoctor.convenios_aceitos.length > 0 
                ? availableConvenios.filter(convenio => 
                    selectedDoctor.convenios_aceitos!.some(aceito => 
                      aceito.toLowerCase() === convenio.toLowerCase()
                    )
                  )
                : availableConvenios
              ).map((convenio) => (
                <SelectItem key={convenio} value={convenio}>
                  {convenio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDoctor?.convenios_aceitos && selectedDoctor.convenios_aceitos.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Mostrando apenas convênios aceitos por {selectedDoctor.nome}
            </p>
          )}
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