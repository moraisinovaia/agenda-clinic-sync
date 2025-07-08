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
  console.log('PatientDataForm - availableConvenios:', availableConvenios);
  console.log('PatientDataForm - medicoSelected:', medicoSelected);
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
          <Label htmlFor="telefone">Telefone *</Label>
          <Input
            id="telefone"
            value={formData.telefone}
            onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
            placeholder="(xx) xxxxx-xxxx"
            required
          />
        </div>
      </div>
    </div>
  );
}