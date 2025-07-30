import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Phone, CheckCircle, Edit, X, Stethoscope, CreditCard, UserCircle } from 'lucide-react';
import { AppointmentFilters } from '@/components/filters/AppointmentFilters';
import { useAdvancedAppointmentFilters } from '@/hooks/useAdvancedAppointmentFilters';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';

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

  // Implement pagination with 15 items per page
  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedAppointments,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage,
    hasPreviousPage,
    totalItems,
    itemsPerPage
  } = usePagination(filteredAppointments, { itemsPerPage: 15 });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'confirmado':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'realizado':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'cancelado':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'cancelado_bloqueio':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'agendado':
        return <Clock className="h-3 w-3" />;
      case 'confirmado':
        return <CheckCircle className="h-3 w-3" />;
      case 'realizado':
        return <CheckCircle className="h-3 w-3" />;
      case 'cancelado':
      case 'cancelado_bloqueio':
        return <X className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
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
      case 'cancelado_bloqueio':
        return 'Cancelado (Bloqueio)';
      default:
        return status;
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

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Lista de Agendamentos</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          Mostrando {filtered} de {total} agendamentos
        </div>
      </div>

      {/* Appointments Grid */}
      {paginatedAppointments.length > 0 ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {paginatedAppointments.map((appointment) => (
              <Card key={appointment.id} className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary">
                <CardContent className="p-6">
                  {/* Header with Status and Actions */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      getStatusColor(appointment.status)
                    )}>
                      {getStatusIcon(appointment.status)}
                      {getStatusLabel(appointment.status)}
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onEditAppointment?.(appointment)}
                        className="h-8 w-8 p-0 hover:bg-primary/10"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {appointment.status === 'agendado' && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onConfirmAppointment?.(appointment.id)}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Confirmar"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onCancelAppointment?.(appointment.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base leading-tight mb-1">
                          {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                        </h3>
                        {appointment.pacientes?.telefone || appointment.pacientes?.celular ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{appointment.pacientes?.telefone || appointment.pacientes?.celular}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Date and Time */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {format(new Date(appointment.data_agendamento), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {appointment.hora_agendamento}
                        </div>
                      </div>
                    </div>

                    {/* Doctor Info */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <Stethoscope className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          Dr(a). {appointment.medicos?.nome || 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {appointment.medicos?.especialidade || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Additional Info Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {appointment.pacientes?.convenio || 'Particular'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <UserCircle className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {appointment.criado_por_profile?.nome || 
                           appointment.criado_por || 
                           'Recepcionista'}
                        </span>
                      </div>
                    </div>

                    {/* Type and Observations */}
                    {(appointment.atendimentos?.nome || appointment.observacoes) && (
                      <div className="pt-2 space-y-1">
                        {appointment.atendimentos?.nome && (
                          <div className="text-xs bg-muted/50 px-2 py-1 rounded">
                            <span className="font-medium">Tipo:</span> {appointment.atendimentos.nome}
                          </div>
                        )}
                        {appointment.observacoes && (
                          <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                            <span className="font-medium">Obs:</span> {appointment.observacoes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-6">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onFirstPage={goToFirstPage}
                onLastPage={goToLastPage}
                onNextPage={goToNextPage}
                onPreviousPage={goToPreviousPage}
                showInfo={true}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum agendamento encontrado</h3>
            <p className="text-muted-foreground mb-1">
              Não foram encontrados agendamentos com os filtros aplicados
            </p>
            <p className="text-sm text-muted-foreground">
              Total de agendamentos na base: {total}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}