import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, User, AlertCircle, Trash2, RotateCcw, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Doctor, Atendimento, SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { PatientDataFormFixed } from './PatientDataFormFixed';
import { AppointmentDataForm } from './AppointmentDataForm';
import { useSimpleSchedulingForm } from '@/hooks/useSimpleSchedulingForm';
import { ConflictConfirmationModal } from './ConflictConfirmationModal';
import { useToast } from '@/hooks/use-toast';
import { MultipleSchedulingModal } from './MultipleSchedulingModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilaEsperaForm } from '@/components/fila-espera/FilaEsperaForm';
import { FilaEsperaFormData } from '@/types/fila-espera';
import { MultipleAppointmentData } from '@/types/multiple-appointments';

interface SimpleSchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  appointments: AppointmentWithRelations[];
  blockedDates?: any[];
  isDateBlocked?: (doctorId: string, date: Date) => boolean;
  onSubmit: (data: SchedulingFormData) => Promise<void>;
  onSubmitWithForce?: (data: SchedulingFormData) => Promise<void>;
  onCancel: () => void;
  getAtendimentosByDoctor: (doctorId: string) => Atendimento[];
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
  editingAppointment?: AppointmentWithRelations;
  preSelectedDoctor?: string;
  preSelectedDate?: string;
  adicionarFilaEspera: (data: FilaEsperaFormData) => Promise<boolean>;
  onMultipleSuccess?: (data: MultipleAppointmentData) => void;
  onFillLastPatient?: (fn: () => void) => void;
  onCancelAppointment?: (appointmentId: string) => Promise<void>;
  onDeleteAppointment?: (appointmentId: string) => Promise<void>;
  onConfirmAppointment?: (appointmentId: string) => Promise<void>;
  onUnconfirmAppointment?: (appointmentId: string) => Promise<void>;
}


export function SimpleSchedulingForm({ 
  doctors, 
  atendimentos, 
  appointments,
  blockedDates = [],
  isDateBlocked,
  onSubmit,
  onSubmitWithForce,
  onCancel,
  getAtendimentosByDoctor,
  searchPatientsByBirthDate,
  editingAppointment,
  preSelectedDoctor,
  preSelectedDate,
  adicionarFilaEspera,
  onMultipleSuccess,
  onFillLastPatient,
  onCancelAppointment,
  onDeleteAppointment,
  onConfirmAppointment,
  onUnconfirmAppointment
}: SimpleSchedulingFormProps) {
  // Preparar dados iniciais para edição
  const initialEditData = editingAppointment ? {
    nomeCompleto: editingAppointment.pacientes?.nome_completo || '',
    dataNascimento: editingAppointment.pacientes?.data_nascimento || '',
    convenio: editingAppointment.pacientes?.convenio || '',
    telefone: editingAppointment.pacientes?.telefone || '',
    celular: editingAppointment.pacientes?.celular || '',
    medicoId: editingAppointment.medico_id,
    atendimentoId: editingAppointment.atendimento_id,
    dataAgendamento: editingAppointment.data_agendamento,
    horaAgendamento: editingAppointment.hora_agendamento,
    observacoes: editingAppointment.observacoes || '',
  } : undefined;

  const { formData, setFormData, loading, error, handleSubmit } = useSimpleSchedulingForm({
    initialData: initialEditData,
    preSelectedDoctor,
    preSelectedDate
  });
  
  const { toast } = useToast();
  // Estados para modal de conflito
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [conflictDetails, setConflictDetails] = useState<any>(null);
  const [timeConflictError, setTimeConflictError] = useState<string | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [multipleOpen, setMultipleOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);
  
  // ✅ Memoizar handleSubmit com detecção de conflito
  const memoizedHandleSubmit = useCallback(async (e: React.FormEvent) => {
    try {
      await handleSubmit(e, onSubmit);
    } catch (error: any) {
      console.log('🔍 Erro capturado no SimpleSchedulingForm:', error);
      
      // Detectar se é erro de conflito
      if (error?.isConflict) {
        console.log('⚠️ Conflito detectado - mostrando aviso e preservando formulário');
        toast({
          title: 'Horário já ocupado',
          description: error.message || 'Já existe um paciente agendado neste horário. Ajuste a data ou horário e tente novamente.',
          variant: 'destructive',
        });
        // Opcionalmente manter detalhes para futura inspeção
        setConflictMessage(error.message || 'Conflito de horário detectado');
        setConflictDetails(error.conflictDetails || null);
        setTimeConflictError(error.message || 'Horário já está ocupado. Ajuste a data ou o horário.');
        // NÃO propagar o erro e NÃO abrir modal; manter dados para edição
      } else {
        // Re-propagar outros tipos de erro
        throw error;
      }
    }
  }, [handleSubmit, onSubmit]);

  // Handler para confirmação de conflito
  const handleConfirmConflict = useCallback(async () => {
    console.log('✅ Confirmando agendamento com conflito');
    setShowConflictModal(false);
    
    if (onSubmitWithForce) {
      try {
        await onSubmitWithForce(formData);
        console.log('✅ Agendamento forçado com sucesso');
      } catch (error) {
        console.log('❌ Erro ao forçar agendamento:', error);
        // O erro será tratado pelo useSimpleSchedulingForm
      }
    }
  }, [onSubmitWithForce, formData]);

  const handleCancelConflict = useCallback(() => {
    console.log('❌ Cancelando modal de conflito');
    setShowConflictModal(false);
    setConflictMessage('');
    setConflictDetails(null);
  }, []);

  const handleCancelAppointment = useCallback(async (appointmentId: string) => {
    if (onCancelAppointment) {
      await onCancelAppointment(appointmentId);
    }
    setCancelConfirmOpen(false);
    setAppointmentToCancel(null);
  }, [onCancelAppointment]);

  const handleDeleteAppointment = useCallback(async (appointmentId: string) => {
    if (onDeleteAppointment) {
      await onDeleteAppointment(appointmentId);
    }
    setDeleteConfirmOpen(false);
    setAppointmentToDelete(null);
  }, [onDeleteAppointment]);

  const handleConfirmAppointment = useCallback(async (appointmentId: string) => {
    if (onConfirmAppointment) {
      await onConfirmAppointment(appointmentId);
    }
  }, [onConfirmAppointment]);

  const handleUnconfirmAppointment = useCallback(async (appointmentId: string) => {
    if (onUnconfirmAppointment) {
      await onUnconfirmAppointment(appointmentId);
    }
  }, [onUnconfirmAppointment]);

  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());

  // Sincronizar calendário com data pré-selecionada (navegação de lista)
  useEffect(() => {
    if (preSelectedDate) {
      setSelectedCalendarDate(new Date(preSelectedDate + 'T12:00:00'));
    }
  }, [preSelectedDate]);

  const selectedDoctor = doctors.find(doctor => doctor.id === formData.medicoId);
  const availableConvenios = selectedDoctor?.convenios_aceitos || [];
  const medicoSelected = !!formData.medicoId;

  // Função para obter agendamentos de um médico específico em uma data
  const getAppointmentsForDoctorAndDate = (doctorId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(
      appointment => 
        appointment.medico_id === doctorId && 
        appointment.data_agendamento === dateStr
    );
  };

  // Memoizar funções para evitar re-criação desnecessária
  const hasAppointmentsOnDate = useCallback((date: Date) => {
    if (!selectedDoctor) return false;
    return getAppointmentsForDoctorAndDate(selectedDoctor.id, date).length > 0;
  }, [selectedDoctor, getAppointmentsForDoctorAndDate]);

  const hasBlocksOnDate = useCallback((date: Date) => {
    if (!selectedDoctor) return false;
    if (isDateBlocked) {
      return isDateBlocked(selectedDoctor.id, date);
    }
    // Fallback manual se isDateBlocked não estiver disponível
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.some(blocked => 
      blocked.medico_id === selectedDoctor.id &&
      blocked.status === 'ativo' &&
      dateStr >= blocked.data_inicio &&
      dateStr <= blocked.data_fim
    );
  }, [selectedDoctor, isDateBlocked, blockedDates]);

  // Memoizar modifiers do calendario para evitar re-renderizações
  const calendarModifiers = useMemo(() => ({
    hasAppointments: hasAppointmentsOnDate,
    hasBlocks: hasBlocksOnDate
  }), [hasAppointmentsOnDate, hasBlocksOnDate]);

  const calendarModifiersStyles = useMemo(() => ({
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
  }), []);

  const selectedDateAppointments = selectedDoctor 
    ? getAppointmentsForDoctorAndDate(selectedDoctor.id, selectedCalendarDate)
    : [];

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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulário de Agendamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={memoizedHandleSubmit} className="space-y-4">
              <PatientDataFormFixed
                formData={formData}
                setFormData={setFormData}
                availableConvenios={availableConvenios}
                medicoSelected={medicoSelected}
                selectedDoctor={selectedDoctor}
                onFillLastPatient={onFillLastPatient}
              />

              <AppointmentDataForm
                formData={formData}
                setFormData={setFormData}
                doctors={doctors}
                atendimentos={atendimentos}
                timeConflictError={timeConflictError || undefined}
                onClearTimeConflict={() => setTimeConflictError(null)}
              />

              {/* Exibir erro sempre que existir */}
              {error && (
                <Alert variant="destructive" className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3 pt-4">
                {/* Botões principais */}
                <div className="flex gap-3">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading 
                      ? (editingAppointment ? 'Atualizando...' : 'Agendando...') 
                      : (editingAppointment ? 'Atualizar Agendamento' : 'Confirmar Agendamento')
                    }
                  </Button>
                  <Button type="button" variant="ghost" onClick={onCancel} className="min-w-[100px]">
                    Cancelar
                  </Button>
                </div>
                
                {/* Ações secundárias */}
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setMultipleOpen(true)} className="flex-1">
                    Agendar múltiplos
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setWaitlistOpen(true)} className="flex-1">
                    Adicionar à Fila
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Calendário e Agendamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Agenda do Médico
            </CardTitle>
            {selectedDoctor && (
              <div className="text-sm text-muted-foreground">
                {selectedDoctor.nome} - {selectedDoctor.especialidade}
              </div>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4">
            {!selectedDoctor ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-medium text-muted-foreground mb-2">
                  Selecione um médico
                </h4>
                <p className="text-sm text-muted-foreground">
                  Para visualizar a agenda, primeiro selecione um médico no formulário.
                </p>
              </div>
            ) : (
              <>
                {/* Calendário */}
                <div className="space-y-2">
                  <h4 className="font-medium">Selecione uma data para ver agendamentos:</h4>
                  <Calendar
                    key={`calendar-${selectedDoctor.id}`}
                    mode="single"
                    selected={selectedCalendarDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedCalendarDate(date);
                        // Sincronizar automaticamente com o campo "Data" do formulário
                        setFormData(prev => ({
                          ...prev,
                          dataAgendamento: format(date, 'yyyy-MM-dd')
                        }));
                      }
                    }}
                    locale={ptBR}
                    className="rounded-md border shadow-sm bg-background p-3 pointer-events-auto"
                    disabled={hasBlocksOnDate}
                    modifiers={calendarModifiers}
                    modifiersStyles={calendarModifiersStyles}
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-primary rounded"></div>
                      <span>Dias com agendamentos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-destructive rounded"></div>
                      <span>Dias bloqueados (não disponíveis)</span>
                    </div>
                  </div>
                </div>

                {/* Lista de agendamentos do dia selecionado */}
                <div className="space-y-3">
                  {(() => {
                    const validAppointments = selectedDateAppointments.filter(
                      appointment => appointment.status !== 'cancelado' && appointment.status !== 'cancelado_bloqueio' && appointment.status !== 'excluido'
                    );
                    const count = validAppointments.length;
                    
                    return (
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">
                          Agendamentos para {format(selectedCalendarDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}:
                        </h4>
                        <Badge variant="secondary" className="text-xs">
                          {count === 0 ? 'Nenhum agendamento' : `${count} ${count === 1 ? 'agendamento' : 'agendamentos'}`}
                        </Badge>
                      </div>
                    );
                  })()}
                  
                  <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                    {selectedDateAppointments.length > 0 ? (
                      selectedDateAppointments
                        .filter(appointment => appointment.status !== 'excluido') // Esconder apenas excluídos
                        .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                        .map((appointment) => (
                          <div 
                            key={appointment.id} 
                            className={`py-1 px-2 border rounded flex items-center justify-between gap-2 ${
                              appointment.status === 'confirmado' 
                                ? 'bg-green-50 border-green-200' 
                                : appointment.status === 'cancelado'
                                ? 'bg-red-50 border-red-200 opacity-70'
                                : 'bg-background'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Clock className="h-3 w-3 text-primary flex-shrink-0" />
                              <span className="text-sm font-medium flex-shrink-0">
                                {appointment.hora_agendamento}
                              </span>
                              <span className="text-sm font-medium text-foreground truncate">
                                {appointment.pacientes?.nome_completo || 'Paciente agendado'}
                              </span>
                              {appointment.pacientes?.convenio && (
                                <span className="text-xs text-muted-foreground truncate">
                                  - {appointment.pacientes.convenio}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge 
                                variant="secondary" 
                                className={`text-xs flex-shrink-0 ${
                                  appointment.status === 'confirmado'
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : getStatusColor(appointment.status)
                                }`}
                              >
                                {appointment.status === 'confirmado' ? 'confirmado' : appointment.status}
                              </Badge>
                              
                              {/* Botões de ação */}
                              {appointment.status === 'agendado' && onCancelAppointment && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => {
                                    setAppointmentToCancel(appointment.id);
                                    setCancelConfirmOpen(true);
                                  }}
                                  title="Cancelar agendamento"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              {appointment.status === 'cancelado' && onDeleteAppointment && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => {
                                    setAppointmentToDelete(appointment.id);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  title="Excluir permanentemente"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              {appointment.status === 'confirmado' && onUnconfirmAppointment && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-primary hover:bg-primary hover:text-primary-foreground"
                                  onClick={() => handleUnconfirmAppointment(appointment.id)}
                                  title="Desconfirmar agendamento"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                              {(appointment.status === 'agendado' || appointment.status === 'cancelado') && onConfirmAppointment && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-green-600 hover:bg-green-600 hover:text-white"
                                  onClick={() => handleConfirmAppointment(appointment.id)}
                                  title="Confirmar agendamento"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg bg-muted/50">
                        <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum agendamento nesta data</p>
                        <p className="text-xs">Esta data está disponível para agendamento</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Confirmação de Conflito */}
      <ConflictConfirmationModal
        open={showConflictModal}
        onConfirm={handleConfirmConflict}
        onCancel={handleCancelConflict}
        conflictMessage={conflictMessage}
        conflictDetails={conflictDetails}
      />

      {/* Modal: Agendamento Múltiplo */}
      <MultipleSchedulingModal
        open={multipleOpen}
        onOpenChange={setMultipleOpen}
        doctors={doctors}
        atendimentos={atendimentos}
        availableConvenios={Array.from(new Set(doctors.flatMap(d => d.convenios_aceitos || [])))}
        onSuccess={(data) => {
          toast({
            title: 'Agendamentos criados',
            description: 'Múltiplos exames agendados com sucesso.',
          });
          // Propagar para o container (Index) quando disponível
          onMultipleSuccess?.(data);
        }}
        initialData={{
          nomeCompleto: formData.nomeCompleto,
          dataNascimento: formData.dataNascimento,
          convenio: formData.convenio,
          telefone: formData.telefone,
          celular: formData.celular,
          medicoId: formData.medicoId,
          dataAgendamento: formData.dataAgendamento,
          horaAgendamento: formData.horaAgendamento,
          observacoes: formData.observacoes || '',
        }}
      />

      {/* Modal: Adicionar à Fila de Espera */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adicionar à Fila de Espera</DialogTitle>
          </DialogHeader>
          <FilaEsperaForm
            doctors={selectedDoctor ? [selectedDoctor] : doctors}
            atendimentos={selectedDoctor ? atendimentos.filter(a => a.medico_id === selectedDoctor.id) : atendimentos}
            onSubmit={adicionarFilaEspera}
            onCancel={() => setWaitlistOpen(false)}
            searchPatientsByBirthDate={searchPatientsByBirthDate}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialogs de Confirmação */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => appointmentToCancel && handleCancelAppointment(appointmentToCancel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => appointmentToDelete && handleDeleteAppointment(appointmentToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConflictConfirmationModal
        open={showConflictModal}
        onConfirm={handleConfirmConflict}
        onCancel={handleCancelConflict}
        conflictMessage={conflictMessage}
        conflictDetails={conflictDetails}
      />
    </div>
  );
}