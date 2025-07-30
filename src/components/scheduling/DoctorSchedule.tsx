import { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
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
          <div className="grid lg:grid-cols-3 h-[400px]">
            {/* Calendário - Lado Esquerdo */}
            <div className="border-r p-3 space-y-3">
              <h3 className="font-semibold text-xs">Selecione uma data</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="rounded-md border-none p-0 scale-90"
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
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded"></div>
                  <span>Com agendamentos</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-destructive rounded"></div>
                  <span>Bloqueados</span>
                </div>
              </div>
            </div>

            {/* Tabela de Agendamentos - Lado Direito */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <h3 className="font-semibold text-xs">
                  Agendamentos para {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
              </div>
              
              <div className="flex-1 relative w-full">
                {selectedDateAppointments.length > 0 ? (
                  <div className="w-full overflow-hidden">
                    {/* Header fixo da tabela */}
                    <div className="border-b bg-muted/50">
                      <div className="min-w-[700px] px-2">
                        <div className="grid grid-cols-7 gap-2 py-2">
                          <div className="text-xs font-medium text-muted-foreground">Status/Hora</div>
                          <div className="text-xs font-medium text-muted-foreground">Paciente</div>
                          <div className="text-xs font-medium text-muted-foreground">Telefone</div>
                          <div className="text-xs font-medium text-muted-foreground">Convênio</div>
                          <div className="text-xs font-medium text-muted-foreground">Tipo</div>
                          <div className="text-xs font-medium text-muted-foreground">Agendado por</div>
                          <div className="text-xs font-medium text-muted-foreground text-center">Ações</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Área de scroll horizontal com conteúdo */}
                    <ScrollArea className="h-[250px] w-full">
                      <div className="min-w-[700px] px-2">
                        {selectedDateAppointments
                          .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                          .map((appointment) => (
                            <div key={appointment.id} className="grid grid-cols-7 gap-2 py-3 border-b border-border/50 hover:bg-muted/20">
                              {/* Status/Hora */}
                              <div className="flex flex-col gap-1">
                                <Badge 
                                  className={`text-[10px] px-1 py-0 w-fit ${getStatusColor(appointment.status)}`}
                                >
                                  {getStatusLabel(appointment.status)}
                                </Badge>
                                <div className="font-mono text-[10px] font-medium">
                                  {appointment.hora_agendamento}
                                </div>
                              </div>
                              
                              {/* Paciente */}
                              <div className="space-y-1">
                                <div className="text-xs font-medium leading-tight">
                                  {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                                </div>
                                {appointment.observacoes && (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {appointment.observacoes}
                                  </div>
                                )}
                              </div>
                              
                              {/* Telefone */}
                              <div className="text-[10px]">
                                {appointment.pacientes?.telefone || appointment.pacientes?.celular || 'N/A'}
                              </div>
                              
                              {/* Convênio */}
                              <div>
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {appointment.pacientes?.convenio || 'N/A'}
                                </Badge>
                              </div>
                              
                              {/* Tipo */}
                              <div className="text-[10px] text-muted-foreground">
                                {appointment.atendimentos?.nome || 'Consulta'}
                              </div>
                              
                              {/* Agendado por */}
                              <div className="text-[10px]">
                                {appointment.criado_por_profile?.nome || 
                                 appointment.criado_por || 
                                 'Recepcionista'}
                              </div>
                              
                              {/* Ações */}
                              <div className="flex items-center justify-center gap-1">
                                {onEditAppointment && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onEditAppointment(appointment)}
                                    className="h-5 w-5 p-0"
                                    title="Editar"
                                  >
                                    <Edit className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                                {appointment.status === 'agendado' && onConfirmAppointment && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onConfirmAppointment(appointment.id)}
                                    className="h-5 w-5 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Confirmar"
                                  >
                                    <CheckCircle className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                                {appointment.status === 'agendado' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="h-5 w-5 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Cancelar"
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
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
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