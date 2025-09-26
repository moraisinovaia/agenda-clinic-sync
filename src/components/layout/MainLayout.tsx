import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { ViewMode } from '@/hooks/useViewMode';

interface MainLayoutProps {
  children: ReactNode;
  viewMode: ViewMode;
  onViewChange: (viewMode: ViewMode) => void;
  profile?: {
    nome?: string;
    role?: string;
    status?: string;
  };
  onSignOut: () => void;
  selectedDoctor?: {
    nome: string;
    especialidade?: string;
  };
  editingAppointment?: {
    pacientes?: {
      nome_completo: string;
    };
  };
  appointmentCount?: number;
  waitlistCount?: number;
}

export function MainLayout({
  children,
  viewMode,
  onViewChange,
  profile,
  onSignOut,
  selectedDoctor,
  editingAppointment,
  appointmentCount = 0,
  waitlistCount = 0
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          viewMode={viewMode}
          onViewChange={onViewChange}
          profile={profile}
          onSignOut={onSignOut}
          appointmentCount={appointmentCount}
          waitlistCount={waitlistCount}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header */}
          <div className="flex items-center justify-between p-4 border-b border-border md:hidden">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">INOVAIA</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Desktop Header with Breadcrumbs */}
          <div className="hidden md:flex items-center justify-between p-4 border-b border-border">
            <Breadcrumbs
              viewMode={viewMode}
              selectedDoctor={selectedDoctor}
              editingAppointment={editingAppointment}
              onViewChange={onViewChange}
            />
            
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 overflow-hidden">
            <div className="h-full max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}