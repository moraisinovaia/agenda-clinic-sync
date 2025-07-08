import { Doctor } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User } from 'lucide-react';

interface DoctorCardProps {
  doctor: Doctor;
  onSchedule: (doctorId: string) => void;
}

export function DoctorCard({ doctor, onSchedule }: DoctorCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          {doctor.nome}
        </CardTitle>
        <Badge variant="secondary" className="w-fit">
          {doctor.especialidade}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Disponível para agendamento</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Horários conforme disponibilidade</span>
        </div>
        
        {doctor.convenios_aceitos && doctor.convenios_aceitos.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <strong>Convênios:</strong> {doctor.convenios_aceitos.join(', ')}
          </div>
        )}
        
        <Button 
          onClick={() => onSchedule(doctor.id)} 
          className="w-full mt-4"
          size="sm"
        >
          Agendar Consulta
        </Button>
      </CardContent>
    </Card>
  );
}