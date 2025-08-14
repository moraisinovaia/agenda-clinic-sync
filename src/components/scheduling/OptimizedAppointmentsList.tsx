import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  CheckCircle, 
  Edit, 
  X, 
  RotateCcw, 
  Search,
  Filter,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { useServerSideAppointmentsList } from '@/hooks/useServerSideAppointmentsList';
import { useDebounce } from '@/hooks/useDebounce';
import { usePerformanceCache } from '@/hooks/usePerformanceCache';
import { logger } from '@/utils/logger';

interface OptimizedAppointmentsListProps {
  doctors: any[];
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
}

export function OptimizedAppointmentsList({ doctors, onEditAppointment }: OptimizedAppointmentsListProps) {
  // Server-side appointments hook
  const {
    appointments,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    changePage,
    changeItemsPerPage,
    refresh,
    clearFilters,
    cancelAppointment,
    confirmAppointment,
    unconfirmAppointment,
  } = useServerSideAppointmentsList();

  // Performance cache for frequently accessed data
  const cache = usePerformanceCache<any>({
    maxItems: 500,
    maxAge: 3 * 60 * 1000, // 3 minutes
    maxMemoryMB: 25,
  });

  // Local filter states for immediate UI feedback
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [localStatusFilter, setLocalStatusFilter] = useState('all');
  const [localDateFilter, setLocalDateFilter] = useState('all');
  const [localDoctorFilter, setLocalDoctorFilter] = useState('all');
  const [localConvenioFilter, setLocalConvenioFilter] = useState('all');

  // Debounce search to reduce server calls
  const debouncedSearchTerm = useDebounce(localSearchTerm, 500);
  
  // Performance monitoring
  const [renderTime, setRenderTime] = useState(0);
  const renderStartTime = useRef<number>(0);

  // Track render performance
  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderEndTime = performance.now();
    const currentRenderTime = renderEndTime - renderStartTime.current;
    setRenderTime(currentRenderTime);
    
    if (currentRenderTime > 100) {
      logger.warn('Slow render detected', { 
        renderTime: `${currentRenderTime.toFixed(2)}ms`,
        appointmentCount: appointments.length 
      }, 'PERFORMANCE');
    }
  }, [appointments]);

  // Update server filters when debounced values change
  useEffect(() => {
    updateFilters({
      searchTerm: debouncedSearchTerm || undefined,
      statusFilter: localStatusFilter !== 'all' ? localStatusFilter : undefined,
      dateFilter: localDateFilter !== 'all' ? localDateFilter : undefined,
      doctorFilter: localDoctorFilter !== 'all' ? localDoctorFilter : undefined,
      convenioFilter: localConvenioFilter !== 'all' ? localConvenioFilter : undefined,
    });
  }, [debouncedSearchTerm, localStatusFilter, localDateFilter, localDoctorFilter, localConvenioFilter, updateFilters]);

  // Get unique convenios from cache or calculate
  const uniqueConvenios = useMemo(() => {
    const cacheKey = 'unique-convenios';
    const cached = cache.get(cacheKey);
    
    if (cached) return cached;

    // This would be calculated from a separate query in a real optimization
    const convenios = Array.from(new Set(
      appointments.map(apt => apt.pacientes?.convenio).filter(Boolean)
    ));
    
    cache.set(cacheKey, convenios);
    return convenios;
  }, [appointments, cache]);

  // Handle local filter changes
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearchTerm(value);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setLocalStatusFilter(value);
  }, []);

  const handleDateFilterChange = useCallback((value: string) => {
    setLocalDateFilter(value);
  }, []);

  const handleDoctorFilterChange = useCallback((value: string) => {
    setLocalDoctorFilter(value);
  }, []);

  const handleConvenioFilterChange = useCallback((value: string) => {
    setLocalConvenioFilter(value);
  }, []);

  const handleClearFilters = useCallback(() => {
    setLocalSearchTerm('');
    setLocalStatusFilter('all');
    setLocalDateFilter('all');
    setLocalDoctorFilter('all');
    setLocalConvenioFilter('all');
    clearFilters();
  }, [clearFilters]);

  // Load initial data
  useEffect(() => {
    refresh();
  }, [refresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado': return 'default';
      case 'confirmado': return 'secondary';
      case 'realizado': return 'outline';
      case 'cancelado': return 'destructive';
      case 'cancelado_bloqueio': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agendado': return 'Agendado';
      case 'confirmado': return 'Confirmado';
      case 'realizado': return 'Realizado';
      case 'cancelado': return 'Cancelado';
      case 'cancelado_bloqueio': return 'Cancelado (Bloqueio)';
      default: return status;
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-destructive">Erro ao carregar agendamentos</p>
            <Button onClick={refresh} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Indicator (dev mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-3 w-3" />
          Render: {renderTime.toFixed(1)}ms | 
          Cache: {cache.stats.memoryUsageMB.toFixed(1)}MB |
          Hit Rate: {cache.getStats().hitRate}
        </div>
      )}

      {/* Optimized Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente, médico..."
                value={localSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={localStatusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={localDateFilter} onValueChange={handleDateFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Datas</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="tomorrow">Amanhã</SelectItem>
                <SelectItem value="future">Futuro</SelectItem>
                <SelectItem value="past">Passado</SelectItem>
              </SelectContent>
            </Select>

            {/* Doctor Filter */}
            <Select value={localDoctorFilter} onValueChange={handleDoctorFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Médico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Médicos</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr(a). {doctor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Convenio Filter */}
            <Select value={localConvenioFilter} onValueChange={handleConvenioFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Convênio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Convênios</SelectItem>
                {uniqueConvenios.map((convenio) => (
                  <SelectItem key={convenio} value={convenio}>
                    {convenio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClearFilters} size="sm">
                Limpar
              </Button>
              <Button variant="outline" onClick={refresh} size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamentos ({pagination.totalCount})
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Página {pagination.currentPage} de {pagination.totalPages}
              </span>
              <Select 
                value={pagination.itemsPerPage.toString()} 
                onValueChange={(value) => changeItemsPerPage(parseInt(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Carregando agendamentos...</p>
            </div>
          ) : appointments.length > 0 ? (
            <>
              <div className="overflow-x-auto">
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
                      <TableHead className="font-semibold text-center min-w-[120px] sticky right-0 bg-muted/50">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appointment) => (
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
                                  onClick={() => confirmAppointment(appointment.id)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Confirmar"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => cancelAppointment(appointment.id)}
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
                                  onClick={() => unconfirmAppointment(appointment.id)}
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Desconfirmar"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => cancelAppointment(appointment.id)}
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
              
              {/* Server-side Pagination */}
              {pagination.totalPages > 1 && (
                <div className="border-t bg-muted/20 p-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {pagination.startItem} a {pagination.endItem} de {pagination.totalCount} itens
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changePage(1)}
                        disabled={!pagination.hasPreviousPage}
                      >
                        Primeira
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changePage(pagination.currentPage - 1)}
                        disabled={!pagination.hasPreviousPage}
                      >
                        Anterior
                      </Button>
                      
                      <span className="mx-4 text-sm">
                        {pagination.currentPage} de {pagination.totalPages}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changePage(pagination.currentPage + 1)}
                        disabled={!pagination.hasNextPage}
                      >
                        Próxima
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changePage(pagination.totalPages)}
                        disabled={!pagination.hasNextPage}
                      >
                        Última
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                Nenhum agendamento encontrado com os filtros aplicados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}