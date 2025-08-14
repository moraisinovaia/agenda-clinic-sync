import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Doctor } from '@/types/scheduling';
import { getDoctorAvailableHours, getNextAvailableDates } from '@/utils/scheduling-validation';

interface EnhancedDateBlockingInfoProps {
  doctor: Doctor;
  date: Date;
  blockingReason?: {
    type: string;
    message: string;
  } | null;
  availableDays?: string[];
  className?: string;
}

export function EnhancedDateBlockingInfo({ 
  doctor, 
  date, 
  blockingReason,
  availableDays,
  className 
}: EnhancedDateBlockingInfoProps) {
  if (!blockingReason) return null;

  const getAlertVariant = () => {
    switch (blockingReason.type) {
      case 'no_working_day':
        return 'default';
      case 'explicit_block':
        return 'destructive';
      case 'past_date':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getIcon = () => {
    switch (blockingReason.type) {
      case 'no_working_day':
        return <Calendar className="h-4 w-4" />;
      case 'explicit_block':
        return <AlertTriangle className="h-4 w-4" />;
      case 'past_date':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getDoctorWorkingDays = () => {
    if (!doctor.horarios) return [];
    
    const dayMap: { [key: string]: string } = {
      'domingo': 'domingos',
      'segunda': 'segundas-feiras',
      'terca': 'terças-feiras', 
      'quarta': 'quartas-feiras',
      'quinta': 'quintas-feiras',
      'sexta': 'sextas-feiras',
      'sabado': 'sábados'
    };

    return Object.keys(doctor.horarios)
      .filter(day => doctor.horarios?.[day]?.length > 0)
      .map(day => dayMap[day] || day);
  };

  const workingDays = getDoctorWorkingDays();
  const formattedDate = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Alert variant={getAlertVariant()} className={className}>
      {getIcon()}
      <AlertDescription className="space-y-2">
        <div className="font-medium">{blockingReason.message}</div>
        <div className="text-sm text-muted-foreground">
          Data selecionada: <Badge variant="outline">{formattedDate}</Badge>
        </div>
        
        {blockingReason.type === 'no_working_day' && workingDays.length > 0 && (
          <div className="text-sm">
            <div className="font-medium mb-1">Dias de atendimento:</div>
            <div className="flex flex-wrap gap-1">
              {workingDays.map((day, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {day}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {blockingReason.type === 'explicit_block' && (
          <div className="text-sm text-muted-foreground">
            Esta data foi bloqueada na agenda do médico.
          </div>
        )}

        {blockingReason.type === 'no_working_day' && (
          <div className="text-sm">
            <div className="font-medium mb-1">Horários normais de atendimento:</div>
            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              {getDoctorAvailableHours(doctor, date).map((hour, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {hour}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}