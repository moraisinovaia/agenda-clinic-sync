import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Phone, CheckCircle } from 'lucide-react';
import { AppointmentFilters } from '@/components/filters/AppointmentFilters';
import { useAdvancedAppointmentFilters } from '@/hooks/useAdvancedAppointmentFilters';
import { useDebounce } from '@/hooks/useDebounce';

interface AppointmentsListProps {
  appointments: AppointmentWithRelations[];
  doctors: any[];
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onCancelAppointment?: (appointmentId: string) => void;
  onConfirmAppointment?: (appointmentId: string) => void;
}

export function AppointmentsList({ appointments, doctors, onEditAppointment, onCancelAppointment, onConfirmAppointment }: AppointmentsListProps) {
  const {
    searchTerm,
    statusFilter,
    dateFilter,
    doctorFilter,
    convenioFilter,
    setSearchTerm,
    setStatusFilter,
    setDateFilter,
    setDoctorFilter,
    setConvenioFilter,
    filteredAppointments,
    getFilterStats,
  } = useAdvancedAppointmentFilters(appointments);

  // Debounce search to improve performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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
      case 'cancelado_bloqueio':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const { total, filtered } = getFilterStats();

  return (
    <div className="space-y-6">
      {/* Advanced Filters */}
      <AppointmentFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        doctorFilter={doctorFilter}
        onDoctorFilterChange={setDoctorFilter}
        convenioFilter={convenioFilter}
        onConvenioFilterChange={setConvenioFilter}
        doctors={doctors}
        appointments={appointments}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Lista de Agendamentos
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Mostrando {filtered} de {total} agendamentos</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">

          {/* Lista de agendamentos */}
          <div className="space-y-3">
            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((appointment) => (
                <Card key={appointment.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                          </span>
                          <Badge variant="secondary" className={getStatusColor(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(appointment.data_agendamento), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>{appointment.hora_agendamento}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span>Dr(a). {appointment.medicos?.nome || 'Médico não encontrado'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{appointment.pacientes?.telefone || 'Sem telefone'}</span>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <strong>Especialidade:</strong> {appointment.medicos?.especialidade || 'N/A'}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <strong>Convênio:</strong> {appointment.pacientes?.convenio || 'N/A'}
                        </div>

                        {appointment.observacoes && (
                          <div className="text-xs text-muted-foreground">
                            <strong>Observações:</strong> {appointment.observacoes}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          <strong>Agendado por:</strong> {
                            appointment.criado_por_profile?.nome || 
                            appointment.criado_por || 
                            'Recepcionista'
                          }
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onEditAppointment?.(appointment)}
                          >
                            Editar Agendamento
                          </Button>
                          {appointment.status === 'agendado' && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => onConfirmAppointment?.(appointment.id)}
                              className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Confirmar
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {appointment.status === 'agendado' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => onCancelAppointment?.(appointment.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Nenhum agendamento encontrado com os filtros aplicados
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Total de agendamentos: {total}
                </p>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}