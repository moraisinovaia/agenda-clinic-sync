import { useState } from 'react';
import { Plus, Calendar, Users, Clock, Search, BookOpen, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ViewMode } from '@/hooks/useViewMode';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  onViewChange: (viewMode: ViewMode) => void;
  isVisible?: boolean;
}

const QUICK_ACTIONS = [
  {
    id: 'new-appointment',
    label: 'Novo Agendamento',
    icon: Plus,
    viewMode: 'new-appointment' as ViewMode,
    shortcut: 'Ctrl+N',
    color: 'text-primary',
    bgColor: 'bg-primary/10 hover:bg-primary/20',
  },
  {
    id: 'appointments-list',
    label: 'Lista de Agendamentos',
    icon: Calendar,
    viewMode: 'appointments-list' as ViewMode,
    shortcut: 'Ctrl+L',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30',
  },
  {
    id: 'multiple-appointment',
    label: 'Agendamento Múltiplo',
    icon: Users,
    viewMode: 'multiple-appointment' as ViewMode,
    shortcut: 'Ctrl+M',
    color: 'text-green-600',
    bgColor: 'bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30',
  },
  {
    id: 'fila-espera',
    label: 'Fila de Espera',
    icon: Clock,
    viewMode: 'fila-espera' as ViewMode,
    shortcut: 'Ctrl+Shift+F',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/30',
  },
  {
    id: 'preparos',
    label: 'Preparos',
    icon: BookOpen,
    viewMode: 'preparos' as ViewMode,
    shortcut: 'P',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/30',
  },
  {
    id: 'alertas',
    label: 'Alertas',
    icon: AlertTriangle,
    viewMode: 'alertas' as ViewMode,
    shortcut: 'Ctrl+A',
    color: 'text-red-600',
    bgColor: 'bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30',
  },
];

export const QuickActionsPanel = ({ onViewChange, isVisible = true }: QuickActionsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isVisible) return null;

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50">
        {/* Floating Action Button */}
        <div className="relative">
          {/* Quick Actions Grid */}
          {isExpanded && (
            <Card className="absolute bottom-16 right-0 p-4 shadow-lg border backdrop-blur-sm bg-card/95 animate-fade-in">
              <div className="grid grid-cols-2 gap-3 w-64">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Tooltip key={action.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-auto p-3 flex flex-col items-center gap-2 text-xs font-medium transition-all",
                            action.bgColor,
                            action.color
                          )}
                          onClick={() => {
                            onViewChange(action.viewMode);
                            setIsExpanded(false);
                          }}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-center leading-tight">
                            {action.label}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>{action.label}</p>
                        <p className="text-xs text-muted-foreground">{action.shortcut}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Main FAB */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="lg"
                className={cn(
                  "h-14 w-14 rounded-full shadow-lg transition-all duration-300",
                  "bg-primary hover:bg-primary/90 text-primary-foreground",
                  "hover:scale-110 active:scale-95",
                  isExpanded && "rotate-45"
                )}
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Ações Rápidas</p>
              <p className="text-xs text-muted-foreground">
                {isExpanded ? 'Clique para fechar' : 'Clique para abrir'}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Backdrop */}
        {isExpanded && (
          <div
            className="fixed inset-0 bg-background/20 backdrop-blur-[1px] -z-10 animate-fade-in"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
};