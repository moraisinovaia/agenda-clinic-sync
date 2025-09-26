import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  Users,
  ClipboardList,
  Clock,
  BarChart3,
  Settings,
  LogOut,
  Home,
  CalendarX,
  Shield,
  FileText,
  ChevronDown,
  User,
  Menu,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ViewMode } from '@/hooks/useViewMode';

interface NavigationItem {
  title: string;
  icon: React.ComponentType<any>;
  viewMode?: ViewMode;
  description?: string;
  shortcut?: string;
  adminOnly?: boolean;
  children?: NavigationChild[];
}

interface NavigationChild {
  title: string;
  icon: React.ComponentType<any>;
  viewMode: ViewMode;
  shortcut?: string;
}

interface AppSidebarProps {
  viewMode: ViewMode;
  onViewChange: (view: ViewMode) => void;
  profile?: {
    nome?: string;
    role?: string;
    status?: string;
  };
  onSignOut: () => void;
  appointmentCount?: number;
  waitlistCount?: number;
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    icon: Home,
    viewMode: 'doctors' as ViewMode,
    description: 'Visão geral do sistema',
    shortcut: 'Ctrl+D'
  },
  {
    title: 'Agendamentos',
    icon: Calendar,
    children: [
      {
        title: 'Novo Agendamento',
        icon: CalendarPlus,
        viewMode: 'new-appointment' as ViewMode,
        shortcut: 'Ctrl+N'
      },
      {
        title: 'Múltiplos Exames',
        icon: ClipboardList,
        viewMode: 'multiple-appointment' as ViewMode,
        shortcut: 'Ctrl+M'
      },
      {
        title: 'Lista Completa',
        icon: FileText,
        viewMode: 'appointments-list' as ViewMode,
        shortcut: 'Ctrl+L'
      },
      {
        title: 'Cancelados',
        icon: CalendarX,
        viewMode: 'canceled-appointments' as ViewMode,
      }
    ]
  },
  {
    title: 'Fila de Espera',
    icon: Clock,
    viewMode: 'fila-espera' as ViewMode,
    description: 'Gestão de lista de espera',
    shortcut: 'Ctrl+Shift+F'
  },
  {
    title: 'Relatórios',
    icon: BarChart3,
    children: [
      {
        title: 'Relatório de Agenda',
        icon: FileText,
        viewMode: 'relatorio-agenda' as ViewMode,
      }
    ]
  },
  {
    title: 'Configurações',
    icon: Settings,
    children: [
      {
        title: 'Bloqueio de Agenda',
        icon: CalendarX,
        viewMode: 'bloqueio-agenda' as ViewMode,
      }
    ]
  }
];

const adminItems: NavigationItem[] = [
  {
    title: 'Administração',
    icon: Shield,
    viewMode: 'doctors' as ViewMode,
    description: 'Painel administrativo',
    adminOnly: true
  }
];

export function AppSidebar({
  viewMode,
  onViewChange,
  profile,
  onSignOut,
  appointmentCount = 0,
  waitlistCount = 0
}: AppSidebarProps) {
  const { open, setOpen } = useSidebar();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['agendamentos']);

  const isActive = (targetViewMode: ViewMode) => viewMode === targetViewMode;

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(g => g !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'receptionist':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'receptionist':
        return 'Recepcionista';
      default:
        return 'Usuário';
    }
  };

  const isAdmin = profile?.role === 'admin';
  const allItems = isAdmin ? [...adminItems, ...navigationItems] : navigationItems;

  return (
    <Sidebar className="border-r border-border">
      {/* Header */}
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-3 px-3 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            I
          </div>
          {open && (
            <div className="flex-1">
              <h2 className="text-lg font-bold">INOVAIA</h2>
              <p className="text-xs text-muted-foreground">Sistema de Agendamentos</p>
            </div>
          )}
        </div>
        
        {/* Mobile Trigger */}
        <div className="flex items-center justify-between px-3 pb-2 md:hidden">
          <SidebarTrigger />
          <ThemeToggle />
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => {
                if (item.children) {
                  const isExpanded = expandedGroups.includes(item.title.toLowerCase());
                  const hasActiveChild = item.children.some(child => 
                    isActive(child.viewMode)
                  );
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => toggleGroup(item.title.toLowerCase())}
                        className={`group ${hasActiveChild ? 'bg-accent' : ''}`}
                      >
                        <item.icon className="h-4 w-4" />
                      {open && (
                          <>
                            <span className="flex-1 text-left">{item.title}</span>
                            <ChevronDown 
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`} 
                            />
                          </>
                        )}
                      </SidebarMenuButton>
                      
                      {isExpanded && open && (
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton
                                onClick={() => onViewChange(child.viewMode)}
                                className={isActive(child.viewMode) ? 'bg-accent text-accent-foreground' : ''}
                              >
                                <child.icon className="h-4 w-4" />
                                <span>{child.title}</span>
                                {child.shortcut && (
                                  <span className="ml-auto text-xs text-muted-foreground">
                                    {child.shortcut}
                                  </span>
                                )}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => onViewChange(item.viewMode)}
                      className={isActive(item.viewMode) ? 'bg-accent text-accent-foreground' : ''}
                    >
                      <item.icon className="h-4 w-4" />
                {open && (
                        <>
                          <span className="flex-1">{item.title}</span>
                          {item.shortcut && (
                            <span className="text-xs text-muted-foreground">
                              {item.shortcut}
                            </span>
                          )}
                          {/* Badges for counts */}
                          {item.viewMode === 'appointments-list' && appointmentCount > 0 && (
                            <Badge variant="secondary" className="ml-auto">
                              {appointmentCount}
                            </Badge>
                          )}
                          {item.viewMode === 'fila-espera' && waitlistCount > 0 && (
                            <Badge variant="outline" className="ml-auto">
                              {waitlistCount}
                            </Badge>
                          )}
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Actions - only on desktop when not collapsed */}
        {open && (
          <SidebarGroup>
            <SidebarGroupLabel>Ações Rápidas</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="grid gap-2">
                <Button
                  size="sm"
                  onClick={() => onViewChange('new-appointment')}
                  className="justify-start"
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Novo Agendamento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewChange('multiple-appointment')}
                  className="justify-start"
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Múltiplos Exames
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border">
        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start h-auto p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={profile?.nome} />
                  <AvatarFallback className="text-xs">
                    {getInitials(profile?.nome)}
                  </AvatarFallback>
                </Avatar>
                {open && (
                  <div className="flex-1 text-left ml-2 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile?.nome || 'Usuário'}
                    </p>
                    <Badge 
                      variant={getRoleBadgeVariant(profile?.role)}
                      className="text-xs"
                    >
                      {getRoleLabel(profile?.role)}
                    </Badge>
                  </div>
                )}
                {open && <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={profile?.nome} />
                  <AvatarFallback className="text-xs">
                    {getInitials(profile?.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profile?.nome || 'Usuário'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getRoleLabel(profile?.role)}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Theme toggle for desktop */}
          {open && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}