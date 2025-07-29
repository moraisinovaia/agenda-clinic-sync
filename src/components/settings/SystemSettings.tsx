import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TestTube, Database, Clock, Settings } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useBackupSystem } from '@/hooks/useBackupSystem';

export const SystemSettings = () => {
  const { 
    settings, 
    loading: settingsLoading, 
    hasChanges, 
    updateSetting, 
    saveSettings, 
    resetSettings 
  } = useSystemSettings();

  const {
    loading: backupLoading,
    status: backupStatus,
    getBackupStatus,
    testManualBackup,
    testAutoBackup,
    toggleCronJob
  } = useBackupSystem();

  useEffect(() => {
    getBackupStatus();
  }, []);

  const formatLastBackup = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} às ${date.toLocaleTimeString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações do Sistema</h2>
          <p className="text-muted-foreground">
            Configure o comportamento geral do sistema
          </p>
        </div>
        <Button 
          onClick={getBackupStatus}
          variant="outline"
          size="sm"
          disabled={backupLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${backupLoading ? 'animate-spin' : ''}`} />
          Atualizar Status
        </Button>
      </div>

      {/* Status dos Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Status dos Backups Automáticos
          </CardTitle>
          <CardDescription>
            Informações sobre o sistema de backup automático
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status do Cron Job</Label>
              <div className="flex items-center gap-2">
                <Badge variant={backupStatus.cronJobActive ? "default" : "secondary"}>
                  {backupStatus.cronJobActive ? "Ativo" : "Inativo"}
                </Badge>
                <Switch
                  checked={backupStatus.cronJobActive}
                  onCheckedChange={toggleCronJob}
                  disabled={backupLoading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Último Backup</Label>
              <p className="text-sm text-muted-foreground">
                {formatLastBackup(backupStatus.lastBackup)}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Total de Backups</Label>
              <p className="text-sm font-medium">
                {backupStatus.totalBackups || 0} backups salvos
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              onClick={testManualBackup}
              variant="outline"
              size="sm"
              disabled={backupLoading}
            >
              <TestTube className="h-4 w-4 mr-2" />
              Teste Manual
            </Button>
            <Button
              onClick={testAutoBackup}
              variant="outline"
              size="sm"
              disabled={backupLoading}
            >
              <Clock className="h-4 w-4 mr-2" />
              Teste Automático
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Sessão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Sessão
          </CardTitle>
          <CardDescription>
            Configure o comportamento das sessões de usuário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">
                Timeout da Sessão (horas)
              </Label>
              <Input
                id="sessionTimeout"
                type="number"
                min="1"
                max="24"
                value={settings.sessionTimeout}
                onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
                disabled={settingsLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Notificações */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Notificações</CardTitle>
          <CardDescription>
            Configure como e quando as notificações são enviadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Habilitar Notificações</Label>
              <p className="text-sm text-muted-foreground">
                Receber notificações do sistema
              </p>
            </div>
            <Switch
              checked={settings.enableNotifications}
              onCheckedChange={(checked) => updateSetting('enableNotifications', checked)}
              disabled={settingsLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reminderTime">
              Tempo de Lembrete (horas)
            </Label>
            <Input
              id="reminderTime"
              type="number"
              min="1"
              max="168"
              value={settings.reminderTime}
              onChange={(e) => updateSetting('reminderTime', parseInt(e.target.value))}
              disabled={settingsLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Backup */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Backup</CardTitle>
          <CardDescription>
            Configure o sistema de backup automático
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Backup Automático</Label>
              <p className="text-sm text-muted-foreground">
                Criar backups automaticamente em intervalos regulares
              </p>
            </div>
            <Switch
              checked={settings.autoBackup}
              onCheckedChange={(checked) => updateSetting('autoBackup', checked)}
              disabled={settingsLoading}
            />
          </div>
          
          {settings.autoBackup && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="backupInterval">
                  Intervalo (horas)
                </Label>
                <Input
                  id="backupInterval"
                  type="number"
                  min="1"
                  max="168"
                  value={settings.backupInterval}
                  onChange={(e) => updateSetting('backupInterval', parseInt(e.target.value))}
                  disabled={settingsLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="autoBackupMaxCount">
                  Máximo de Backups
                </Label>
                <Input
                  id="autoBackupMaxCount"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.autoBackupMaxCount}
                  onChange={(e) => updateSetting('autoBackupMaxCount', parseInt(e.target.value))}
                  disabled={settingsLoading}
                />
              </div>
            </div>
          )}

          {settings.autoBackup && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Incluir Dados</Label>
                  <p className="text-sm text-muted-foreground">
                    Incluir dados das tabelas no backup
                  </p>
                </div>
                <Switch
                  checked={settings.autoBackupIncludeData}
                  onCheckedChange={(checked) => updateSetting('autoBackupIncludeData', checked)}
                  disabled={settingsLoading}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Incluir Schema</Label>
                  <p className="text-sm text-muted-foreground">
                    Incluir estrutura das tabelas no backup
                  </p>
                </div>
                <Switch
                  checked={settings.autoBackupIncludeSchema}
                  onCheckedChange={(checked) => updateSetting('autoBackupIncludeSchema', checked)}
                  disabled={settingsLoading}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações de Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Performance</CardTitle>
          <CardDescription>
            Configure limites e comportamentos para otimizar a performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxAppointmentsPerDay">
              Máximo de Agendamentos por Médico por Dia
            </Label>
            <Input
              id="maxAppointmentsPerDay"
              type="number"
              min="1"
              max="100"
              value={settings.maxAppointmentsPerDay}
              onChange={(e) => updateSetting('maxAppointmentsPerDay', parseInt(e.target.value))}
              disabled={settingsLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex gap-4">
        <Button 
          onClick={saveSettings}
          disabled={!hasChanges || settingsLoading}
          className="flex-1"
        >
          {settingsLoading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
        <Button 
          onClick={resetSettings}
          variant="outline"
          disabled={settingsLoading}
        >
          Restaurar Padrão
        </Button>
      </div>
    </div>
  );
};