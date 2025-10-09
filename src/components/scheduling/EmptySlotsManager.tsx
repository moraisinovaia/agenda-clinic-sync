import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Calendar as CalendarIcon, Clock, Loader2 } from 'lucide-react';
import { useEmptySlotsManager, EmptySlot } from '@/hooks/useEmptySlotsManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EmptySlotsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  doctorName: string;
  onSuccess: () => void;
}

export function EmptySlotsManager({
  open,
  onOpenChange,
  doctorId,
  doctorName,
  onSuccess
}: EmptySlotsManagerProps) {
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<EmptySlot[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'slot' | 'date' | 'period', value: string | null }>({ type: 'slot', value: null });

  const { loading, fetchEmptySlots, deleteSlot, deleteSlotsForDate, deleteSlotsForPeriod } = useEmptySlotsManager();

  useEffect(() => {
    if (open && doctorId) {
      loadSlots();
    }
  }, [open, doctorId]);

  const loadSlots = async () => {
    const data = await fetchEmptySlots(doctorId, startDate, endDate);
    setSlots(data);
  };

  const handleSearch = () => {
    loadSlots();
  };

  const handleDeleteSlot = async (slotId: string) => {
    const success = await deleteSlot(slotId);
    if (success) {
      loadSlots();
      onSuccess();
    }
    setDeleteConfirm({ type: 'slot', value: null });
  };

  const handleDeleteDate = async (date: string) => {
    const success = await deleteSlotsForDate(doctorId, date);
    if (success) {
      loadSlots();
      onSuccess();
    }
    setDeleteConfirm({ type: 'date', value: null });
  };

  const handleDeletePeriod = async () => {
    const success = await deleteSlotsForPeriod(doctorId, startDate, endDate);
    if (success) {
      loadSlots();
      onSuccess();
    }
    setDeleteConfirm({ type: 'period', value: null });
  };

  // Agrupar slots por data
  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.data]) {
      acc[slot.data] = [];
    }
    acc[slot.data].push(slot);
    return acc;
  }, {} as Record<string, EmptySlot[]>);

  const sortedDates = Object.keys(groupedSlots).sort();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Gerenciar Horários Vazios</DialogTitle>
            <DialogDescription>
              {doctorName} - Visualize e remova horários vazios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Fim</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleSearch} className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
              Buscar Horários
            </Button>

            {/* Lista de horários */}
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-2" />
                  <p>Nenhum horário vazio encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <Badge variant="outline">
                      Total: {slots.length} horários
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteConfirm({ type: 'period', value: 'all' })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir todos do período
                    </Button>
                  </div>

                  {sortedDates.map(date => {
                    const dateSlots = groupedSlots[date];
                    const dateObj = parse(date, 'yyyy-MM-dd', new Date());
                    const formattedDate = format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

                    return (
                      <Card key={date} className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold capitalize">{formattedDate}</h3>
                            <Badge>{dateSlots.length} horários</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm({ type: 'date', value: date })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir dia
                          </Button>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {dateSlots.map(slot => (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
                            >
                              <span className="text-sm font-mono">{slot.hora}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setDeleteConfirm({ type: 'slot', value: slot.id })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs de confirmação */}
      <AlertDialog open={deleteConfirm.value !== null} onOpenChange={() => setDeleteConfirm({ type: 'slot', value: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.type === 'slot' && 'Deseja realmente excluir este horário?'}
              {deleteConfirm.type === 'date' && 'Deseja realmente excluir TODOS os horários deste dia?'}
              {deleteConfirm.type === 'period' && `Deseja realmente excluir TODOS os ${slots.length} horários deste período?`}
              {' '}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm.type === 'slot' && deleteConfirm.value) {
                  handleDeleteSlot(deleteConfirm.value);
                } else if (deleteConfirm.type === 'date' && deleteConfirm.value) {
                  handleDeleteDate(deleteConfirm.value);
                } else if (deleteConfirm.type === 'period') {
                  handleDeletePeriod();
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
