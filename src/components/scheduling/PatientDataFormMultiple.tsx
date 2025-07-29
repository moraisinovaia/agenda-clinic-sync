import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Search, AlertCircle } from 'lucide-react';
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
  const [foundPatients, setFoundPatients] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Buscar pacientes quando a data de nascimento muda
  useEffect(() => {
    if (formData.dataNascimento && formData.dataNascimento.length === 10) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      searchTimeoutRef.current = setTimeout(async () => {
        setSearchingPatients(true);
        try {
          const patients = await searchPatientsByBirthDate(formData.dataNascimento);
          setFoundPatients(patients || []);
          setShowPatientSuggestions(patients && patients.length > 0);
        } catch (error) {
          console.error('Erro ao buscar pacientes:', error);
          setFoundPatients([]);
        } finally {
          setSearchingPatients(false);
        }
      }, 500);
    } else {
      setFoundPatients([]);
      setShowPatientSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [formData.dataNascimento]); // Remover searchPatientsByBirthDate das dependências

  const handlePatientSelect = (patient: any) => {
    setFormData(prev => ({
      ...prev,
      nomeCompleto: patient.nome_completo,
      dataNascimento: patient.data_nascimento,
      convenio: patient.convenio,
      telefone: patient.telefone || '',
      celular: patient.celular || ''
    }));
    setShowPatientSuggestions(false);
  };

  const isConvenioCompatible = (convenio: string) => {
    if (!selectedDoctor || !selectedDoctor.convenios_aceitos) return true;
    return selectedDoctor.convenios_aceitos.includes(convenio);
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
          onChange={(e) => setFormData(prev => ({ ...prev, nomeCompleto: e.target.value }))}
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
            onChange={(e) => setFormData(prev => ({ ...prev, dataNascimento: e.target.value }))}
            required
          />
          {searchingPatients && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Search className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
        
        {/* Sugestões de pacientes encontrados */}
        {showPatientSuggestions && foundPatients.length > 0 && (
          <div className="border rounded-md bg-background shadow-sm">
            <div className="p-2 text-sm font-medium border-b bg-muted">
              Pacientes encontrados:
            </div>
            <div className="max-h-48 overflow-y-auto">
              {foundPatients.map((patient, index) => (
                <div
                  key={index}
                  className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                  onClick={() => handlePatientSelect(patient)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{patient.nome_completo}</div>
                      <div className="text-sm text-muted-foreground">
                        {patient.convenio} | {patient.celular || patient.telefone || 'Sem telefone'}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Selecionar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Convênio */}
      <div className="space-y-2">
        <Label htmlFor="convenio">Convênio *</Label>
        <Input
          id="convenio"
          type="text"
          value={formData.convenio}
          onChange={(e) => setFormData(prev => ({ ...prev, convenio: e.target.value }))}
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
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setFormData(prev => ({ ...prev, convenio }))}
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
            onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
            placeholder="(00) 0000-0000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="celular">Celular</Label>
          <Input
            id="celular"
            type="tel"
            value={formData.celular}
            onChange={(e) => setFormData(prev => ({ ...prev, celular: e.target.value }))}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>
    </div>
  );
}