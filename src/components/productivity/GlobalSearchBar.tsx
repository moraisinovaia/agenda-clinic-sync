import { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, Users, Clock, BookOpen, FileText, Settings, Zap } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ViewMode } from '@/hooks/useViewMode';
import { Doctor } from '@/types/scheduling';

interface GlobalSearchBarProps {
  doctors: Doctor[];
  onViewChange: (viewMode: ViewMode) => void;
  onDoctorSelect?: (doctorId: string) => void;
  onNavigateToSchedule?: (doctorId: string) => void;
}

const SEARCH_ACTIONS = [
  {
    id: 'new-appointment',
    title: 'Novo Agendamento',
    description: 'Criar um novo agendamento médico',
    icon: Calendar,
    viewMode: 'new-appointment' as ViewMode,
    category: 'Agendamentos',
    keywords: ['novo', 'agendamento', 'criar', 'marcar'],
    shortcut: 'Ctrl+N',
  },
  {
    id: 'appointments-list',
    title: 'Lista de Agendamentos',
    description: 'Ver todos os agendamentos',
    icon: FileText,
    viewMode: 'appointments-list' as ViewMode,
    category: 'Agendamentos',
    keywords: ['lista', 'agendamentos', 'ver', 'todos'],
    shortcut: 'Ctrl+L',
  },
  {
    id: 'multiple-appointment',
    title: 'Agendamento Múltiplo',
    description: 'Agendar para múltiplos pacientes',
    icon: Users,
    viewMode: 'multiple-appointment' as ViewMode,
    category: 'Agendamentos',
    keywords: ['múltiplo', 'vários', 'pacientes'],
    shortcut: 'Ctrl+M',
  },
  {
    id: 'fila-espera',
    title: 'Fila de Espera',
    description: 'Gerenciar fila de espera',
    icon: Clock,
    viewMode: 'fila-espera' as ViewMode,
    category: 'Gestão',
    keywords: ['fila', 'espera', 'aguardando'],
    shortcut: 'Ctrl+Shift+F',
  },
  {
    id: 'preparos',
    title: 'Preparos',
    description: 'Instruções de preparo para exames',
    icon: BookOpen,
    viewMode: 'preparos' as ViewMode,
    category: 'Recursos',
    keywords: ['preparos', 'instruções', 'exames'],
    shortcut: 'P',
  },
  {
    id: 'bloqueio-agenda',
    title: 'Bloqueio de Agenda',
    description: 'Bloquear datas na agenda',
    icon: Settings,
    viewMode: 'bloqueio-agenda' as ViewMode,
    category: 'Configuração',
    keywords: ['bloqueio', 'agenda', 'bloquear', 'indisponível'],
  },
];

export const GlobalSearchBar = ({ 
  doctors, 
  onViewChange, 
  onDoctorSelect, 
  onNavigateToSchedule 
}: GlobalSearchBarProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Open search with Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleActionSelect = useCallback((action: typeof SEARCH_ACTIONS[0]) => {
    onViewChange(action.viewMode);
    setOpen(false);
    setSearchValue('');
  }, [onViewChange]);

  const handleDoctorSelect = useCallback((doctor: Doctor) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule(doctor.id);
    } else if (onDoctorSelect) {
      onDoctorSelect(doctor.id);
    }
    setOpen(false);
    setSearchValue('');
  }, [onDoctorSelect, onNavigateToSchedule]);

  const filteredActions = SEARCH_ACTIONS.filter(action =>
    action.title.toLowerCase().includes(searchValue.toLowerCase()) ||
    action.description.toLowerCase().includes(searchValue.toLowerCase()) ||
    action.keywords.some(keyword => 
      keyword.toLowerCase().includes(searchValue.toLowerCase())
    )
  );

  const filteredDoctors = doctors.filter(doctor =>
    doctor.nome.toLowerCase().includes(searchValue.toLowerCase()) ||
    doctor.especialidade.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <>
      {/* Search Trigger Button */}
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">Buscar...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Busque por ações, médicos ou funcionalidades..." 
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p>Nenhum resultado encontrado.</p>
              <p className="text-sm text-muted-foreground">
                Tente buscar por "agendamento", "médico" ou "fila"
              </p>
            </div>
          </CommandEmpty>

          {/* Quick Actions */}
          {filteredActions.length > 0 && (
            <CommandGroup heading="Ações Rápidas">
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    value={action.title}
                    onSelect={() => handleActionSelect(action)}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{action.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {action.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                      {action.shortcut}
                    </kbd>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* Doctors */}
          {filteredDoctors.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Médicos">
                {filteredDoctors.map((doctor) => (
                  <CommandItem
                    key={doctor.id}
                    value={doctor.nome}
                    onSelect={() => handleDoctorSelect(doctor)}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                      <span className="text-sm font-medium text-blue-600">
                        {doctor.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{doctor.nome}</div>
                      <p className="text-sm text-muted-foreground">
                        {doctor.especialidade}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Ver Agenda
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Recent/Suggestions */}
          {searchValue === '' && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Sugestões">
                <CommandItem className="flex items-center gap-3 p-3 text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span>Digite para buscar por ações, médicos ou funcionalidades</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};