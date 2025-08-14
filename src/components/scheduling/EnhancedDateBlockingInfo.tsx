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
  className?: string;
}

export function EnhancedDateBlockingInfo({ 
  doctor, 
  date, 
  blockingReason,
  className 
}: EnhancedDateBlockingInfoProps) {
  if (!blockingReason) return null;

  const getAlertVariant = (): "default" | "destructive" => {
    // Apenas bloqueios explícitos agora
    return 'destructive';
  };

  const getIcon = () => {
    return <AlertTriangle className="h-4 w-4" />;
  };

  const formattedDate = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Alert variant={getAlertVariant()} className={className}>
      {getIcon()}
      <AlertDescription className="space-y-2">
        <div className="font-medium">{blockingReason.message}</div>
        <div className="text-sm text-muted-foreground">
          Data selecionada: <Badge variant="outline">{formattedDate}</Badge>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Esta data foi bloqueada manualmente na agenda do médico.
        </div>
      </AlertDescription>
    </Alert>
  );
}