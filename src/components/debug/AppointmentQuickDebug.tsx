import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppointmentWithRelations, Doctor } from '@/types/scheduling';
import { Badge } from '@/components/ui/badge';

interface AppointmentQuickDebugProps {
  appointments: AppointmentWithRelations[];
  doctor?: Doctor;
}

export function AppointmentQuickDebug({ appointments, doctor }: AppointmentQuickDebugProps) {
  const septemberAppointments = appointments.filter(apt => 
    apt.data_agendamento >= '2025-09-01' && apt.data_agendamento <= '2025-09-30'
  );

  const doctorSeptemberAppointments = doctor ? 
    septemberAppointments.filter(apt => String(apt.medico_id) === String(doctor.id)) : [];

  const handleFullDebug = () => {
    if (window.debugAppointments) {
      window.debugAppointments(appointments);
    } else {
      console.log('Debug functions not loaded yet');
    }
  };

  const handleDoctorDebug = () => {
    if (doctor && window.debugDoctorSchedule) {
      window.debugDoctorSchedule(doctor, appointments, '2025-09-01');
    } else {
      console.log('Doctor debug function not available');
    }
  };

  return (
    <Card className="mb-4 border-orange-200 bg-orange-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-orange-800">
          🔧 Debug Rápido - Agendamentos Setembro 2025
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium">Total de Agendamentos:</div>
            <Badge variant="outline">{appointments.length}</Badge>
          </div>
          <div>
            <div className="font-medium">Setembro 2025:</div>
            <Badge variant="outline" className={septemberAppointments.length > 0 ? 'bg-green-100' : 'bg-red-100'}>
              {septemberAppointments.length}
            </Badge>
          </div>
        </div>

        {doctor && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">{doctor.nome} (Total):</div>
              <Badge variant="outline">
                {appointments.filter(apt => String(apt.medico_id) === String(doctor.id)).length}
              </Badge>
            </div>
            <div>
              <div className="font-medium">{doctor.nome} (Setembro):</div>
              <Badge variant="outline" className={doctorSeptemberAppointments.length > 0 ? 'bg-green-100' : 'bg-red-100'}>
                {doctorSeptemberAppointments.length}
              </Badge>
            </div>
          </div>
        )}

        {septemberAppointments.length > 0 && (
          <div className="mt-3 p-3 bg-white rounded border">
            <div className="font-medium text-sm mb-2">Agendamentos Setembro (Todos os médicos):</div>
            <div className="space-y-1 text-xs">
              {septemberAppointments.slice(0, 5).map(apt => (
                <div key={apt.id} className="flex justify-between">
                  <span>{apt.data_agendamento} {apt.hora_agendamento}</span>
                  <span>{apt.medicos?.nome}</span>
                  <span>{apt.pacientes?.nome_completo?.substring(0, 20)}</span>
                </div>
              ))}
              {septemberAppointments.length > 5 && (
                <div className="text-center text-muted-foreground">
                  ... e mais {septemberAppointments.length - 5} agendamentos
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleFullDebug}
            className="text-xs"
          >
            Debug Geral (Console)
          </Button>
          {doctor && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDoctorDebug}
              className="text-xs"
            >
              Debug {doctor.nome} (Console)
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.debugSeptemberAppointments?.(appointments)}
            className="text-xs"
          >
            Debug Setembro (Console)
          </Button>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-2">
          <strong>Diagnóstico:</strong> Se "Setembro 2025" for maior que 0 mas "{doctor?.nome} (Setembro)" for 0, 
          há problema na filtragem por médico. Verifique o console para detalhes.
        </div>
      </CardContent>
    </Card>
  );
}