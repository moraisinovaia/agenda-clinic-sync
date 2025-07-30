import { useState } from 'react';
import { CalendarDays, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  doctorFilter: string;
  onDoctorFilterChange: (value: string) => void;
  convenioFilter: string;
  onConvenioFilterChange: (value: string) => void;
  doctors: any[];
  appointments: any[];
}

export const AppointmentFilters = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFilter,
  onDateFilterChange,
  doctorFilter,
  onDoctorFilterChange,
  convenioFilter,
  onConvenioFilterChange,
  doctors,
  appointments,
}: AppointmentFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getUniqueConvenios = () => {
    const convenios = appointments
      .map(apt => apt.pacientes?.convenio)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);
    return convenios.sort();
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (statusFilter !== 'all') count++;
    if (dateFilter !== 'all') count++;
    if (doctorFilter !== 'all') count++;
    if (convenioFilter !== 'all') count++;
    return count;
  };

  const clearAllFilters = () => {
    onSearchChange('');
    onStatusChange('all');
    onDateFilterChange('all');
    onDoctorFilterChange('all');
    onConvenioFilterChange('all');
  };

  const getDateFilterLabel = (value: string) => {
    switch (value) {
      case 'today': return 'Hoje';
      case 'tomorrow': return 'Amanhã';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mês';
      case 'past': return 'Anteriores';
      default: return 'Todas as Datas';
    }
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Card className="mb-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAllFilters();
                  }}
                  className="h-6 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Botões de Acesso Rápido */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
              <Button
                variant={statusFilter === 'cancelado' ? "default" : "outline"}
                size="sm"
                onClick={() => onStatusChange(statusFilter === 'cancelado' ? 'all' : 'cancelado')}
              >
                {statusFilter === 'cancelado' ? 'Ocultar' : 'Ver'} Cancelados
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Filtrar pacientes menores de idade
                  const today = new Date();
                  const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                  onSearchChange('menor');
                }}
              >
                Agendamentos de Menores
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Search Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <Input
                  placeholder="Nome do paciente..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={onStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="cancelado_bloqueio">Cancelado por Bloqueio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data</label>
                <Select value={dateFilter} onValueChange={onDateFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Datas</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="tomorrow">Amanhã</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mês</SelectItem>
                    <SelectItem value="future">Futuras</SelectItem>
                    <SelectItem value="past">Anteriores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Doctor Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Médico</label>
                <Select value={doctorFilter} onValueChange={onDoctorFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Médicos</SelectItem>
                    {doctors
                      .filter(doctor => doctor.ativo)
                      .map(doctor => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          Dr(a). {doctor.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Convenio Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Convênio</label>
                <Select value={convenioFilter} onValueChange={onConvenioFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Convênios</SelectItem>
                    {getUniqueConvenios().map(convenio => (
                      <SelectItem key={convenio} value={convenio}>
                        {convenio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                {searchTerm && (
                  <Badge variant="outline" className="gap-1">
                    Busca: {searchTerm}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => onSearchChange('')}
                    />
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant="outline" className="gap-1">
                    Status: {statusFilter}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => onStatusChange('all')}
                    />
                  </Badge>
                )}
                {dateFilter !== 'all' && (
                  <Badge variant="outline" className="gap-1">
                    Data: {getDateFilterLabel(dateFilter)}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => onDateFilterChange('all')}
                    />
                  </Badge>
                )}
                {doctorFilter !== 'all' && (
                  <Badge variant="outline" className="gap-1">
                    Médico: {doctors.find(d => d.id === doctorFilter)?.nome}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => onDoctorFilterChange('all')}
                    />
                  </Badge>
                )}
                {convenioFilter !== 'all' && (
                  <Badge variant="outline" className="gap-1">
                    Convênio: {convenioFilter}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => onConvenioFilterChange('all')}
                    />
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};