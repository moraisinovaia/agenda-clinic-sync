import { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay, parse, startOfDay, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { Doctor, AppointmentWithRelations, Atendimento } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Trash2, Plus, Edit, CheckCircle, Phone, RotateCcw } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilaEsperaForm } from '@/components/fila-espera/FilaEsperaForm';
import { FilaEsperaFormData } from '@/types/fila-espera';

interface DoctorScheduleProps {
  doctor: Doctor;
  appointments: AppointmentWithRelations[];
  blockedDates?: any[];
  isDateBlocked?: (doctorId: string, date: Date) => boolean;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
  onConfirmAppointment?: (appointmentId: string) => Promise<void>;
  onUnconfirmAppointment?: (appointmentId: string) => Promise<void>;
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onNewAppointment?: (selectedDate?: string) => void;
  initialDate?: string; // Data inicial para posicionar o calendário
  atendimentos: Atendimento[];
  adicionarFilaEspera: (data: FilaEsperaFormData) => Promise<boolean>;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
}

export function DoctorSchedule({ doctor, appointments, blockedDates = [], isDateBlocked, onCancelAppointment, onConfirmAppointment, onUnconfirmAppointment, onEditAppointment, onNewAppointment, initialDate, atendimentos, adicionarFilaEspera, searchPatientsByBirthDate }: DoctorScheduleProps) {
  // Usar initialDate se fornecida, senão usar data do primeiro agendamento do médico, senão data atual
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDate) {
      // Parse da data no formato YYYY-MM-DD para evitar problemas de timezone
      console.log('🎯 DoctorSchedule: Usando initialDate fornecida:', initialDate);
      return parse(initialDate, 'yyyy-MM-dd', new Date());
    }
    
    // Se não há initialDate, tentar usar a data do agendamento mais recente do médico
    if (appointments && appointments.length > 0) {
      const doctorAppointments = appointments.filter(apt => apt.medico_id === doctor.id);
      if (doctorAppointments.length > 0) {
        // Usar o agendamento mais recente
        const mostRecentAppointment = doctorAppointments.sort((a, b) => 
          new Date(b.data_agendamento).getTime() - new Date(a.data_agendamento).getTime()
        )[0];
        console.log('🎯 DoctorSchedule: Usando data do agendamento mais recente:', mostRecentAppointment.data_agendamento);
        return parse(mostRecentAppointment.data_agendamento, 'yyyy-MM-dd', new Date());
      }
    }
    
    console.log('🎯 DoctorSchedule: Usando data atual como fallback');
    return new Date();
  });
  
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  
  const getAppointmentsForDate = (date: Date) => {
    // Normalizar a data para evitar problemas de timezone
    const normalizedDate = startOfDay(date);
    const dateStr = format(normalizedDate, 'yyyy-MM-dd');
    
    const filtered = appointments.filter(
      appointment => 
        appointment.medico_id === doctor.id && 
        appointment.data_agendamento === dateStr &&
        appointment.status !== 'excluido' // Excluir agendamentos excluídos
    );
    
    return filtered;
  };

  // Função para verificar se uma data tem agendamentos
  const hasAppointments = (date: Date) => {
    const normalizedDate = startOfDay(date);
    const dateStr = format(normalizedDate, 'yyyy-MM-dd');
    
    // Debug detalhado
    console.log(`🔍 hasAppointments verificando data: ${dateStr}`);
    console.log(`📋 Total appointments para médico ${doctor.id}:`, appointments.filter(apt => apt.medico_id === doctor.id).length);
    console.log(`📅 Appointments para esta data:`, appointments.filter(apt => 
      apt.medico_id === doctor.id && apt.data_agendamento === dateStr
    ));
    
    const appointmentsForDate = getAppointmentsForDate(date);
    console.log(`✅ hasAppointments retornando:`, appointmentsForDate.length > 0);
    
    return appointmentsForDate.length > 0;
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
      {/* CSS customizado para destacar datas com agendamentos */}
      <style>{`
        .calendar-has-appointments {
          background-color: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
          font-weight: bold !important;
          border-radius: 6px !important;
        }
        .calendar-has-appointments:hover {
          background-color: hsl(var(--primary) / 0.9) !important;
        }
        .calendar-has-blocks {
          background-color: hsl(var(--destructive)) !important;
          color: hsl(var(--destructive-foreground)) !important;
          font-weight: bold !important;
          text-decoration: line-through !important;
          border-radius: 6px !important;
        }
        .calendar-has-blocks:hover {
          background-color: hsl(var(--destructive) / 0.9) !important;
        }
      `}</style>
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
              <div className="flex items-center gap-2">
                <Button onClick={() => onNewAppointment(format(selectedDate, 'yyyy-MM-dd'))} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Agendamento
                </Button>
                <Button variant="outline" onClick={() => setWaitlistOpen(true)}>
                  Adicionar à Fila
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-3 xl:grid-cols-4 min-h-[60vh] max-h-[600px]">
            {/* Calendário - Lado Esquerdo */}
            <div className="border-r p-3 space-y-3">
              <h3 className="font-semibold text-xs">Selecione uma data</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                defaultMonth={selectedDate} // Força navegação para o mês da data selecionada
                locale={ptBR}
                className="rounded-md border-none p-0 scale-90"
                modifiers={{
                  hasAppointments: (date) => {
                    const result = hasAppointments(date);
                    console.log(`📅 Calendar modifier hasAppointments para ${format(date, 'yyyy-MM-dd')}: ${result}`);
                    return result;
                  },
                  hasBlocks: (date) => hasBlocks(date)
                }}
                modifiersClassNames={{
                  hasAppointments: "calendar-has-appointments !bg-primary !text-primary-foreground !font-bold hover:!bg-primary/90",
                  hasBlocks: "calendar-has-blocks !bg-destructive !text-destructive-foreground !font-bold line-through hover:!bg-destructive/90"
                }}
                key={`calendar-${doctor.id}-${selectedDate.getTime()}-${appointments?.filter(apt => apt.medico_id === doctor.id)?.length || 0}`} // Force re-render with selected date
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
            <div className="lg:col-span-2 xl:col-span-3 flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <h3 className="font-semibold text-xs">
                  Agendamentos para {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
                {/* Resumo dos agendamentos da data selecionada */}
                {selectedDateAppointments.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span>
                      Consultas: {selectedDateAppointments.filter(apt => apt.atendimentos?.nome?.toLowerCase().includes('consulta') || !apt.atendimentos?.nome?.toLowerCase().includes('retorno') && !apt.atendimentos?.nome?.toLowerCase().includes('exame')).length}, 
                      Retornos: {selectedDateAppointments.filter(apt => apt.atendimentos?.nome?.toLowerCase().includes('retorno')).length}, 
                      Exames: {selectedDateAppointments.filter(apt => apt.atendimentos?.nome?.toLowerCase().includes('exame')).length}, 
                      Total: {selectedDateAppointments.length}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 w-full">
                {selectedDateAppointments.length > 0 ? (
                    <ScrollArea className="h-[450px] w-full">
                      <Table className="min-w-[900px]">
                        <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Status/Hora</TableHead>
                          <TableHead className="w-[180px]">Paciente/Idade</TableHead>
                          <TableHead className="w-[120px]">Telefone</TableHead>
                          <TableHead className="w-[100px]">Convênio</TableHead>
                          <TableHead className="w-[120px]">Tipo</TableHead>
                          <TableHead className="w-[120px]">Registrado em</TableHead>
                          <TableHead className="w-[120px]">Última alteração</TableHead>
                          <TableHead className="w-[100px] text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDateAppointments
                          .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                          .map((appointment) => (
                            <TableRow key={appointment.id} className="hover:bg-muted/20">
                              {/* Status/Hora */}
                              <TableCell className="w-[120px]">
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
                              </TableCell>
                              
                              {/* Paciente/Idade */}
                              <TableCell className="w-[180px]">
                                <div className="space-y-1">
                                  <div className="text-xs font-medium leading-tight">
                                    {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                                    {appointment.pacientes?.data_nascimento && (
                                      <span className="ml-2 text-[10px] text-muted-foreground">
                                        ({differenceInYears(new Date(), new Date(appointment.pacientes.data_nascimento))} anos)
                                      </span>
                                    )}
                                  </div>
                                  {appointment.observacoes && (
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {appointment.observacoes}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              
                              {/* Telefone */}
                              <TableCell className="w-[120px] text-[10px]">
                                {appointment.pacientes?.telefone || appointment.pacientes?.celular || 'N/A'}
                              </TableCell>
                              
                              {/* Convênio */}
                              <TableCell className="w-[100px]">
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {appointment.pacientes?.convenio || 'N/A'}
                                </Badge>
                              </TableCell>
                              
                              {/* Tipo */}
                              <TableCell className="w-[120px] text-[10px] text-muted-foreground">
                                {appointment.atendimentos?.nome || 'Consulta'}
                              </TableCell>
                              
                              {/* Registrado em */}
                              <TableCell className="w-[120px] text-[10px]">
                                <div className="space-y-1">
                                  <div>
                                    {formatInTimeZone(new Date(appointment.created_at), BRAZIL_TIMEZONE, 'dd/MM/yy HH:mm', { locale: ptBR })}
                                  </div>
                                  <div className="text-muted-foreground">
                                    por {appointment.criado_por_profile?.nome || appointment.criado_por || 'Sistema'}
                                  </div>
                                </div>
                              </TableCell>
                              
                              {/* Última alteração */}
                              <TableCell className="w-[120px] text-[10px]">
                                <div className="space-y-1">
                                  <div>
                                    {formatInTimeZone(new Date(appointment.updated_at), BRAZIL_TIMEZONE, 'dd/MM/yy HH:mm', { locale: ptBR })}
                                  </div>
                                  {appointment.alterado_por_profile?.nome && (
                                    <div className="text-muted-foreground">
                                      por {appointment.alterado_por_profile.nome}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              
                              {/* Ações */}
                              <TableCell className="w-[100px]">
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
                                  {appointment.status === 'confirmado' && onUnconfirmAppointment && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => onUnconfirmAppointment(appointment.id)}
                                      className="h-5 w-5 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      title="Desconfirmar"
                                    >
                                      <RotateCcw className="h-2.5 w-2.5" />
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
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
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
                        <Button onClick={() => onNewAppointment(format(selectedDate, 'yyyy-MM-dd'))} className="mt-4" size="sm">
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

      {/* Modal: Adicionar à Fila de Espera */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adicionar à Fila de Espera</DialogTitle>
          </DialogHeader>
          <FilaEsperaForm
            doctors={[doctor]}
            atendimentos={atendimentos.filter(a => a.medico_id === doctor.id)}
            onSubmit={adicionarFilaEspera}
            onCancel={() => setWaitlistOpen(false)}
            searchPatientsByBirthDate={searchPatientsByBirthDate}
          />
        </DialogContent>
      </Dialog>

      {/* Resumo estatístico - Versão compacta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-100 rounded">
              <CalendarIcon className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'agendado').length}
              </p>
              <p className="text-xs text-muted-foreground">Agendados</p>
            </div>
          </div>
        </Card>

        <Card className="p-2">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-green-100 rounded">
              <Clock className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'confirmado').length}
              </p>
              <p className="text-xs text-muted-foreground">Confirmados</p>
            </div>
          </div>
        </Card>

        <Card className="p-2">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-gray-100 rounded">
              <User className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'realizado').length}
              </p>
              <p className="text-xs text-muted-foreground">Realizados</p>
            </div>
          </div>
        </Card>

        <Card className="p-2">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-red-100 rounded">
              <CalendarIcon className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {appointments.filter(apt => apt.medico_id === doctor.id && apt.status === 'cancelado').length}
              </p>
              <p className="text-xs text-muted-foreground">Cancelados</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}