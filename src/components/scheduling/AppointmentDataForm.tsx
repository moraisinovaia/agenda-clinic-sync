import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Clock } from 'lucide-react';
import { Doctor, SchedulingFormData } from '@/types/scheduling';

interface AppointmentDataFormProps {
  formData: SchedulingFormData;
  setFormData: React.Dispatch<React.SetStateAction<SchedulingFormData>>;
  doctors: Doctor[];
}

export function AppointmentDataForm({ 
  formData, 
  setFormData, 
  doctors 
}: AppointmentDataFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Dados do Agendamento
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="medico">Médico *</Label>
          <Select 
            value={formData.medicoId} 
            onValueChange={(value) => setFormData(prev => ({ 
              ...prev, 
              medicoId: value,
              atendimentoId: '', // Reset atendimento when doctor changes
              convenio: '' // Reset convenio when doctor changes
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o médico" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.nome} - {doctor.especialidade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="atendimento">Tipo de Atendimento *</Label>
          <Select 
            value={formData.atendimentoId} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, atendimentoId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consulta">Consulta</SelectItem>
              <SelectItem value="retorno">Retorno</SelectItem>
              <SelectItem value="exame">Exame</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="dataAgendamento">Data *</Label>
          <Input
            id="dataAgendamento"
            type="date"
            value={formData.dataAgendamento}
            onChange={(e) => setFormData(prev => ({ ...prev, dataAgendamento: e.target.value }))}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="horaAgendamento">Horário *</Label>
          <Input
            id="horaAgendamento"
            type="time"
            value={formData.horaAgendamento}
            onChange={(e) => setFormData(prev => ({ ...prev, horaAgendamento: e.target.value }))}
            required
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={formData.observacoes}
          onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
          placeholder="Informações adicionais sobre o agendamento"
          rows={3}
        />
      </div>
    </div>
  );
}