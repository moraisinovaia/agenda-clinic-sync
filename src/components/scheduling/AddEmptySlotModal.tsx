import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddEmptySlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  doctorName: string;
  onSuccess: () => void;
  preSelectedDate?: Date;
}

export function AddEmptySlotModal({
  open,
  onOpenChange,
  doctorId,
  doctorName,
  onSuccess,
  preSelectedDate
}: AddEmptySlotModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preSelectedDate || new Date());
  const [time, setTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateTime = (timeStr: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast.error('Selecione uma data');
      return;
    }

    if (!time || !validateTime(time)) {
      toast.error('Digite uma hora válida no formato HH:mm (ex: 08:30)');
      return;
    }

    setIsSubmitting(true);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Verificar se já existe agendamento neste horário
      const { data: existingAppointment } = await supabase
        .from('agendamentos')
        .select('id, pacientes(nome_completo)')
        .eq('medico_id', doctorId)
        .eq('data_agendamento', dateStr)
        .eq('hora_agendamento', time)
        .neq('status', 'cancelado')
        .neq('status', 'excluido')
        .maybeSingle();

      if (existingAppointment) {
        toast.error(`Já existe um agendamento neste horário`);
        setIsSubmitting(false);
        return;
      }

      // Verificar se já existe horário vazio
      const { data: existingSlot } = await supabase
        .from('horarios_vazios')
        .select('id')
        .eq('medico_id', doctorId)
        .eq('data', dateStr)
        .eq('hora', time)
        .maybeSingle();

      if (existingSlot) {
        toast.warning('Este horário vazio já existe');
        setIsSubmitting(false);
        return;
      }

      // Buscar cliente_id do médico
      const { data: doctorData } = await supabase
        .from('medicos')
        .select('cliente_id')
        .eq('id', doctorId)
        .single();

      if (!doctorData?.cliente_id) {
        toast.error('Erro ao buscar dados do médico');
        setIsSubmitting(false);
        return;
      }

      // Inserir horário vazio
      const { error } = await supabase
        .from('horarios_vazios')
        .insert({
          medico_id: doctorId,
          data: dateStr,
          hora: time,
          status: 'disponivel',
          cliente_id: doctorData.cliente_id
        });

      if (error) throw error;

      toast.success(`Horário ${time} adicionado com sucesso!`);
      onSuccess();
      onOpenChange(false);
      setTime('');
    } catch (error) {
      console.error('Erro ao adicionar horário:', error);
      toast.error('Erro ao adicionar horário');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Horário Manual</DialogTitle>
          <DialogDescription>
            {doctorName} - Adicione um horário específico em qualquer minuto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Hora (formato HH:mm)</Label>
            <Input
              id="time"
              type="text"
              placeholder="Ex: 08:30, 14:45, 07:02"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              maxLength={5}
            />
            <p className="text-xs text-muted-foreground">
              💡 Você pode adicionar qualquer horário (ex: 07:02, 14:47)
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedDate || !time}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Adicionando...' : 'Adicionar Horário'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
