import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemSettings {
  sessionTimeout: number; // minutes
  enableNotifications: boolean;
  autoBackup: boolean;
  backupInterval: number; // hours
  maxAppointmentsPerDay: number;
  reminderTime: number; // minutes before appointment
}

export const SystemSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({
    sessionTimeout: 60,
    enableNotifications: true,
    autoBackup: true,
    backupInterval: 24,
    maxAppointmentsPerDay: 50,
    reminderTime: 15
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('systemSettings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('systemSettings', JSON.stringify(settings));
      setHasChanges(false);
      toast({
        title: 'Configurações salvas',
        description: 'As configurações do sistema foram atualizadas com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    }
  };

  const resetSettings = () => {
    const defaultSettings: SystemSettings = {
      sessionTimeout: 60,
      enableNotifications: true,
      autoBackup: true,
      backupInterval: 24,
      maxAppointmentsPerDay: 50,
      reminderTime: 15
    };
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const updateSetting = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configurações do Sistema
          {hasChanges && (
            <Badge variant="secondary" className="ml-2">
              Alterações pendentes
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Session Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Sessão e Segurança</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Timeout da Sessão (minutos)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min={5}
                max={480}
                value={settings.sessionTimeout}
                onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 60)}
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Notificações</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificações do navegador</Label>
              <p className="text-xs text-muted-foreground">
                Receber notificações para eventos importantes
              </p>
            </div>
            <Switch
              checked={settings.enableNotifications}
              onCheckedChange={(checked) => updateSetting('enableNotifications', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminderTime">Lembrete antes do agendamento (minutos)</Label>
            <Input
              id="reminderTime"
              type="number"
              min={5}
              max={60}
              value={settings.reminderTime}
              onChange={(e) => updateSetting('reminderTime', parseInt(e.target.value) || 15)}
            />
          </div>
        </div>

        {/* Backup Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Backup Automático</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Backup automático</Label>
              <p className="text-xs text-muted-foreground">
                Fazer backup automático dos dados
              </p>
            </div>
            <Switch
              checked={settings.autoBackup}
              onCheckedChange={(checked) => updateSetting('autoBackup', checked)}
            />
          </div>

          {settings.autoBackup && (
            <div className="space-y-2">
              <Label htmlFor="backupInterval">Intervalo do backup (horas)</Label>
              <Input
                id="backupInterval"
                type="number"
                min={1}
                max={168}
                value={settings.backupInterval}
                onChange={(e) => updateSetting('backupInterval', parseInt(e.target.value) || 24)}
              />
            </div>
          )}
        </div>

        {/* Performance Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Performance</h3>
          
          <div className="space-y-2">
            <Label htmlFor="maxAppointments">Máximo de agendamentos por dia</Label>
            <Input
              id="maxAppointments"
              type="number"
              min={10}
              max={200}
              value={settings.maxAppointmentsPerDay}
              onChange={(e) => updateSetting('maxAppointmentsPerDay', parseInt(e.target.value) || 50)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t">
          <Button
            onClick={saveSettings}
            disabled={!hasChanges}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar Alterações
          </Button>
          
          <Button
            variant="outline"
            onClick={resetSettings}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Restaurar Padrão
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>• As configurações são salvas localmente no navegador</p>
          <p>• Algumas alterações podem exigir uma atualização da página</p>
          <p>• O backup automático funciona apenas quando o sistema está ativo</p>
        </div>
      </CardContent>
    </Card>
  );
};