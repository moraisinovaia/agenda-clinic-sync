import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Bug } from 'lucide-react';
import { AppointmentWithRelations } from '@/types/scheduling';
import { clearAllCache, clearCacheByPattern } from '@/hooks/useOptimizedQuery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentDebugPanelProps {
  appointments: AppointmentWithRelations[];
  selectedDoctor?: { id: string; nome: string };
  selectedDate?: Date;
  onForceRefresh?: () => void;
  visible?: boolean;
}

export function AppointmentDebugPanel({
  appointments,
  selectedDoctor,
  selectedDate,
  onForceRefresh,
  visible = false
}: AppointmentDebugPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  const handleClearCache = () => {
    clearAllCache();
    console.log('🧹 Cache limpo completamente');
    onForceRefresh?.();
  };

  const handleTotalReset = () => {
    console.log('🚨 RESET TOTAL acionado!');
    // Limpar localStorage
    localStorage.clear();
    // Limpar cache
    clearAllCache();
    // Forçar reload da página
    setTimeout(() => {
      console.log('🔄 Recarregando página para reset completo...');
      window.location.reload();
    }, 500);
  };

  const handleClearAppointmentsCache = () => {
    clearCacheByPattern('appointments');
    console.log('🧹 Cache de agendamentos limpo');
    onForceRefresh?.();
  };

  const drEdsonAppointments = appointments.filter(apt => 
    apt.medicos?.nome?.toLowerCase().includes('edson')
  );

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const appointmentsForSelectedDate = selectedDoctor && selectedDate 
    ? appointments.filter(apt => 
        apt.medico_id === selectedDoctor.id && 
        apt.data_agendamento === selectedDateStr
      )
    : [];

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bug className="h-4 w-4 text-orange-600" />
          Debug Panel - Agendamentos
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            className="ml-auto h-6 w-6 p-0"
          >
            {expanded ? '−' : '+'}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleClearCache}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Limpar Todo Cache
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleClearAppointmentsCache}
            className="text-xs"
          >
            <Database className="h-3 w-3 mr-1" />
            Cache Agendamentos
          </Button>
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={handleTotalReset}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            RESET TOTAL
          </Button>
          {onForceRefresh && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onForceRefresh}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Force Refresh
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-white p-2 rounded border">
            <div className="font-medium">Total Agendamentos</div>
            <div className="text-lg font-bold text-green-600">{appointments.length}</div>
            <div className="text-xs text-muted-foreground">Passados para DoctorSchedule</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="font-medium">Dr. Edson</div>
            <div className="text-lg font-bold">{drEdsonAppointments.length}</div>
          </div>
          {selectedDoctor && (
            <div className="bg-white p-2 rounded border">
              <div className="font-medium">{selectedDoctor.nome}</div>
              <div className="text-lg font-bold">
                {appointments.filter(apt => apt.medico_id === selectedDoctor.id).length}
              </div>
            </div>
          )}
          {selectedDate && (
            <div className="bg-white p-2 rounded border">
              <div className="font-medium">Data Selecionada</div>
              <div className="text-lg font-bold">{appointmentsForSelectedDate.length}</div>
              <div className="text-xs text-muted-foreground">
                {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
          )}
        </div>

        {expanded && (
          <div className="space-y-3">
            {/* Dr. Edson appointments in September */}
            <div className="bg-white p-3 rounded border">
              <h4 className="font-medium text-xs mb-2">Dr. Edson - Setembro 2025</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {drEdsonAppointments
                  .filter(apt => apt.data_agendamento?.startsWith('2025-09'))
                  .sort((a, b) => a.data_agendamento.localeCompare(b.data_agendamento))
                  .map(apt => (
                    <div key={apt.id} className="text-xs flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {apt.data_agendamento}
                      </Badge>
                      <span>{apt.hora_agendamento}</span>
                      <span>{apt.pacientes?.nome_completo}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {apt.status}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>

            {/* Selected date details */}
            {selectedDate && selectedDoctor && (
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium text-xs mb-2">
                  {selectedDoctor.nome} - {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                </h4>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {appointmentsForSelectedDate.length > 0 ? (
                    appointmentsForSelectedDate.map(apt => (
                      <div key={apt.id} className="text-xs flex items-center gap-2">
                        <span>{apt.hora_agendamento}</span>
                        <span>{apt.pacientes?.nome_completo}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {apt.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Nenhum agendamento encontrado
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}