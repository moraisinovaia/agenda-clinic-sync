import { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Doctor } from '@/types/scheduling';
import { MultipleSchedulingFormData } from '@/types/multiple-scheduling';
import { EnhancedPatientSearch } from './EnhancedPatientSearch';

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
        <Input
          id="dataNascimento"
          type="date"
          value={formData.dataNascimento}
          onChange={updateField('dataNascimento')}
          required
        />
        
        {/* Componente de busca melhorado */}
        <EnhancedPatientSearch
          birthDate={formData.dataNascimento}
          onPatientSelect={handlePatientSelect}
          searchPatientsByBirthDate={searchPatientsByBirthDate}
        />
      </div>

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