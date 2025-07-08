import { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Trash2, Plus } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

interface DoctorScheduleProps {
  doctor: Doctor;
  appointments: AppointmentWithRelations[];
  onCancelAppointment: (appointmentId: string) => Promise<void>;
  onNewAppointment?: () => void;
  initialDate?: string; // Data inicial para posicionar o calendário
}

export function DoctorSchedule({ doctor, appointments, onCancelAppointment, onNewAppointment, initialDate }: DoctorScheduleProps) {
  // Usar initialDate se fornecida, senão usar data atual
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDate) {
      return new Date(initialDate);
    }
    return new Date();
  });
  
  const getAppointmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(
      appointment => 
        appointment.medico_id === doctor.id && 
        appointment.data_agendamento === dateStr
    );
  };

  // Função para verificar se uma data tem agendamentos
  const hasAppointments = (date: Date) => {
    return getAppointmentsForDate(date).length > 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'realizado':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const selectedDateAppointments = getAppointmentsForDate(selectedDate);

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Agenda - {doctor.nome}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {doctor.especialidade}
              </div>
            </div>
            {onNewAppointment && (
              <Button onClick={onNewAppointment} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Agendamento
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Calendário */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Selecione uma data</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="rounded-md border shadow-sm bg-background p-3 pointer-events-auto"
                modifiers={{
                  hasAppointments: (date) => hasAppointments(date)
                }}
                modifiersStyles={{
                  hasAppointments: {
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    fontWeight: 'bold'
                  }
                }}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded"></div>
                  <span>Dias com agendamentos</span>
                </div>
              </div>
            </div>

            {/* Lista de agendamentos do dia selecionado */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Agendamentos para {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedDateAppointments.length > 0 ? (
                  selectedDateAppointments
                    .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                    .map((appointment) => (
                      <Card key={appointment.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-lg">
                              {appointment.hora_agendamento}
                            </span>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`${getStatusColor(appointment.status)}`}
                          >
                            {appointment.status}
                          </Badge>
                         </div>
                         
                         <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {appointment.pacientes?.nome_completo || 'Paciente'}
                              </span>
                            </div>
                            
                            <div className="text-sm text-muted-foreground">
                              <strong>Convênio:</strong> {appointment.pacientes?.convenio || 'Não informado'}
                            </div>
                            
                            <div className="text-sm text-muted-foreground">
                              <strong>Tipo:</strong> {appointment.atendimentos?.nome || 'Consulta/Exame'}
                            </div>
                           
                           {appointment.observacoes && (
                             <div className="text-sm text-muted-foreground">
                               <strong>Observações:</strong> {appointment.observacoes}
                             </div>
                           )}
                         </div>

                         {/* Botões de ação */}
                         <div className="flex gap-2 pt-2">
                           {appointment.status === 'agendado' && (
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button variant="destructive" size="sm">
                                   <Trash2 className="h-4 w-4 mr-1" />
                                   Cancelar
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     Tem certeza que deseja cancelar este agendamento para {format(selectedDate, "dd/MM/yyyy")} às {appointment.hora_agendamento}? 
                                     Esta ação não pode ser desfeita.
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>Não cancelar</AlertDialogCancel>
                                   <AlertDialogAction
                                     onClick={() => onCancelAppointment(appointment.id)}
                                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                   >
                                     Sim, cancelar
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                           )}
                         </div>
                      </Card>
                    ))
                ) : (
                  <Card className="p-8 text-center">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-muted-foreground mb-2">
                      Nenhum agendamento
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Não há agendamentos para esta data.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'agendado').length}
              </p>
              <p className="text-sm text-muted-foreground">Agendados</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'confirmado').length}
              </p>
              <p className="text-sm text-muted-foreground">Confirmados</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <User className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'realizado').length}
              </p>
              <p className="text-sm text-muted-foreground">Realizados</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'cancelado').length}
              </p>
              <p className="text-sm text-muted-foreground">Cancelados</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}