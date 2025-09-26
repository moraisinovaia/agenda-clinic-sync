import { Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DoctorCard } from '@/components/scheduling/DoctorCard';
import { Doctor } from '@/types/scheduling';

interface DoctorsViewProps {
  doctors: Doctor[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onScheduleDoctor: (doctorId: string) => void;
  onViewSchedule: (doctorId: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const DoctorsView = ({ 
  doctors, 
  searchTerm, 
  onSearchChange, 
  onScheduleDoctor, 
  onViewSchedule,
  loading = false,
  error = null,
  onRetry 
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
    <>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do médico ou especialidade..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            disabled={loading}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="p-6 animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredDoctors.length > 0 ? (
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
          <div className="flex flex-col items-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium text-muted-foreground mb-2">
                {error ? 'Erro ao carregar médicos' : 'Nenhum médico encontrado'}
              </p>
              <p className="text-sm text-muted-foreground">
                {error ? 
                  'Verifique sua conexão com a internet e tente novamente.' :
                  searchTerm ? 
                    `Nenhum médico encontrado com o termo "${searchTerm}"` : 
                    'Não há médicos ativos cadastrados no sistema.'
                }
              </p>
            </div>
            {error && onRetry && (
              <Button onClick={onRetry} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  );
};