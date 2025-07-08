import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from 'lucide-react';
import { SchedulingFormData } from '@/types/scheduling';

interface PatientDataFormProps {
  formData: SchedulingFormData;
  setFormData: React.Dispatch<React.SetStateAction<SchedulingFormData>>;
  availableConvenios: string[];
  medicoSelected: boolean;
}

export function PatientDataForm({ 
  formData, 
  setFormData, 
  availableConvenios, 
  medicoSelected 
}: PatientDataFormProps) {
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
          <Input
            id="dataNascimento"
            type="date"
            value={formData.dataNascimento}
            onChange={(e) => setFormData(prev => ({ ...prev, dataNascimento: e.target.value }))}
            required
          />
        </div>
        
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