import { AppointmentWithRelations } from '@/types/scheduling';

interface AppointmentSummaryProps {
  appointments: AppointmentWithRelations[];
  className?: string;
}

interface AppointmentStats {
  consultas: number;
  retornos: number;
  exames: number;
  total: number;
}

export function AppointmentSummary({ appointments, className = "" }: AppointmentSummaryProps) {
  const calculateStats = (): AppointmentStats => {
    // Filtrar apenas agendamentos ativos (não cancelados)
    const activeAppointments = appointments.filter(apt => 
      apt.status !== 'cancelado'
    );

    let consultas = 0;
    let retornos = 0;
    let exames = 0;

    activeAppointments.forEach(appointment => {
      const tipoAtendimento = appointment.atendimentos?.tipo?.toLowerCase() || '';
      const nomeAtendimento = appointment.atendimentos?.nome?.toLowerCase() || '';
      
      // Retornos: tipo = 'retorno' OU nome contém "retorno"
      if (tipoAtendimento === 'retorno' || nomeAtendimento.includes('retorno')) {
        retornos++;
      }
      // Exames: qualquer tipo de exame ou procedimento
      else if (['exame', 'procedimento', 'procedimento_especial'].includes(tipoAtendimento)) {
        exames++;
      }
      // Consultas: consulta que não é retorno
      else if (tipoAtendimento === 'consulta') {
        consultas++;
      }
      // Fallback: se não tem tipo definido, considerar como consulta
      else {
        consultas++;
      }
    });

    return {
      consultas,
      retornos,
      exames,
      total: activeAppointments.length
    };
  };

  const stats = calculateStats();

  return (
    <div className={`bg-muted/30 px-4 py-3 border-t ${className}`}>
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <span>Consultas: <span className="font-medium text-foreground">{stats.consultas}</span></span>
        <span>Retornos: <span className="font-medium text-foreground">{stats.retornos}</span></span>
        <span>Exames: <span className="font-medium text-foreground">{stats.exames}</span></span>
        <span>Total: <span className="font-bold text-foreground">{stats.total}</span></span>
      </div>
    </div>
  );
}