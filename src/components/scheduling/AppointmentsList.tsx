import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, User, Phone, CheckCircle, Edit, X, RotateCcw } from 'lucide-react';
import { AppointmentFilters } from '@/components/filters/AppointmentFilters';
import { useAdvancedAppointmentFilters } from '@/hooks/useAdvancedAppointmentFilters';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';

interface AppointmentsListProps {
  appointments: AppointmentWithRelations[];
  doctors: any[];
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onCancelAppointment?: (appointmentId: string) => void;
  onConfirmAppointment?: (appointmentId: string) => void;
  onUnconfirmAppointment?: (appointmentId: string) => void;
}

export function AppointmentsList({ appointments, doctors, onEditAppointment, onCancelAppointment, onConfirmAppointment, onUnconfirmAppointment }: AppointmentsListProps) {
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
        return 'default';
      case 'confirmado':
        return 'secondary';
      case 'realizado':
        return 'outline';
      case 'cancelado':
        return 'destructive';
      case 'cancelado_bloqueio':
        return 'destructive';
      default:
        return 'outline';
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
        
        <CardContent className="p-0">
          {filteredAppointments.length > 0 ? (
            <>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted/50 border-b-2">
                      <TableHead className="font-semibold min-w-[100px]">Status</TableHead>
                      <TableHead className="font-semibold min-w-[100px]">Data</TableHead>
                      <TableHead className="font-semibold min-w-[80px]">Hora</TableHead>
                      <TableHead className="font-semibold min-w-[200px]">Paciente</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">Telefone</TableHead>
                      <TableHead className="font-semibold min-w-[150px]">Médico</TableHead>
                      <TableHead className="font-semibold min-w-[100px]">Convênio</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">Tipo</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">Agendado por</TableHead>
                      <TableHead className="font-semibold text-center min-w-[120px] sticky right-0 bg-muted/50">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAppointments.map((appointment) => (
                    <TableRow key={appointment.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Badge variant={getStatusColor(appointment.status)} className="text-xs">
                          {getStatusLabel(appointment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatInTimeZone(new Date(appointment.data_agendamento + 'T00:00:00'), BRAZIL_TIMEZONE, 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono">
                        {appointment.hora_agendamento}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="font-medium truncate">
                          {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                        </div>
                        {appointment.observacoes && (
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {appointment.observacoes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {appointment.pacientes?.telefone || appointment.pacientes?.celular || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <div className="font-medium truncate">
                          Dr(a). {appointment.medicos?.nome || 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {appointment.medicos?.especialidade || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {appointment.pacientes?.convenio || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[120px]">
                        <div className="text-sm truncate">
                          {appointment.atendimentos?.nome || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {appointment.criado_por_profile?.nome || 
                         appointment.criado_por || 
                         'Recepcionista'}
                      </TableCell>
                      <TableCell className="sticky right-0 bg-background/95 backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onEditAppointment?.(appointment)}
                            className="h-8 w-8 p-0"
                            title="Editar"
                          >
                            <Edit className="h-3 w-3" />
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
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onCancelAppointment?.(appointment.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Cancelar"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {appointment.status === 'confirmado' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onUnconfirmAppointment?.(appointment.id)}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Desconfirmar"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onCancelAppointment?.(appointment.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Cancelar"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="border-t bg-muted/20 p-4">
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
            </>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                Nenhum agendamento encontrado com os filtros aplicados
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Total de agendamentos: {total}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}