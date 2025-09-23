import { Button } from '@/components/ui/button';
import { InstallButton } from '@/components/InstallButton';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { KeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help';
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
  return (
    <div className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={inovaiaLogo} 
              alt="INOVAIA Logo" 
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                INOVAIA
              </h1>
              <p className="text-sm text-muted-foreground">
                Sistema de Agendamentos Médicos
              </p>
              {profileName && (
                <p className="text-sm font-medium text-foreground mt-1">
                  <span className="text-muted-foreground">Recepcionista:</span> {profileName}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <KeyboardShortcutsHelp />
            <ThemeToggle />
            <NotificationCenter />
            
            {viewMode !== 'doctors' && (
              <Button 
                onClick={viewMode === 'nova-fila' ? onBackToFilaEspera : onBack} 
                variant="outline"
                size="sm"
              >
                {viewMode === 'nova-fila' ? 'Voltar à Fila de Espera' : 'Voltar aos Médicos'}
              </Button>
            )}
            
            <InstallButton />
            
            <Button 
              onClick={onSignOut} 
              variant="outline"
              size="sm"
              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};