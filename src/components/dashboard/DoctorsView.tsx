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
      {/* Header com busca melhorada */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Médicos Disponíveis</h2>
          <p className="text-muted-foreground">
            {filteredDoctors.length} de {doctors.length} médicos encontrados
          </p>
        </div>
        <div className="relative w-full sm:w-auto sm:min-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do médico ou especialidade..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      {/* Doctors Grid com animações */}
      {filteredDoctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDoctors.map((doctor, index) => (
            <div 
              key={doctor.id} 
              className="group space-y-3 animate-fade-in hover-scale" 
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card/50 to-card border border-border/50 backdrop-blur-sm transition-all duration-300 group-hover:shadow-lg group-hover:border-primary/30">
                <DoctorCard
                  doctor={doctor}
                  onSchedule={onScheduleDoctor}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewSchedule(doctor.id)}
                className="w-full bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
              >
                Ver Agenda Completa
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="animate-fade-in">
          <Card className="p-12 text-center bg-gradient-to-br from-muted/30 to-background border-dashed border-2 border-muted-foreground/20">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted/50 rounded-full flex items-center justify-center">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">
                {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum médico disponível'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {searchTerm ? 
                  `Não encontramos médicos com o termo "${searchTerm}". Tente ajustar sua busca.` : 
                  'Não há médicos ativos cadastrados no sistema no momento.'
                }
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};