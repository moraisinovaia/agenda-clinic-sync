import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DoctorCard } from '@/components/scheduling/DoctorCard';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { StatsCards } from './StatsCards';
import { SystemStatusPanel } from './SystemStatusPanel';
import { DashboardActions } from './DashboardActions';

interface DoctorsViewProps {
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onScheduleDoctor: (doctorId: string) => void;
  onViewSchedule: (doctorId: string) => void;
  onDashboardAction: (action: string) => void;
}

export const DoctorsView = ({ 
  doctors, 
  appointments,
  searchTerm, 
  onSearchChange, 
  onScheduleDoctor, 
  onViewSchedule,
  onDashboardAction
}: DoctorsViewProps) => {
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  };

  const filteredDoctors = doctors.filter(doctor => {
    const searchNormalized = normalizeText(searchTerm);
    const nomeNormalized = normalizeText(doctor.nome);
    const especialidadeNormalized = normalizeText(doctor.especialidade);
    
    return nomeNormalized.includes(searchNormalized) ||
           especialidadeNormalized.includes(searchNormalized);
  });

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <StatsCards doctors={doctors} appointments={appointments} />

      {/* Layout principal com dashboard e status */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Dashboard principal */}
        <div className="flex-1">
          <DashboardActions 
            onDashboardAction={onDashboardAction}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
          />
        </div>

        {/* Status do sistema (sidebar direita) */}
        <div className="xl:w-80">
          <SystemStatusPanel />
        </div>
      </div>

      {/* Lista de médicos quando há busca */}
      {searchTerm && (
        <div className="space-y-4">
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Resultados da Busca</h3>
            {filteredDoctors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDoctors.map((doctor) => (
                  <div key={doctor.id} className="space-y-2">
                    <DoctorCard
                      doctor={doctor}
                      onSchedule={onScheduleDoctor}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewSchedule(doctor.id)}
                      className="w-full"
                    >
                      Ver Agenda
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Nenhum médico encontrado com o termo "{searchTerm}"
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};