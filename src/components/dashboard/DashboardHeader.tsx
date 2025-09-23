import { Button } from '@/components/ui/button';
import { InstallButton } from '@/components/InstallButton';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { KeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help';
import { ClientSelector } from '@/components/admin/ClientSelector';
import { SuperAdminClientSelector } from '@/components/admin/SuperAdminClientSelector';
import { SuperAdminDebugPanel } from '@/components/admin/SuperAdminDebugPanel';
import { useStableAuth } from '@/hooks/useStableAuth';
import inovaiaLogo from '@/assets/inovaia-logo.png';

type ViewMode = 'doctors' | 'schedule' | 'new-appointment' | 'appointments-list' | 'edit-appointment' | 'preparos' | 'fila-espera' | 'nova-fila' | 'bloqueio-agenda' | 'relatorio-agenda' | 'auth-test' | 'alertas' | 'multiple-appointment' | 'canceled-appointments' | 'whatsapp-agent';

interface DashboardHeaderProps {
  viewMode: ViewMode;
  profileName?: string;
  onBack: () => void;
  onBackToFilaEspera: () => void;
  onSignOut: () => void;
  notificationCenter?: React.ReactNode;
}

export const DashboardHeader = ({ 
  viewMode, 
  profileName, 
  onBack, 
  onBackToFilaEspera,
  onSignOut,
  notificationCenter
}: DashboardHeaderProps) => {
  const { isSuperAdmin } = useStableAuth();

  return (
    <div className="space-y-4">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={inovaiaLogo} 
                alt="INOVAIA Logo" 
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  INOVAIA
                </h1>
                <p className="text-muted-foreground mt-1">
                  Sistema de Agendamentos Médicos
                </p>
                {profileName && (
                  <p className="text-sm text-primary font-medium">
                    Recepcionista: {profileName}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <ClientSelector />
              <KeyboardShortcutsHelp />
              <ThemeToggle />
              <NotificationCenter />
              
              {viewMode !== 'doctors' && (
                <Button 
                  onClick={viewMode === 'nova-fila' ? onBackToFilaEspera : onBack} 
                  variant="outline"
                >
                  {viewMode === 'nova-fila' ? 'Voltar à Fila de Espera' : 'Voltar aos Médicos'}
                </Button>
              )}
              
              <InstallButton />
              
              <Button 
                onClick={onSignOut} 
                variant="outline"
                size="sm"
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin Tools - Mostrar apenas se for super admin */}
      {isSuperAdmin && (
        <div className="container mx-auto px-4 space-y-4">
          <SuperAdminClientSelector />
          <SuperAdminDebugPanel />
        </div>
      )}
    </div>
  );
};