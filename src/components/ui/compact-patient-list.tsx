import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCheck, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Patient {
  id: string;
  nome_completo: string;
  data_nascimento?: string;
  convenio?: string;
  telefone?: string;
  celular?: string;
}

interface CompactPatientListProps {
  patients: Patient[];
  loading?: boolean;
  onSelectPatient: (patient: Patient) => void;
  onCreateNew?: () => void;
  showCreateNew?: boolean;
  className?: string;
}

export function CompactPatientList({
  patients,
  loading = false,
  onSelectPatient,
  onCreateNew,
  showCreateNew = true,
  className
}: CompactPatientListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserCheck className="h-4 w-4" />
          <span>Buscando pacientes...</span>
        </div>
        <div className="border rounded-md p-2 bg-background">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-2">
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (patients.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm">
        <UserCheck className="h-4 w-4 text-green-600" />
        <span className="font-medium text-green-700">
          {patients.length === 1 
            ? 'Paciente encontrado!' 
            : `${patients.length} pacientes encontrados`
          }
        </span>
      </div>
      
      <div className="border rounded-md bg-background">
        <ScrollArea className="max-h-60">
          <div className="p-2 space-y-1">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {patient.nome_completo}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[
                      patient.convenio,
                      patient.celular,
                      patient.telefone
                    ].filter(Boolean).join(' • ')}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectPatient(patient)}
                  className="h-7 px-3 text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Selecionar
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {showCreateNew && onCreateNew && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCreateNew}
              className="w-full text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Criar novo paciente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}