import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, User, Phone, CheckCircle, Edit, X } from 'lucide-react';
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
          {paginatedAppointments.length > 0 ? (
            <div className="space-y-0">
              <div className="relative">
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 border-b">
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold w-[100px] px-2">Status</TableHead>
                        <TableHead className="font-semibold w-[100px] px-2">Data</TableHead>
                        <TableHead className="font-semibold w-[80px] px-2">Hora</TableHead>
                        <TableHead className="font-semibold w-[220px] px-2">Paciente</TableHead>
                        <TableHead className="font-semibold w-[120px] px-2">Telefone</TableHead>
                        <TableHead className="font-semibold w-[160px] px-2">Médico</TableHead>
                        <TableHead className="font-semibold w-[100px] px-2">Convênio</TableHead>
                        <TableHead className="font-semibold w-[120px] px-2">Tipo</TableHead>
                        <TableHead className="font-semibold w-[120px] px-2">Agendado por</TableHead>
                        <TableHead className="font-semibold text-center w-[120px] px-2 sticky right-0 bg-muted/30 border-l">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAppointments.map((appointment) => (
                        <TableRow key={appointment.id} className="hover:bg-muted/20 border-b">
                          <TableCell className="px-2 py-3">
                            <Badge variant={getStatusColor(appointment.status)} className="text-xs whitespace-nowrap">
                              {getStatusLabel(appointment.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium px-2 py-3">
                            {format(new Date(appointment.data_agendamento), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-mono px-2 py-3">
                            {appointment.hora_agendamento}
                          </TableCell>
                          <TableCell className="px-2 py-3">
                            <div className="font-medium truncate max-w-[200px]">
                              {appointment.pacientes?.nome_completo || 'Paciente não encontrado'}
                            </div>
                            {appointment.observacoes && (
                              <div className="text-xs text-muted-foreground truncate mt-1 max-w-[200px]">
                                {appointment.observacoes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-3">
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">
                                {appointment.pacientes?.telefone || appointment.pacientes?.celular || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-3">
                            <div className="font-medium truncate max-w-[140px]">
                              Dr(a). {appointment.medicos?.nome || 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {appointment.medicos?.especialidade || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-3">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {appointment.pacientes?.convenio || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 py-3">
                            <div className="text-sm truncate max-w-[100px]">
                              {appointment.atendimentos?.nome || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm px-2 py-3">
                            <div className="truncate max-w-[100px]">
                              {appointment.criado_por_profile?.nome || 
                               appointment.criado_por || 
                               'Recepcionista'}
                            </div>
                          </TableCell>
                          <TableCell className="sticky right-0 bg-background/95 backdrop-blur-sm border-l px-2 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onEditAppointment?.(appointment)}
                                className="h-7 w-7 p-0"
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
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Confirmar"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onCancelAppointment?.(appointment.id)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="border-t bg-muted/10 p-4">
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