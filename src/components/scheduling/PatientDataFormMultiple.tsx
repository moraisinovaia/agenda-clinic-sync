import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Search, UserCheck } from 'lucide-react';
import { Doctor } from '@/types/scheduling';
import { MultipleSchedulingFormData } from '@/types/multiple-scheduling';

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
  }, [formData.dataNascimento]); // Não incluir searchPatientsByBirthDate nas dependências

  // Função para selecionar um paciente encontrado - COM PROTEÇÃO
  const selectPatient = (patient: any) => {
    console.log('👤 Selecionando paciente:', patient.nome_completo);
    setFormData(prev => ({
      ...prev,
      nomeCompleto: patient.nome_completo,
      telefone: patient.telefone || '',
      celular: patient.celular,
      convenio: patient.convenio,
    }));
    setShowPatientsList(false);
  };

  // Função para criar novo paciente (apenas limpar campos específicos)
  const createNewPatient = () => {
    console.log('🆕 Criando novo paciente - preservando data:', formData.dataNascimento);
    setFormData(prev => ({
      ...prev,
      nomeCompleto: '',
      telefone: '',
      celular: '',
      convenio: '',
      // PRESERVAR: dataNascimento, medicoId, atendimentoIds, dataAgendamento, etc.
    }));
    setShowPatientsList(false);
  };

  // Verificação de compatibilidade do convênio
  const isConvenioCompatible = (convenio: string) => {
    if (!selectedDoctor || !selectedDoctor.convenios_aceitos) return true;
    return selectedDoctor.convenios_aceitos.includes(convenio);
  };

  // Função para formatação de telefone - IGUAL ao PatientDataForm.tsx
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
    console.log(`📞 Atualizando ${field}:`, formatted);
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  // Função para seleção de convênio via badge
  const selectConvenio = (convenio: string) => {
    console.log('💳 Selecionando convênio:', convenio);
    setFormData(prev => ({ ...prev, convenio }));
  };

  return (
    <div className="space-y-4">
      {/* Nome Completo */}
      <div className="space-y-2">
        <Label htmlFor="nomeCompleto">Nome Completo *</Label>
        <Input
          id="nomeCompleto"
          type="text"
          value={formData.nomeCompleto}
            onChange={(e) => {
              console.log('✏️ Alterando nome:', e.target.value);
              setFormData(prev => ({ ...prev, nomeCompleto: e.target.value }));
            }}
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
            onChange={(e) => {
              console.log('📅 Alterando data nascimento:', e.target.value);
              setFormData(prev => ({ ...prev, dataNascimento: e.target.value }));
            }}
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
                    type="button"
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
                  type="button"
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
          onChange={(e) => {
            console.log('💳 Alterando convênio:', e.target.value);
            setFormData(prev => ({ ...prev, convenio: e.target.value }));
          }}
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
            onChange={(e) => handlePhoneChange(e.target.value, 'telefone')}
            placeholder="(00) 0000-0000"
            maxLength={15}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Opcional - Formato: (11) 1234-5678
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="celular">Celular *</Label>
          <Input
            id="celular"
            type="tel"
            value={formData.celular}
            onChange={(e) => handlePhoneChange(e.target.value, 'celular')}
            placeholder="(00) 00000-0000"
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