import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import { Doctor, Atendimento, SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { PatientDataForm } from './PatientDataForm';
import { AppointmentDataForm } from './AppointmentDataForm';
import { useSchedulingForm } from '@/hooks/useSchedulingForm';

interface SchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  appointments: AppointmentWithRelations[];
  blockedDates?: any[];
  isDateBlocked?: (doctorId: string, date: Date) => boolean;
  onSubmit: (data: SchedulingFormData) => Promise<void>;
  onCancel: () => void;
  getAtendimentosByDoctor: (doctorId: string) => Atendimento[];
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
  editingAppointment?: AppointmentWithRelations;
}

export function SchedulingForm({ 
  doctors, 
  atendimentos, 
  appointments,
  blockedDates = [],
  isDateBlocked,
  onSubmit, 
  onCancel,
  getAtendimentosByDoctor,
  searchPatientsByBirthDate,
  editingAppointment
}: SchedulingFormProps) {
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

  const { formData, setFormData, loading, handleSubmit } = useSchedulingForm(initialEditData);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());

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

  // Função para verificar se uma data tem agendamentos para o médico selecionado
  const hasAppointmentsOnDate = (date: Date) => {
    if (!selectedDoctor) return false;
    return getAppointmentsForDoctorAndDate(selectedDoctor.id, date).length > 0;
  };

  // Função para verificar se uma data está bloqueada para o médico selecionado
  const hasBlocksOnDate = (date: Date) => {
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
  };

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
            <form onSubmit={(e) => handleSubmit(e, onSubmit)} className="space-y-4">
              <PatientDataForm
                formData={formData}
                setFormData={setFormData}
                availableConvenios={availableConvenios}
                medicoSelected={medicoSelected}
                searchPatientsByBirthDate={searchPatientsByBirthDate}
              />

              <AppointmentDataForm
                formData={formData}
                setFormData={setFormData}
                doctors={doctors}
                atendimentos={atendimentos}
              />

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading 
                    ? (editingAppointment ? 'Atualizando...' : 'Agendando...') 
                    : (editingAppointment ? 'Atualizar Agendamento' : 'Confirmar Agendamento')
                  }
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
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
                    mode="single"
                    selected={selectedCalendarDate}
                    onSelect={(date) => date && setSelectedCalendarDate(date)}
                    locale={ptBR}
                    className="rounded-md border shadow-sm bg-background p-3 pointer-events-auto"
                    disabled={(date) => hasBlocksOnDate(date)}
                    modifiers={{
                      hasAppointments: (date) => hasAppointmentsOnDate(date),
                      hasBlocks: (date) => hasBlocksOnDate(date)
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
                      <span>Dias bloqueados (não disponíveis)</span>
                    </div>
                  </div>
                </div>

                {/* Lista de agendamentos do dia selecionado */}
                <div className="space-y-3">
                  <h4 className="font-medium">
                    Agendamentos para {format(selectedCalendarDate, "dd 'de' MMMM", { locale: ptBR })}:
                  </h4>
                  
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedDateAppointments.length > 0 ? (
                      selectedDateAppointments
                        .filter(appointment => appointment.status !== 'cancelado' && appointment.status !== 'cancelado_bloqueio') // Esconder cancelados
                        .sort((a, b) => a.hora_agendamento.localeCompare(b.hora_agendamento))
                        .map((appointment) => (
                          <div 
                            key={appointment.id} 
                            className={`p-3 border rounded-lg space-y-2 ${
                              appointment.status === 'confirmado' 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-background'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="font-medium">
                                  {appointment.hora_agendamento}
                                </span>
                              </div>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${
                                  appointment.status === 'confirmado'
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : getStatusColor(appointment.status)
                                }`}
                              >
                                {appointment.status === 'confirmado' ? 'confirmado' : appointment.status}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {appointment.pacientes?.nome_completo || 'Paciente agendado'}
                                </span>
                                {appointment.pacientes?.convenio && (
                                  <span className="text-xs">
                                    {appointment.pacientes.convenio}
                                  </span>
                                )}
                              </div>
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
    </div>
  );
}