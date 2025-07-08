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
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const workingDays = doctor.workingHours.days.map(day => dayNames[day]).join(', ');

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          {doctor.name}
        </CardTitle>
        <Badge variant="secondary" className="w-fit">
          {doctor.specialty}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{workingDays}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{doctor.workingHours.start} - {doctor.workingHours.end}</span>
          <span className="text-xs">({doctor.consultationDuration}min)</span>
        </div>
        
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