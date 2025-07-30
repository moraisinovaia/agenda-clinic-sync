import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarIcon, Clock, User, Trash2, Plus, Edit, CheckCircle, Phone, MapPin, FileText } from 'lucide-react';
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
  blockedDates?: any[];
  isDateBlocked?: (doctorId: string, date: Date) => boolean;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
  onConfirmAppointment?: (appointmentId: string) => Promise<void>;
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onNewAppointment?: () => void;
  initialDate?: string; // Data inicial para posicionar o calendário
}

export function DoctorSchedule({ doctor, appointments, blockedDates = [], isDateBlocked, onCancelAppointment, onConfirmAppointment, onEditAppointment, onNewAppointment, initialDate }: DoctorScheduleProps) {
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

  // Função para verificar se uma data está bloqueada
  const hasBlocks = (date: Date) => {
    if (isDateBlocked) {
      return isDateBlocked(doctor.id, date);
    }
    // Fallback manual se isDateBlocked não estiver disponível
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.some(blocked => 
      blocked.medico_id === doctor.id &&
      blocked.status === 'ativo' &&
      dateStr >= blocked.data_inicio &&
      dateStr <= blocked.data_fim
    );
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
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'agendado':
        return Clock;
      case 'confirmado':
        return CheckCircle;
      case 'realizado':
        return User;
      case 'cancelado':
        return Trash2;
      default:
        return Clock;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'Agendado';
      case 'confirmado':
        return 'Confirmado';
      case 'realizado':
        return 'Realizado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
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
        
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-3 h-[500px]">
            {/* Calendário - Lado Esquerdo */}
            <div className="border-r p-3 space-y-3">
              <h3 className="font-medium text-sm">Selecione uma data</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="rounded-md border-none p-0"
                modifiers={{
                  hasAppointments: (date) => hasAppointments(date),
                  hasBlocks: (date) => hasBlocks(date)
                }}
                modifiersStyles={{
                  hasAppointments: {
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    fontWeight: 'bold'
                  },
                  hasBlocks: {
                    backgroundColor: 'hsl(var(--destructive))',
                    color: 'hsl(var(--destructive-foreground))',
                    fontWeight: 'bold',
                    textDecoration: 'line-through'
                  }
                }}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded"></div>
                  <span>Com agendamentos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-destructive rounded"></div>
                  <span>Bloqueados</span>
                </div>
              </div>
            </div>

            {/* Lista de Agendamentos - Lado Direito */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="p-3 border-b bg-muted/30 flex-shrink-0">
                <h3 className="font-medium text-sm">
                  {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedDateAppointments.length} agendamento(s)
                </p>
              </div>
              
              <ScrollArea className="flex-1 p-3">
                {selectedDateAppointments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDateAppointments
                      .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                      .map((appointment) => {
                        const StatusIcon = getStatusIcon(appointment.status);
                        return (
                          <Card key={appointment.id} className="hover:shadow-sm transition-all duration-200 border-l-2 border-l-primary/30">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                {/* Informações principais */}
                                <div className="flex-1 space-y-2">
                                  {/* Header compacto */}
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-primary" />
                                    <span className="font-mono text-base font-semibold">
                                      {appointment.hora_agendamento}
                                    </span>
                                    <Badge className={`text-xs px-1.5 py-0.5 ${getStatusColor(appointment.status)}`}>
                                      <StatusIcon className="h-2.5 w-2.5 mr-1" />
                                      {getStatusLabel(appointment.status)}
                                    </Badge>
                                  </div>

                                  {/* Nome do paciente */}
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium text-sm">
                                      {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                                    </span>
                                  </div>
                                  
                                  {/* Informações compactas em linha */}
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {(appointment.pacientes?.telefone || appointment.pacientes?.celular) && (
                                      <div className="flex items-center gap-1">
                                        <Phone className="h-2.5 w-2.5 text-muted-foreground" />
                                        <span>{appointment.pacientes?.telefone || appointment.pacientes?.celular}</span>
                                      </div>
                                    )}
                                    
                                    {appointment.pacientes?.convenio && (
                                      <Badge variant="outline" className="text-xs px-1 py-0">
                                        {appointment.pacientes.convenio}
                                      </Badge>
                                    )}
                                    
                                    {appointment.atendimentos?.nome && (
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-2.5 w-2.5 text-muted-foreground" />
                                        <span className="truncate max-w-[120px]">{appointment.atendimentos.nome}</span>
                                      </div>
                                    )}
                                  </div>

                                  {appointment.observacoes && (
                                    <div className="p-1.5 bg-muted/50 rounded text-xs">
                                      <span className="font-medium">Obs:</span> {appointment.observacoes}
                                    </div>
                                  )}
                                </div>

                                {/* Ações compactas */}
                                <div className="flex flex-col gap-1">
                                  {onEditAppointment && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => onEditAppointment(appointment)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <Edit className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                  
                                  {appointment.status === 'agendado' && onConfirmAppointment && (
                                    <Button 
                                      variant="default" 
                                      size="sm"
                                      onClick={() => onConfirmAppointment(appointment.id)}
                                      className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                  
                                  {appointment.status === 'agendado' && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          variant="destructive" 
                                          size="sm"
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Trash2 className="h-2.5 w-2.5" />
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
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Nenhum agendamento
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Não há agendamentos para esta data.
                      </p>
                      {onNewAppointment && (
                        <Button onClick={onNewAppointment} size="sm" className="text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Novo Agendamento
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
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