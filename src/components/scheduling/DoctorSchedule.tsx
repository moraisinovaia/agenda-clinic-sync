import { useState, useMemo, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay, parse, startOfDay, differenceInYears, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { cn } from '@/lib/utils';
import { Doctor, AppointmentWithRelations, Atendimento } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Trash2, Plus, Edit, CheckCircle, Phone, RotateCcw, Printer, Settings, AlertTriangle, Loader2, Check, ChevronsUpDown } from 'lucide-react';
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
import { RelatorioAgenda } from './RelatorioAgenda';
import { FileText } from 'lucide-react';
import { DoctorScheduleGenerator } from './DoctorScheduleGenerator';
import { toast } from 'sonner';

interface DoctorScheduleProps {
  doctor: Doctor;
  doctors?: Doctor[];
  onDoctorChange?: (doctorId: string) => void;
  appointments: AppointmentWithRelations[];
  blockedDates?: any[];
  isDateBlocked?: (doctorId: string, date: Date) => boolean;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
  onDeleteAppointment?: (appointmentId: string) => Promise<void>;
  onConfirmAppointment?: (appointmentId: string) => Promise<void>;
  onUnconfirmAppointment?: (appointmentId: string) => Promise<void>;
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onNewAppointment?: (selectedDate?: string) => void;
  onNewAppointmentWithTime?: (date: string, time: string) => void;
  initialDate?: string;
  atendimentos: Atendimento[];
  adicionarFilaEspera: (data: FilaEsperaFormData) => Promise<boolean>;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
  emptySlots?: any[];
}

// Função auxiliar para validar e formatar datas com segurança
const safeFormatDate = (dateValue: any, formatStr: string = 'dd/MM/yy HH:mm'): string => {
  if (!dateValue) return 'N/A';
  
  try {
    let dateObj: Date;
    
    if (typeof dateValue === 'string') {
      // Tenta parseISO primeiro (formato ISO 8601)
      dateObj = parseISO(dateValue);
      if (!isValid(dateObj)) {
        // Fallback para new Date
        dateObj = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return 'N/A';
    }
    
    if (!isValid(dateObj)) {
      console.warn('⚠️ Data inválida detectada:', dateValue);
      return 'N/A';
    }
    
    return formatInTimeZone(dateObj, BRAZIL_TIMEZONE, formatStr, { locale: ptBR });
  } catch (error) {
    console.error('❌ Erro ao formatar data:', error, dateValue);
    return 'N/A';
  }
};

// Função para formatar data sem conversão de timezone
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// Função para calcular idade com segurança
const safeCalculateAge = (birthDate: any): string | null => {
  if (!birthDate) return null;
  
  try {
    let dateObj: Date;
    
    if (typeof birthDate === 'string') {
      // Parse ISO ou formato padrão
      dateObj = parseISO(birthDate);
      if (!isValid(dateObj)) {
        dateObj = new Date(birthDate);
      }
    } else if (birthDate instanceof Date) {
      dateObj = birthDate;
    } else {
      return null;
    }
    
    if (!isValid(dateObj)) {
      console.warn('⚠️ Data de nascimento inválida:', birthDate);
      return null;
    }
    
    const age = differenceInYears(new Date(), dateObj);
    return age >= 0 ? `${age}a` : null;
  } catch (error) {
    console.error('❌ Erro ao calcular idade:', error, birthDate);
    return null;
  }
};

export function DoctorSchedule({ 
  doctor, 
  doctors = [],
  onDoctorChange,
  appointments, 
  blockedDates = [], 
  isDateBlocked, 
  onCancelAppointment, 
  onDeleteAppointment, 
  onConfirmAppointment, 
  onUnconfirmAppointment, 
  onEditAppointment, 
  onNewAppointment, 
  onNewAppointmentWithTime, 
  initialDate, 
  atendimentos, 
  adicionarFilaEspera, 
  searchPatientsByBirthDate, 
  emptySlots = [] 
}: DoctorScheduleProps) {
  
  // Estado para data selecionada com validação segura
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    try {
      if (initialDate) {
        console.log('🎯 Usando initialDate:', initialDate);
        const parsed = parse(initialDate, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) return parsed;
      }
      
      if (appointments && appointments.length > 0) {
        const doctorAppointments = appointments.filter(apt => apt.medico_id === doctor.id);
        if (doctorAppointments.length > 0) {
          const mostRecent = doctorAppointments.sort((a, b) => 
            new Date(b.data_agendamento).getTime() - new Date(a.data_agendamento).getTime()
          )[0];
          
          const parsed = parse(mostRecent.data_agendamento, 'yyyy-MM-dd', new Date());
          if (isValid(parsed)) {
            console.log('🎯 Usando data do agendamento:', mostRecent.data_agendamento);
            return parsed;
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar data:', error);
    }
    
    console.log('🎯 Usando data atual');
    return new Date();
  });
  
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'schedule' | 'report'>('schedule');
  const [doctorSelectOpen, setDoctorSelectOpen] = useState(false);
  const [scheduleGenOpen, setScheduleGenOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeBloqueio, setActiveBloqueio] = useState<{motivo: string, data_inicio: string, data_fim: string} | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUnconfirming, setIsUnconfirming] = useState(false);
  
  const getAppointmentsForDate = (date: Date) => {
    try {
      const normalizedDate = startOfDay(date);
      const dateStr = format(normalizedDate, 'yyyy-MM-dd');
      
      // Debug: Mostrar informações sobre os agendamentos carregados
      const totalAppointments = appointments.length;
      const doctorAppointments = appointments.filter(apt => apt.medico_id === doctor.id);
      const filteredAppointments = appointments.filter(
        appointment => 
          appointment.medico_id === doctor.id && 
          appointment.data_agendamento === dateStr &&
          appointment.status !== 'excluido'
      );
      
      console.log(`📅 Buscando agendamentos para ${dateStr}:`, {
        totalCarregados: totalAppointments,
        doMedico: doctorAppointments.length,
        nessaData: filteredAppointments.length,
        datas: [...new Set(appointments.map(a => a.data_agendamento))].sort()
      });
      
      return filteredAppointments;
    } catch (error) {
      console.error('❌ Erro ao buscar agendamentos:', error);
      return [];
    }
  };

  const hasAppointments = (date: Date) => {
    try {
      const appointmentsForDate = getAppointmentsForDate(date);
      return appointmentsForDate.length > 0;
    } catch (error) {
      console.error('❌ Erro em hasAppointments:', error);
      return false;
    }
  };

  const hasBlocks = (date: Date) => {
    try {
      if (isDateBlocked) {
        return isDateBlocked(doctor.id, date);
      }
      const dateStr = date.toISOString().split('T')[0];
      return blockedDates.some(blocked => 
        blocked.medico_id === doctor.id &&
        blocked.status === 'ativo' &&
        dateStr >= blocked.data_inicio &&
        dateStr <= blocked.data_fim
      );
    } catch (error) {
      console.error('❌ Erro em hasBlocks:', error);
      return false;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'cancelado_bloqueio':
        return 'bg-orange-500 text-white hover:bg-orange-600';
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
      case 'cancelado_bloqueio':
        return 'Bloqueado';
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

  // Buscar bloqueios ativos para a data selecionada
  useEffect(() => {
    const checkBloqueio = async () => {
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const bloqueio = blockedDates.find(blocked => 
          blocked.medico_id === doctor.id &&
          blocked.status === 'ativo' &&
          dateStr >= blocked.data_inicio &&
          dateStr <= blocked.data_fim
        );
        setActiveBloqueio(bloqueio || null);
      } catch (error) {
        console.error('❌ Erro ao verificar bloqueio:', error);
        setActiveBloqueio(null);
      }
    };
    checkBloqueio();
  }, [selectedDate, doctor.id, blockedDates]);

  const selectedDateAppointments = getAppointmentsForDate(selectedDate);
  const activeAppointments = selectedDateAppointments.filter(
    apt => apt.status === 'agendado' || apt.status === 'confirmado' || apt.status === 'cancelado_bloqueio'
  );

  const emptyTimeSlots = useMemo(() => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const filtered = (emptySlots || []).filter(
        slot => slot.medico_id === doctor.id && 
                slot.data === dateStr &&
                slot.status === 'disponivel'
      );
      console.log(`📊 Horários vazios para ${dateStr}:`, filtered.length);
      return filtered;
    } catch (error) {
      console.error('❌ Erro ao filtrar horários vazios:', error);
      return [];
    }
  }, [emptySlots, doctor.id, selectedDate]);

  const allSlots = useMemo(() => {
    try {
      return [
        ...emptyTimeSlots.map(slot => ({
          type: 'empty' as const,
          hora: slot.hora,
          data: slot
        })),
        ...selectedDateAppointments.map(apt => ({
          type: 'appointment' as const,
          hora: apt.hora_agendamento,
          data: apt
        }))
      ].sort((a, b) => a.hora.localeCompare(b.hora));
    } catch (error) {
      console.error('❌ Erro ao combinar slots:', error);
      return [];
    }
  }, [emptyTimeSlots, selectedDateAppointments]);

  const handlePrint = () => {
    window.print();
  };

  // Se estiver no modo relatório, renderizar apenas o RelatorioAgenda
  if (viewMode === 'report') {
    return (
      <RelatorioAgenda
        doctors={[doctor]}
        appointments={appointments.filter(apt => apt.medico_id === doctor.id)}
        onBack={() => setViewMode('schedule')}
        preSelectedDoctorId={doctor.id}
        preSelectedDate={format(selectedDate, 'yyyy-MM-dd')}
      />
    );
  }

  return (
    <div className="space-y-6">
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

        @media print {
          body { font-size: 9px; line-height: 1.2; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:text-\\[9px\\] { font-size: 9px !important; }
          .print\\:text-\\[10px\\] { font-size: 10px !important; }
          .print\\:text-\\[7px\\] { font-size: 7px !important; }
          @page { size: A4 portrait; margin: 10mm; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>

      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
            <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Agenda - 
                {doctors.length > 0 && onDoctorChange ? (
                  <Popover open={doctorSelectOpen} onOpenChange={setDoctorSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" className="h-auto p-0 font-semibold text-lg hover:bg-muted/50 px-2">
                        {doctor.nome}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 bg-background z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar médico..." />
                        <CommandList>
                          <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                          <CommandGroup>
                            {doctors.map(d => (
                              <CommandItem
                                key={d.id}
                                value={`${d.nome} ${d.especialidade}`}
                                onSelect={() => {
                                  onDoctorChange?.(d.id);
                                  setDoctorSelectOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", doctor.id === d.id ? "opacity-100" : "opacity-0")} />
                                {d.nome} - {d.especialidade}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span>{doctor.nome}</span>
                )}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {doctor.especialidade}
              </div>
            </div>
            {onNewAppointment && (
              <div className="print:hidden">
                <p className="text-xs text-muted-foreground mb-2">
                  💡 Horários livres são opcionais - você pode agendar em qualquer horário disponível
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={() => setViewMode('report')} variant="outline" size="sm">
                    <FileText className="h-4 w-4" />
                    Relatório
                  </Button>
                  <Button onClick={() => setScheduleGenOpen(true)} variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                    Gerenciar Horários ({emptySlots.length})
                  </Button>
                  <Button onClick={() => onNewAppointment(format(selectedDate, 'yyyy-MM-dd'))} size="sm">
                    <Plus className="h-4 w-4" />
                    Novo Agendamento
                  </Button>
                  <Button variant="outline" onClick={() => setWaitlistOpen(true)} size="sm">
                    Fila de Espera
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-3 xl:grid-cols-4 min-h-[60vh] max-h-[600px]">
            {/* Calendário */}
            <div className="border-r p-3 space-y-3 print:hidden">
              <h3 className="font-semibold text-xs">Selecione uma data</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                defaultMonth={selectedDate}
                locale={ptBR}
                className="rounded-md border-none p-0 scale-90 notranslate"
                modifiers={{
                  hasAppointments: (date) => hasAppointments(date),
                  hasBlocks: (date) => hasBlocks(date)
                }}
                modifiersClassNames={{
                  hasAppointments: "calendar-has-appointments !bg-primary !text-primary-foreground !font-bold hover:!bg-primary/90",
                  hasBlocks: "calendar-has-blocks !bg-destructive !text-destructive-foreground !font-bold line-through hover:!bg-destructive/90"
                }}
                key={`calendar-${doctor.id}-${selectedDate.getTime()}`}
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

            {/* Tabela de Agendamentos */}
            <div className="lg:col-span-2 xl:col-span-3 flex flex-col">
              <div className="hidden print:block p-4 border-b mb-4">
                <h1 className="text-xl font-bold mb-2">{doctor.nome}</h1>
                <p className="text-sm text-muted-foreground mb-1">{doctor.especialidade}</p>
                <p className="text-base font-semibold mb-2">
                  Agendamentos para {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                {activeAppointments.length > 0 && (
                  <div className="text-xs">
                    Total: {activeAppointments.length}
                  </div>
                )}
              </div>
              
              <div className="p-3 border-b bg-muted/30 print:hidden">
                <h3 className="font-semibold text-base">
                  Agendamentos para {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
                {selectedDateAppointments.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span>Total: {activeAppointments.length}</span>
                  </div>
                )}
              </div>
              
              {/* Banner de Bloqueio Ativo */}
              {activeBloqueio && (
                <div className="mx-3 mt-3 mb-0 p-4 bg-orange-50 border-l-4 border-l-orange-500 rounded">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-orange-900 mb-1">
                        🚫 Agenda Bloqueada
                      </h4>
                      <p className="text-sm text-orange-800 mb-2">
                        <strong>Motivo:</strong> {activeBloqueio.motivo}
                      </p>
                      <p className="text-xs text-orange-700">
                        Período bloqueado: {formatDateForDisplay(activeBloqueio.data_inicio)} até {formatDateForDisplay(activeBloqueio.data_fim)}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Os agendamentos abaixo foram cancelados automaticamente pelo sistema e serão restaurados quando a agenda for reaberta.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex-1 w-full">
                {allSlots.length > 0 ? (
                  <ScrollArea className="h-[450px] w-full">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px] print:text-[9px]">Status/Hora</TableHead>
                          <TableHead className="w-[180px] print:text-[9px]">Paciente/Idade</TableHead>
                          <TableHead className="w-[120px] print:text-[9px]">Telefone</TableHead>
                          <TableHead className="w-[100px] print:text-[9px]">Convênio</TableHead>
                          <TableHead className="w-[120px] print:text-[9px]">Tipo</TableHead>
                          <TableHead className="w-[120px] print:text-[9px]">Registrado em</TableHead>
                          <TableHead className="w-[120px] print:text-[9px]">Última alteração</TableHead>
                          <TableHead className="w-[100px] text-center print:hidden">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allSlots.map((slot, index) => 
                          slot.type === 'empty' ? (
                            <TableRow 
                              key={`empty-${index}`}
                              className="hover:bg-blue-50 cursor-pointer transition-colors"
                              onDoubleClick={() => onNewAppointmentWithTime?.(
                                format(selectedDate, 'yyyy-MM-dd'),
                                slot.hora
                              )}
                              title="Duplo clique para agendar neste horário"
                            >
                              <TableCell colSpan={8} className="text-center py-3">
                                <div className="flex items-center justify-center gap-3 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-mono font-semibold">{slot.hora}</span>
                                  <Badge variant="outline" className="text-xs bg-blue-50">
                                    Horário Vago - Duplo clique para agendar
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (() => {
                            const appointment = slot.data;
                            const patientAge = safeCalculateAge(appointment.pacientes?.data_nascimento);
                            
                            return (
                            <TableRow key={appointment.id} className="hover:bg-muted/20">
                              <TableCell className="w-[120px] py-1 px-2 print:text-[9px]">
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-[9px] px-1 py-0 w-fit leading-none ${getStatusColor(appointment.status)}`}>
                                    {getStatusLabel(appointment.status)}
                                  </Badge>
                                  <div className="font-mono text-[10px] print:text-[10px] font-medium leading-none">
                                    {appointment.hora_agendamento}
                                  </div>
                                </div>
                              </TableCell>
                              
                              <TableCell className="w-[180px] py-1 px-2 print:text-[9px]">
                                <div className="leading-none">
                                  <div className="text-[10px] font-medium leading-none">
                                    {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                                    {patientAge && (
                                      <span className="ml-1 text-[9px] text-muted-foreground">
                                        ({patientAge})
                                      </span>
                                    )}
                                  </div>
                                  {appointment.observacoes && (
                                    <div className="text-[9px] text-muted-foreground truncate mt-0.5 leading-none">
                                      {appointment.observacoes}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              
                              <TableCell className="w-[120px] text-[9px] py-1 px-2 leading-none print:text-[7px]">
                                {appointment.pacientes?.telefone || appointment.pacientes?.celular || 'N/A'}
                              </TableCell>
                              
                              <TableCell className="w-[100px] py-1 px-2 print:text-[7px]">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 leading-none print:text-[7px]">
                                  {appointment.pacientes?.convenio || 'N/A'}
                                </Badge>
                              </TableCell>
                              
                              <TableCell className="w-[120px] text-[9px] text-muted-foreground py-1 px-2 leading-none print:text-[7px]">
                                {appointment.atendimentos?.nome || 'Consulta'}
                              </TableCell>
                              
                              <TableCell className="w-[120px] text-[9px] py-1 px-2 leading-none print:text-[7px]">
                                <div className="leading-none">
                                  <div className="leading-none">
                                    {safeFormatDate(appointment.created_at)}
                                  </div>
                                  <div className="text-muted-foreground text-[8px] leading-none mt-0.5">
                                    {appointment.criado_por_profile?.nome?.split(' ')[0] || appointment.criado_por?.split(' ')[0] || 'Sistema'}
                                  </div>
                                </div>
                              </TableCell>
                              
                              <TableCell className="w-[120px] text-[9px] py-1 px-2 leading-none print:text-[7px]">
                                <div className="leading-none">
                                  <div className="leading-none">
                                    {safeFormatDate(appointment.updated_at)}
                                  </div>
                                  {appointment.alterado_por_profile?.nome && (
                                    <div className="text-muted-foreground text-[8px] leading-none mt-0.5">
                                      {appointment.alterado_por_profile.nome.split(' ')[0]}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              
                              <TableCell className="w-[100px] py-1 px-2 print:hidden">
                                <div className="flex items-center justify-center gap-0.5">
                                  {onEditAppointment && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => onEditAppointment(appointment)}
                                      className="h-4 w-4 p-0"
                                      title="Editar"
                                    >
                                      <Edit className="h-2 w-2" />
                                    </Button>
                                  )}
                                  {appointment.status === 'agendado' && onConfirmAppointment && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      disabled={isConfirming}
                                      onClick={async () => {
                                        setIsConfirming(true);
                                        try {
                                          await onConfirmAppointment(appointment.id);
                                        } finally {
                                          setIsConfirming(false);
                                        }
                                      }}
                                      className="h-4 w-4 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      title="Confirmar"
                                    >
                                      {isConfirming ? (
                                        <Loader2 className="h-2 w-2 animate-spin" />
                                      ) : (
                                        <CheckCircle className="h-2 w-2" />
                                      )}
                                    </Button>
                                  )}
                                  {appointment.status === 'confirmado' && onUnconfirmAppointment && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      disabled={isUnconfirming}
                                      onClick={async () => {
                                        setIsUnconfirming(true);
                                        try {
                                          await onUnconfirmAppointment(appointment.id);
                                        } finally {
                                          setIsUnconfirming(false);
                                        }
                                      }}
                                      className="h-4 w-4 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      title="Desconfirmar"
                                    >
                                      {isUnconfirming ? (
                                        <Loader2 className="h-2 w-2 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-2 w-2" />
                                      )}
                                    </Button>
                                  )}
                                  {appointment.status === 'agendado' && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-4 w-4 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          title="Cancelar"
                                        >
                                          <Trash2 className="h-2 w-2" />
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
                                            disabled={isCancelling}
                                            onClick={async () => {
                                              setIsCancelling(true);
                                              try {
                                                await onCancelAppointment(appointment.id);
                                              } finally {
                                                setIsCancelling(false);
                                              }
                                            }}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            {isCancelling ? (
                                              <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Cancelando...
                                              </>
                                            ) : (
                                              'Sim, cancelar'
                                            )}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                  {appointment.status === 'cancelado' && onDeleteAppointment && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-4 w-4 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          title="Excluir"
                                        >
                                          <Trash2 className="h-2 w-2" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Tem certeza que deseja excluir permanentemente este agendamento cancelado para {format(selectedDate, "dd/MM/yyyy")} às {appointment.hora_agendamento}? 
                                            Esta ação não pode ser desfeita.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => onDeleteAppointment(appointment.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Sim, excluir
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            );
                          })()
                        )}
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

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 print:hidden">
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

      {/* Modal de Configuração de Horários */}
      {/* Modal Unificado de Gerenciamento de Horários */}
      <DoctorScheduleGenerator
        open={scheduleGenOpen}
        onOpenChange={setScheduleGenOpen}
        doctors={[doctor]}
        preSelectedDoctorId={doctor.id}
        emptySlots={emptySlots}
        onSuccess={() => {
          toast.success('Operação realizada com sucesso!');
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    </div>
  );
}
