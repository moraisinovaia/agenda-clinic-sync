import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DoctorCard } from '@/components/scheduling/DoctorCard';
import { Doctor } from '@/types/scheduling';

interface DoctorsViewProps {
  doctors: Doctor[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onScheduleDoctor: (doctorId: string) => void;
  onViewSchedule: (doctorId: string) => void;
}

export const DoctorsView = ({ 
  doctors, 
  searchTerm, 
  onSearchChange, 
  onScheduleDoctor, 
  onViewSchedule 
}: DoctorsViewProps) => {
  console.log('📊 DoctorsView render - doctors:', doctors?.length || 0, 'array:', Array.isArray(doctors));
  
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  };

  // Ensure doctors is always an array
  const safeDoctors = Array.isArray(doctors) ? doctors : [];
  
  const filteredDoctors = safeDoctors.filter(doctor => {
    if (!doctor || typeof doctor !== 'object') return false;
    
    const searchNormalized = normalizeText(searchTerm);
    const nomeNormalized = normalizeText(doctor.nome || '');
    const especialidadeNormalized = normalizeText(doctor.especialidade || '');
    
    return nomeNormalized.includes(searchNormalized) ||
           especialidadeNormalized.includes(searchNormalized);
  });
  
  console.log('🔍 DoctorsView - filtered doctors:', filteredDoctors?.length || 0);

  return (
    <>
      {/* Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do médico ou especialidade..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Doctors Grid */}
      {filteredDoctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {searchTerm ? 
                `Nenhum médico encontrado com o termo "${searchTerm}"` : 
                safeDoctors.length === 0 ? 
                  'Carregando médicos...' : 
                  'Nenhum médico encontrado. Verifique se existem médicos ativos no sistema.'
              }
            </p>
            {safeDoctors.length === 0 && (
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">
                  Verificando conexão com banco de dados...
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
};