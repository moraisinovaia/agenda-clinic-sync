import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentWithRelations } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, User, Phone, Search } from 'lucide-react';

interface AppointmentsListProps {
  appointments: AppointmentWithRelations[];
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onCancelAppointment?: (appointmentId: string) => void;
}

export function AppointmentsList({ appointments, onEditAppointment, onCancelAppointment }: AppointmentsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = 
      appointment.pacientes?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.medicos?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Se filtro específico para cancelado, mostrar apenas cancelados
    if (statusFilter === 'cancelado') {
      return matchesSearch && appointment.status === 'cancelado';
    }
    
    // Por padrão, não mostrar cancelados (exceto quando filtro específico)
    if (appointment.status === 'cancelado' && statusFilter !== 'cancelado') {
      return false;
    }
    
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedAppointments = filteredAppointments.sort((a, b) => {
    const dateA = new Date(`${a.data_agendamento}T${a.hora_agendamento}`);
    const dateB = new Date(`${b.data_agendamento}T${b.hora_agendamento}`);
    return dateB.getTime() - dateA.getTime(); // Mais recentes primeiro
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lista de Agendamentos
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por paciente ou médico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de agendamentos */}
          <div className="space-y-3">
            {sortedAppointments.length > 0 ? (
              sortedAppointments.map((appointment) => (
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
                            (appointment.criado_por_user_id ? 'Recepcionista' : appointment.criado_por) ||
                            'Recepcionista'
                          }
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onEditAppointment?.(appointment)}
                        >
                          Editar
                        </Button>
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
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Nenhum agendamento encontrado com os filtros aplicados'
                    : 'Nenhum agendamento encontrado'
                  }
                </p>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}