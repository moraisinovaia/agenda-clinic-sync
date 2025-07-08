import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Doctor, SchedulingFormData, Atendimento } from '@/types/scheduling';

interface AppointmentDataFormProps {
  formData: SchedulingFormData;
  setFormData: React.Dispatch<React.SetStateAction<SchedulingFormData>>;
  doctors: Doctor[];
  atendimentos: Atendimento[];
}

export function AppointmentDataForm({ 
  formData, 
  setFormData, 
  doctors,
  atendimentos 
}: AppointmentDataFormProps) {
  const [openDoctorCombo, setOpenDoctorCombo] = useState(false);
  // Filtrar atendimentos baseado no médico selecionado
  const filteredAtendimentos = formData.medicoId 
    ? atendimentos.filter(atendimento => atendimento.medico_id === formData.medicoId)
    : [];

  // Função para obter data/hora atual
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  // Função para validar horário
  const isTimeValid = (selectedDate: string, selectedTime: string) => {
    if (!selectedDate || !selectedTime) return true;
    
    // Se a data selecionada for hoje, verificar se o horário não é passado
    if (selectedDate === today) {
      return selectedTime > currentTime;
    }
    
    // Se for data futura, qualquer horário é válido
    return true;
  };

  // Função para obter horário mínimo baseado na data
  const getMinTime = (selectedDate: string) => {
    if (selectedDate === today) {
      // Se for hoje, horário mínimo é a próxima hora
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      return nextHour.toTimeString().slice(0, 5);
    }
    return '07:00'; // Horário padrão de início
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Dados do Agendamento
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="medico">Médico *</Label>
          <Popover open={openDoctorCombo} onOpenChange={setOpenDoctorCombo}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openDoctorCombo}
                className="w-full justify-between"
              >
                {formData.medicoId
                  ? doctors.find((doctor) => doctor.id === formData.medicoId)?.nome + 
                    " - " + 
                    doctors.find((doctor) => doctor.id === formData.medicoId)?.especialidade
                  : "Selecione o médico..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Buscar médico..." />
                <CommandList>
                  <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                  <CommandGroup>
                    {doctors.map((doctor) => (
                      <CommandItem
                        key={doctor.id}
                        value={`${doctor.nome} ${doctor.especialidade}`}
                        onSelect={() => {
                          setFormData(prev => ({
                            ...prev,
                            medicoId: doctor.id,
                            atendimentoId: '', // Reset atendimento when doctor changes
                            convenio: '' // Reset convenio when doctor changes
                          }));
                          setOpenDoctorCombo(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.medicoId === doctor.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {doctor.nome} - {doctor.especialidade}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label htmlFor="atendimento">Tipo de Atendimento *</Label>
          <Select 
            value={formData.atendimentoId} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, atendimentoId: value }))}
            disabled={!formData.medicoId}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !formData.medicoId 
                  ? "Selecione primeiro um médico" 
                  : filteredAtendimentos.length === 0 
                    ? "Nenhum atendimento disponível" 
                    : "Selecione o tipo"
              } />
            </SelectTrigger>
            <SelectContent>
              {filteredAtendimentos.map((atendimento) => (
                <SelectItem key={atendimento.id} value={atendimento.id}>
                  {atendimento.nome} - {atendimento.tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="dataAgendamento">Data *</Label>
          <Input
            id="dataAgendamento"
            type="date"
            value={formData.dataAgendamento}
            onChange={(e) => {
              setFormData(prev => ({ 
                ...prev, 
                dataAgendamento: e.target.value,
                // Reset horário se mudar a data para evitar horários inválidos
                horaAgendamento: e.target.value === today ? '' : prev.horaAgendamento
              }));
            }}
            min={today}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Apenas datas futuras são permitidas
          </p>
        </div>
        
        <div>
          <Label htmlFor="horaAgendamento">Horário *</Label>
          <Input
            id="horaAgendamento"
            type="time"
            value={formData.horaAgendamento}
            onChange={(e) => setFormData(prev => ({ ...prev, horaAgendamento: e.target.value }))}
            min={getMinTime(formData.dataAgendamento)}
            max="18:00"
            step="1800" // Intervalos de 30 minutos
            required
            className={
              formData.dataAgendamento && formData.horaAgendamento && 
              !isTimeValid(formData.dataAgendamento, formData.horaAgendamento) 
                ? 'border-red-500' 
                : ''
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.dataAgendamento === today 
              ? `Horário mínimo para hoje: ${getMinTime(formData.dataAgendamento)}`
              : 'Horário de funcionamento: 07:00 às 18:00'
            }
          </p>
          {formData.dataAgendamento && formData.horaAgendamento && 
           !isTimeValid(formData.dataAgendamento, formData.horaAgendamento) && (
            <p className="text-xs text-red-500 mt-1">
              Não é possível agendar para um horário que já passou
            </p>
          )}
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