import { useState } from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Doctor, AppointmentWithRelations, Atendimento } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Calendar as CalendarIcon, Clock, User, Trash2, Plus, Edit, CheckCircle, RotateCcw } from 'lucide-react';
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
  getBlockingReason?: (doctorId: string, date: Date) => { type: string; message: string } | null;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
  onConfirmAppointment?: (appointmentId: string) => Promise<void>;
  onUnconfirmAppointment?: (appointmentId: string) => Promise<void>;
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onNewAppointment?: (selectedDate?: string) => void;
  initialDate?: string;
  atendimentos: Atendimento[];
  adicionarFilaEspera: (data: FilaEsperaFormData) => Promise<boolean>;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
  onForceRefresh?: () => void;
}

export function DoctorSchedule({
  doctor,
  appointments,
  blockedDates = [],
  isDateBlocked,
  onCancelAppointment,
  onConfirmAppointment,
  onUnconfirmAppointment,
  onEditAppointment,
  onNewAppointment,
  initialDate,
  atendimentos,
  adicionarFilaEspera,
  searchPatientsByBirthDate
}: DoctorScheduleProps) {
  // Parse initial date or use current date
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDate) {
      return parse(initialDate, 'yyyy-MM-dd', new Date());
    }
    return new Date();
  });
  
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  // Ultra-robust doctor ID comparison function with detailed debugging
  const isDoctorMatch = (appointmentDoctorId: any, targetDoctorId: any): boolean => {
    if (!appointmentDoctorId || !targetDoctorId) return false;
    
    // Direct comparison
    if (appointmentDoctorId === targetDoctorId) return true;
    
    // String comparison
    const strAppointment = String(appointmentDoctorId);
    const strTarget = String(targetDoctorId);
    if (strAppointment === strTarget) return true;
    
    // Normalized comparison (trim + lowercase)
    const normalizedAppointment = strAppointment.trim().toLowerCase();
    const normalizedTarget = strTarget.trim().toLowerCase();
    if (normalizedAppointment === normalizedTarget) return true;
    
    // Ultra-robust comparisons for edge cases
    // Remove all whitespace and special chars, compare
    const cleanAppointment = strAppointment.replace(/[\s\-\_]/g, '').toLowerCase();
    const cleanTarget = strTarget.replace(/[\s\-\_]/g, '').toLowerCase();
    if (cleanAppointment === cleanTarget) return true;
    
    // Substring match (in case of encoding issues)
    if (strAppointment.includes(strTarget) || strTarget.includes(strAppointment)) {
      const lengthDiff = Math.abs(strAppointment.length - strTarget.length);
      if (lengthDiff <= 2) return true; // Allow small differences for encoding issues
    }
    
    // Last resort: character-by-character comparison ignoring case and common substitutions
    if (strAppointment.length === strTarget.length) {
      let matches = 0;
      const minLength = Math.min(strAppointment.length, strTarget.length);
      
      for (let i = 0; i < minLength; i++) {
        const charA = strAppointment.charAt(i).toLowerCase();
        const charT = strTarget.charAt(i).toLowerCase();
        if (charA === charT || 
            (charA === '0' && charT === 'o') || 
            (charA === 'o' && charT === '0') ||
            (charA === '1' && charT === 'l') || 
            (charA === 'l' && charT === '1')) {
          matches++;
        }
      }
      
      // If 95% of characters match, consider it a match
      if (matches / minLength >= 0.95) return true;
    }
    
    return false;
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = (date: Date): AppointmentWithRelations[] => {
    const dateStr = format(date, 'yyyy-MM-dd');

    console.log('🗓️ [DOCTOR-SCHEDULE] Buscando agendamentos para:', {
      selectedDate: date.toISOString(),
      dateStr,
      doctorId: doctor.id,
      doctorName: doctor.nome,
      totalAppointments: appointments.length
    });

    const filteredAppointments = appointments.filter(apt => {
      if (!apt.data_agendamento) return false;
      
      // Converte a data_agendamento para Date e formata igual à dateStr, 
      // evitando problemas de fuso horário ou string mal formatada
      const aptDateStr = format(new Date(apt.data_agendamento), 'yyyy-MM-dd');
      const dateMatch = aptDateStr === dateStr;

      // Força conversão para string e trim, evitando diferenças de tipo/espaço
      const doctorMatch = String(apt.medico_id).trim() === String(doctor.id).trim();

      console.log('🔍 [DOCTOR-SCHEDULE] Verificando agendamento:', {
        appointmentId: apt.id,
        aptDataOriginal: apt.data_agendamento,
        aptDateStr,
        targetDateStr: dateStr,
        dateMatch,
        aptMedicoId: apt.medico_id,
        targetDoctorId: doctor.id,
        doctorMatch,
        finalMatch: dateMatch && doctorMatch,
        paciente: apt.pacientes?.nome_completo
      });

      return dateMatch && doctorMatch;
    });

    console.log('🗓️ [DOCTOR-SCHEDULE] Resultado final:', {
      dateStr,
      doctorId: doctor.id,
      totalFiltered: filteredAppointments.length,
      agendamentos: filteredAppointments.map(apt => ({
        id: apt.id,
        data: apt.data_agendamento,
        hora: apt.hora_agendamento,
        paciente: apt.pacientes?.nome_completo
      }))
    });

    return filteredAppointments;
  };

  // Check if a date has appointments
  const hasAppointments = (date: Date): boolean => {
    return getAppointmentsForDate(date).length > 0;
  };

  // Check if date is blocked
  const hasBlocks = (date: Date): boolean => {
    if (isDateBlocked) {
      return isDateBlocked(doctor.id, date);
    }
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => 
      blocked.medico_id === doctor.id &&
      blocked.status === 'ativo' &&
      dateStr >= blocked.data_inicio &&
      dateStr <= blocked.data_fim
    );
  };

  // Status styling helpers
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'agendado': return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'confirmado': return 'bg-green-500 text-white hover:bg-green-600';
      case 'realizado': return 'bg-gray-500 text-white hover:bg-gray-600';
      case 'cancelado': return 'bg-red-500 text-white hover:bg-red-600';
      default: return 'bg-gray-400 text-white hover:bg-gray-500';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'agendado': return 'Agendado';
      case 'confirmado': return 'Confirmado';
      case 'realizado': return 'Realizado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  // Get appointments for selected date
  const selectedDateAppointments = getAppointmentsForDate(selectedDate);

  // Calculate statistics using robust comparison
  const getAppointmentsByStatus = (status: string): number => {
    return appointments.filter(apt => 
      apt.status === status && isDoctorMatch(apt.medico_id, doctor.id)
    ).length;
  };

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
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => onNewAppointment(format(selectedDate, 'yyyy-MM-dd'))}
                  className="flex items-center gap-2"
                >
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
          <div className="grid lg:grid-cols-3 h-[400px]">
            {/* Calendar - Left Side */}
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

            {/* Appointments Table - Right Side */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <h3 className="font-semibold text-xs">
                  Agendamentos para {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
              </div>
              
              <div className="flex-1 w-full">
                {selectedDateAppointments.length > 0 ? (
                  <ScrollArea className="h-[300px] w-full">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Status/Hora</TableHead>
                          <TableHead className="w-[200px]">Paciente</TableHead>
                          <TableHead className="w-[120px]">Telefone</TableHead>
                          <TableHead className="w-[100px]">Convênio</TableHead>
                          <TableHead className="w-[120px]">Tipo</TableHead>
                          <TableHead className="w-[140px]">Agendado por</TableHead>
                          <TableHead className="w-[100px] text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDateAppointments
                          .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                          .map((appointment) => (
                            <TableRow key={appointment.id} className="hover:bg-muted/20">
                              {/* Status/Time */}
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
                              
                              {/* Patient */}
                              <TableCell className="w-[200px]">
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
                              </TableCell>
                              
                              {/* Phone */}
                              <TableCell className="w-[120px] text-[10px]">
                                {appointment.pacientes?.telefone || appointment.pacientes?.celular || 'N/A'}
                              </TableCell>
                              
                              {/* Insurance */}
                              <TableCell className="w-[100px]">
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {appointment.pacientes?.convenio || 'N/A'}
                                </Badge>
                              </TableCell>
                              
                              {/* Type */}
                              <TableCell className="w-[120px] text-[10px] text-muted-foreground">
                                {appointment.atendimentos?.nome || 'Consulta'}
                              </TableCell>
                              
                              {/* Created by */}
                              <TableCell className="w-[140px] text-[10px]">
                                {appointment.criado_por_profile?.nome || 
                                 appointment.criado_por || 
                                 'Recepcionista'}
                              </TableCell>
                              
                              {/* Actions */}
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
                      <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-semibold text-gray-900">
                        Nenhum agendamento
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Não há agendamentos para esta data.
                      </p>
                      {onNewAppointment && (
                        <div className="mt-6">
                          <Button onClick={() => onNewAppointment(format(selectedDate, 'yyyy-MM-dd'))}>
                            <Plus className="h-4 w-4 mr-2" />
                            Criar novo agendamento
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {getAppointmentsByStatus('agendado')}
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
                {getAppointmentsByStatus('confirmado')}
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
                {getAppointmentsByStatus('realizado')}
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
                {getAppointmentsByStatus('cancelado')}
              </p>
              <p className="text-sm text-muted-foreground">Cancelados</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Waitlist Dialog */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Adicionar à Fila de Espera</DialogTitle>
          </DialogHeader>
          <FilaEsperaForm
            doctors={[doctor]}
            atendimentos={atendimentos}
            onSubmit={async (data) => {
              const success = await adicionarFilaEspera(data);
              if (success) {
                setWaitlistOpen(false);
              }
              return success;
            }}
            onCancel={() => setWaitlistOpen(false)}
            searchPatientsByBirthDate={searchPatientsByBirthDate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}