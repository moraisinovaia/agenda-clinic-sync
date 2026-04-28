import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, User } from 'lucide-react';

interface CancelAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  medicoNome: string;
  atendimentoNome: string;
  currentUserName: string;
  onConfirm: (motivo: string) => void;
  loading?: boolean;
}

export function CancelAppointmentModal({
  open,
  onOpenChange,
  patientName,
  appointmentDate,
  appointmentTime,
  medicoNome,
  atendimentoNome,
  currentUserName,
  onConfirm,
  loading = false,
}: CancelAppointmentModalProps) {
  const [motivo, setMotivo] = useState('');

  const handleConfirm = () => {
    onConfirm(motivo.trim());
    setMotivo('');
  };

  const handleClose = () => {
    if (!loading) {
      setMotivo('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Cancelar agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados do agendamento */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Paciente: </span>
              <span className="font-semibold">{patientName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Data/hora: </span>
              <span className="font-medium">{appointmentDate} às {appointmentTime}</span>
            </div>
            {(medicoNome || atendimentoNome) && (
              <div>
                <span className="text-muted-foreground">Médico/Atendimento: </span>
                <span className="font-medium">
                  {medicoNome}
                  {medicoNome && atendimentoNome ? ' — ' : ''}
                  {atendimentoNome}
                </span>
              </div>
            )}
          </div>

          {/* Quem está cancelando */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>
              Cancelando como:{' '}
              <span className="font-medium text-foreground">{currentUserName}</span>
            </span>
          </div>

          {/* Motivo opcional */}
          <div className="space-y-2">
            <Label htmlFor="motivo-cancel">Motivo (opcional)</Label>
            <Textarea
              id="motivo-cancel"
              placeholder="Ex: Paciente solicitou remarcação"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              rows={3}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-right">{motivo.length}/200</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Não cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
