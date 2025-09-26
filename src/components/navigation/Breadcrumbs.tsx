import { ChevronRight, Home } from 'lucide-react';
import { ViewMode } from '@/hooks/useViewMode';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  viewMode?: ViewMode;
  isActive?: boolean;
}

interface BreadcrumbsProps {
  viewMode: ViewMode;
  selectedDoctor?: {
    nome: string;
    especialidade?: string;
  };
  editingAppointment?: {
    pacientes?: {
      nome_completo: string;
    };
  };
  onViewChange: (viewMode: ViewMode) => void;
  className?: string;
}

const getViewModeLabel = (viewMode: ViewMode): string => {
  const labels: Record<ViewMode, string> = {
    'doctors': 'Dashboard',
    'schedule': 'Agenda',
    'new-appointment': 'Novo Agendamento',
    'appointments-list': 'Lista de Agendamentos', 
    'edit-appointment': 'Editar Agendamento',
    'fila-espera': 'Fila de Espera',
    'nova-fila': 'Nova Fila',
    'bloqueio-agenda': 'Bloqueio de Agenda',
    'relatorio-agenda': 'Relatório de Agenda',
    'multiple-appointment': 'Múltiplos Exames',
    'canceled-appointments': 'Agendamentos Cancelados'
  };
  
  return labels[viewMode] || viewMode;
};

const getBreadcrumbPath = (
  viewMode: ViewMode,
  selectedDoctor?: { nome: string; especialidade?: string },
  editingAppointment?: { pacientes?: { nome_completo: string } }
): BreadcrumbItem[] => {
  const basePath: BreadcrumbItem[] = [
    { label: 'Dashboard', viewMode: 'doctors' }
  ];

  switch (viewMode) {
    case 'doctors':
      return [{ label: 'Dashboard', isActive: true }];
      
    case 'schedule':
      return [
        ...basePath,
        { 
          label: selectedDoctor?.nome || 'Agenda', 
          isActive: true 
        }
      ];
      
    case 'new-appointment':
      if (selectedDoctor) {
        return [
          ...basePath,
          { label: selectedDoctor.nome, viewMode: 'schedule' },
          { label: 'Novo Agendamento', isActive: true }
        ];
      }
      return [
        ...basePath,
        { label: 'Novo Agendamento', isActive: true }
      ];
      
    case 'edit-appointment':
      if (selectedDoctor) {
        return [
          ...basePath,
          { label: selectedDoctor.nome, viewMode: 'schedule' },
          { 
            label: editingAppointment?.pacientes?.nome_completo || 'Editar Agendamento', 
            isActive: true 
          }
        ];
      }
      return [
        ...basePath,
        { label: 'Editar Agendamento', isActive: true }
      ];
      
    case 'appointments-list':
      return [
        ...basePath,
        { label: 'Lista de Agendamentos', isActive: true }
      ];
      
    case 'canceled-appointments':
      return [
        ...basePath,
        { label: 'Lista de Agendamentos', viewMode: 'appointments-list' },
        { label: 'Cancelados', isActive: true }
      ];
      
    case 'fila-espera':
      return [
        ...basePath,
        { label: 'Fila de Espera', isActive: true }
      ];
      
    case 'nova-fila':
      return [
        ...basePath,
        { label: 'Fila de Espera', viewMode: 'fila-espera' },
        { label: 'Nova Fila', isActive: true }
      ];
      
    case 'multiple-appointment':
      return [
        ...basePath,
        { label: 'Múltiplos Exames', isActive: true }
      ];
      
    case 'relatorio-agenda':
      return [
        ...basePath,
        { label: 'Relatórios' },
        { label: 'Relatório de Agenda', isActive: true }
      ];
      
    case 'bloqueio-agenda':
      return [
        ...basePath,
        { label: 'Configurações' },
        { label: 'Bloqueio de Agenda', isActive: true }
      ];
      
    default:
      return [
        ...basePath,
        { label: getViewModeLabel(viewMode), isActive: true }
      ];
  }
};

export function Breadcrumbs({
  viewMode,
  selectedDoctor,
  editingAppointment,
  onViewChange,
  className
}: BreadcrumbsProps) {
  const breadcrumbPath = getBreadcrumbPath(viewMode, selectedDoctor, editingAppointment);

  if (breadcrumbPath.length <= 1) {
    return null;
  }

  return (
    <nav className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}>
      <Home className="h-4 w-4" />
      
      {breadcrumbPath.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
          
          {item.viewMode && !item.isActive ? (
            <Button
              variant="link"
              size="sm"
              onClick={() => onViewChange(item.viewMode!)}
              className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Button>
          ) : (
            <span 
              className={cn(
                "font-medium",
                item.isActive && "text-foreground"
              )}
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}