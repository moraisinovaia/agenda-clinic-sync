import { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Trash2, Plus, Edit, CheckCircle, Phone } from 'lucide-react';
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
        return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'confirmado':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'realizado':
        return 'bg-gray-500 text-white hover:bg-gray-600';
      case 'cancelado':
        return 'bg-red-500 text-white hover:bg-red-600';
      default:
        return 'bg-gray-400 text-white hover:bg-gray-500';
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
          <div className="grid lg:grid-cols-3 h-[600px]">
            {/* Calendário - Lado Esquerdo */}
            <div className="border-r p-4 space-y-4">
              <h3 className="font-semibold text-sm">Selecione uma data</h3>
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
                  <div className="w-3 h-3 bg-primary rounded"></div>
                  <span>Dias com agendamentos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-destructive rounded"></div>
                  <span>Dias bloqueados</span>
                </div>
              </div>
            </div>

            {/* Tabela de Agendamentos - Lado Direito */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-sm">
                  Agendamentos para {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {selectedDateAppointments.length > 0 ? (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-16 text-xs font-semibold">Status</TableHead>
                        <TableHead className="w-20 text-xs font-semibold">Hora</TableHead>
                        <TableHead className="text-xs font-semibold">Paciente</TableHead>
                        <TableHead className="w-24 text-xs font-semibold">Telefone</TableHead>
                        <TableHead className="w-20 text-xs font-semibold">Convênio</TableHead>
                        <TableHead className="text-xs font-semibold">Tipo</TableHead>
                        <TableHead className="w-24 text-xs font-semibold">Agendado por</TableHead>
                        <TableHead className="w-32 text-xs font-semibold text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDateAppointments
                        .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                        .map((appointment) => (
                          <TableRow key={appointment.id} className="hover:bg-muted/20 h-12">
                            <TableCell className="p-2">
                              <Badge 
                                className={`text-xs px-2 py-1 ${getStatusColor(appointment.status)}`}
                              >
                                {getStatusLabel(appointment.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="p-2 font-mono text-sm font-medium">
                              {appointment.hora_agendamento}
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="text-sm font-medium">
                                {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                              </div>
                              {appointment.observacoes && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {appointment.observacoes}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="text-xs">
                                {appointment.pacientes?.telefone || appointment.pacientes?.celular || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell className="p-2">
                              <Badge variant="outline" className="text-xs">
                                {appointment.pacientes?.convenio || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="text-xs">
                                {appointment.atendimentos?.nome || 'Consulta'}
                              </div>
                            </TableCell>
                            <TableCell className="p-2 text-xs">
                              {appointment.criado_por_profile?.nome || 
                               appointment.criado_por || 
                               'Recepcionista'}
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="flex items-center justify-center gap-1">
                                {onEditAppointment && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onEditAppointment(appointment)}
                                    className="h-6 w-6 p-0"
                                    title="Editar"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                )}
                                {appointment.status === 'agendado' && onConfirmAppointment && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onConfirmAppointment(appointment.id)}
                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Confirmar"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                )}
                                {appointment.status === 'agendado' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Cancelar"
                                      >
                                        <Trash2 className="h-3 w-3" />
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
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-muted-foreground mb-2">
                        Nenhum agendamento
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Não há agendamentos para esta data.
                      </p>
                      {onNewAppointment && (
                        <Button onClick={onNewAppointment} className="mt-4" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Agendamento
                        </Button>
                      )}
                    </div>
                  </div>
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