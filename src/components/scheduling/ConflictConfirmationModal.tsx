import React from 'react';
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

interface ConflictDetails {
  conflict_message?: string;
  existing_appointments?: Array<{
    paciente_nome: string;
    atendimento_nome: string;
    status: string;
  }>;
}

interface ConflictConfirmationModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  conflictMessage: string;
  conflictDetails?: ConflictDetails;
}

export function ConflictConfirmationModal({ 
  open, 
  onConfirm, 
  onCancel, 
  conflictMessage,
  conflictDetails 
}: ConflictConfirmationModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-warning">⚠️ Conflito de Horário</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>{conflictMessage}</p>
            
            {conflictDetails?.existing_appointments && conflictDetails.existing_appointments.length > 0 && (
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="font-medium text-sm mb-2">Agendamentos existentes:</p>
                {conflictDetails.existing_appointments.map((appointment, index) => (
                  <div key={index} className="text-sm text-muted-foreground">
                    • {appointment.paciente_nome} - {appointment.atendimento_nome}
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              Deseja continuar mesmo assim? O agendamento será marcado como "forçado com conflito".
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-warning text-warning-foreground hover:bg-warning/90">
            Confirmar Mesmo Assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}