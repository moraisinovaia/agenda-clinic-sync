import { Calendar, Clock, CalendarDays, XCircle, FileText, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewMode = 'doctors' | 'schedule' | 'new-appointment' | 'appointments-list' | 'edit-appointment' | 'fila-espera' | 'nova-fila' | 'bloqueio-agenda' | 'relatorio-agenda' | 'multiple-appointment' | 'canceled-appointments';

interface DashboardActionsProps {
  onViewChange: (view: ViewMode) => void;
}

export const DashboardActions = ({ onViewChange }: DashboardActionsProps) => {
  return (
    <div className="flex flex-wrap gap-2 w-full overflow-x-auto pb-2">
      <Button 
        onClick={() => onViewChange('new-appointment')}
        variant="outline"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <Calendar className="h-4 w-4" />
        Novo Agendamento
      </Button>
      
      <Button 
        onClick={() => onViewChange('multiple-appointment')}
        variant="outline"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <CalendarDays className="h-4 w-4" />
        Múltiplos Exames
      </Button>
      
      <Button 
        onClick={() => onViewChange('appointments-list')}
        variant="outline"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <Calendar className="h-4 w-4" />
        Ver Todos os Agendamentos
      </Button>
      
      <Button 
        onClick={() => onViewChange('canceled-appointments')}
        variant="outline"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <XCircle className="h-4 w-4" />
        Ver Cancelados
      </Button>
      
      <Button 
        onClick={() => onViewChange('fila-espera')}
        variant="outline"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <Clock className="h-4 w-4" />
        Fila de Espera
      </Button>
      
      <Button 
        onClick={() => onViewChange('relatorio-agenda')}
        variant="outline"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <FileText className="h-4 w-4" />
        Relatório de Agenda
      </Button>
      
      <Button 
        onClick={() => onViewChange('bloqueio-agenda')}
        variant="destructive"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <Ban className="h-4 w-4" />
        Bloquear Agenda
      </Button>
    </div>
  );
};