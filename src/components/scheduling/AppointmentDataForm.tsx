
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, Check, ChevronsUpDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Doctor, SchedulingFormData, Atendimento } from '@/types/scheduling';
import { toZonedTime, format } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';

interface AppointmentDataFormProps {
  formData: SchedulingFormData;
  setFormData: React.Dispatch<React.SetStateAction<SchedulingFormData>>;
  doctors: Doctor[];
  atendimentos: Atendimento[];
  validationErrors?: { [key: string]: string };
}

export function AppointmentDataForm({ 
  formData, 
  setFormData, 
  doctors, 
  atendimentos,
  validationErrors: externalValidationErrors = {}
}: AppointmentDataFormProps) {
  const [openDoctorCombo, setOpenDoctorCombo] = useState(false);
  
  // Filtrar atendimentos baseado no médico selecionado
  const filteredAtendimentos = formData.medicoId 
    ? atendimentos.filter(atendimento => atendimento.medico_id === formData.medicoId)
    : [];

  // Função para obter data/hora atual no timezone brasileiro
  const getBrazilTime = () => {
    return toZonedTime(new Date(), BRAZIL_TIMEZONE);
  };

  const nowBrazil = getBrazilTime();
  const today = format(nowBrazil, 'yyyy-MM-dd');
  const currentTime = format(nowBrazil, 'HH:mm');

  // Função para validar horário com 1 hora de antecedência
  const isTimeValid = (selectedDate: string, selectedTime: string) => {
    if (!selectedDate || !selectedTime) return true;
    
    // Se a data selecionada for hoje, verificar se o horário respeita a antecedência de 1 hora
    if (selectedDate === today) {
      const oneHourLater = new Date(nowBrazil.getTime() + 60 * 60 * 1000);
      const minTimeRequired = format(oneHourLater, 'HH:mm');
      return selectedTime >= minTimeRequired;
    }
    
    // Se for data futura, qualquer horário é válido
    return true;
  };

  // Função para obter horário mínimo baseado na data
  const getMinTime = (selectedDate: string) => {
    if (selectedDate === today) {
      // Se for hoje, horário mínimo é 1 hora após o horário atual do Brasil
      const oneHourLater = new Date(nowBrazil.getTime() + 60 * 60 * 1000);
      return format(oneHourLater, 'HH:mm');
    }
    return '07:00'; // Horário padrão de início
  };


  // Função melhorada para mudança de médico
  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return;

    // Filtrar atendimentos para o novo médico
    const newFilteredAtendimentos = atendimentos.filter(
      atendimento => atendimento.medico_id === doctorId
    );

    // Auto-selecionar primeiro atendimento se houver apenas um
    const autoSelectAtendimento = newFilteredAtendimentos.length === 1 
      ? newFilteredAtendimentos[0].id 
      : '';

    setFormData(prev => ({
      ...prev,
      medicoId: doctorId,
      atendimentoId: autoSelectAtendimento, // Não resetar se auto-selecionado
      convenio: '' // Reset apenas convenio
    }));


    setOpenDoctorCombo(false);
  };

  // Função para mudança de data com validação de horário
  const handleDateChange = (date: string) => {
    setFormData(prev => ({ 
      ...prev, 
      dataAgendamento: date,
      // Reset horário apenas se a data for hoje e o horário atual for inválido
      horaAgendamento: date === today && prev.horaAgendamento && !isTimeValid(date, prev.horaAgendamento)
        ? '' 
        : prev.horaAgendamento
    }));
    
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Dados do Agendamento
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="medico" className={externalValidationErrors.medicoId ? 'text-destructive' : ''}>
            Médico *
          </Label>
          <Popover open={openDoctorCombo} onOpenChange={setOpenDoctorCombo}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openDoctorCombo}
                className={cn(
                  "w-full justify-between",
                  externalValidationErrors.medicoId && "border-destructive"
                )}
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
                        onSelect={() => handleDoctorChange(doctor.id)}
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
          {externalValidationErrors.medicoId && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {externalValidationErrors.medicoId}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="atendimento" className={externalValidationErrors.atendimentoId ? 'text-destructive' : ''}>
            Tipo de Atendimento *
          </Label>
          <Select 
            value={formData.atendimentoId} 
            onValueChange={(value) => {
              setFormData(prev => ({ ...prev, atendimentoId: value }));
            }}
            disabled={!formData.medicoId}
          >
            <SelectTrigger className={cn(externalValidationErrors.atendimentoId && "border-destructive")}>
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
          {externalValidationErrors.atendimentoId && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {externalValidationErrors.atendimentoId}
            </p>
          )}
          {filteredAtendimentos.length === 0 && formData.medicoId && (
            <p className="text-sm text-muted-foreground mt-1">
              Este médico não possui tipos de atendimento configurados
            </p>
          )}
        </div>
        
        <div>
          <Label htmlFor="dataAgendamento" className={externalValidationErrors.dataAgendamento ? 'text-destructive' : ''}>
            Data *
          </Label>
          <Input
            id="dataAgendamento"
            type="date"
            value={formData.dataAgendamento}
            onChange={(e) => handleDateChange(e.target.value)}
            min={today}
            required
            className={cn(externalValidationErrors.dataAgendamento && "border-destructive")}
          />
          {externalValidationErrors.dataAgendamento ? (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {externalValidationErrors.dataAgendamento}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Apenas datas futuras são permitidas
            </p>
          )}
        </div>
        
        <div>
          <Label htmlFor="horaAgendamento" className={externalValidationErrors.horaAgendamento ? 'text-destructive' : ''}>
            Horário *
          </Label>
          <Input
            id="horaAgendamento"
            type="time"
            value={formData.horaAgendamento}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, horaAgendamento: e.target.value }));
            }}
            min={getMinTime(formData.dataAgendamento)}
            max="18:00"
            step="60" // Intervalos de 1 minuto
            required
            className={cn(externalValidationErrors.horaAgendamento && "border-destructive")}
          />
          {externalValidationErrors.horaAgendamento ? (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {externalValidationErrors.horaAgendamento}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {formData.dataAgendamento === today 
                ? `Horário mínimo para hoje: ${getMinTime(formData.dataAgendamento)}`
                : 'Horário de funcionamento: 07:00 às 18:00'
              }
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
