import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Palette, Calendar, Bell, RefreshCw } from 'lucide-react';
import { useClientConfigurations } from '@/hooks/useClientConfigurations';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export const ClientConfigurationPanel = () => {
  const { 
    configurations, 
    loading, 
    updateConfiguration, 
    getConfigurationsByCategory,
    refetch 
  } = useClientConfigurations();
  
  const [saving, setSaving] = useState<string | null>(null);

  const handleUpdateConfig = async (id: string, value: string) => {
    setSaving(id);
    try {
      await updateConfiguration(id, value);
    } finally {
      setSaving(null);
    }
  };

  const renderConfigInput = (config: any) => {
    const isDisabled = !config.editable || saving === config.id;
    
    if (config.value_type === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id={config.id}
            checked={config.value === 'true'}
            onCheckedChange={(checked) => handleUpdateConfig(config.id, checked.toString())}
            disabled={isDisabled}
          />
          <Label htmlFor={config.id}>{config.description}</Label>
        </div>
      );
    }

    if (config.key === 'theme_color') {
      return (
        <div className="space-y-2">
          <Label htmlFor={config.id}>{config.description}</Label>
          <div className="flex items-center space-x-2">
            <Input
              id={config.id}
              type="color"
              value={config.value}
              onChange={(e) => handleUpdateConfig(config.id, e.target.value)}
              disabled={isDisabled}
              className="w-16 h-10 p-1"
            />
            <Input
              value={config.value}
              onChange={(e) => handleUpdateConfig(config.id, e.target.value)}
              disabled={isDisabled}
              placeholder="#0ea5e9"
              className="flex-1"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label htmlFor={config.id}>{config.description}</Label>
        <Input
          id={config.id}
          type={config.value_type === 'number' ? 'number' : 'text'}
          value={config.value}
          onChange={(e) => handleUpdateConfig(config.id, e.target.value)}
          disabled={isDisabled}
          placeholder={config.description || ''}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const interfaceConfigs = getConfigurationsByCategory('interface');
  const schedulingConfigs = getConfigurationsByCategory('scheduling');
  const notificationConfigs = getConfigurationsByCategory('notifications');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configurações da Clínica</h2>
          <p className="text-muted-foreground">
            Personalize as configurações específicas da sua clínica
          </p>
        </div>
        <Button onClick={refetch} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Interface */}
      {interfaceConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Interface
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {interfaceConfigs.map((config) => (
              <div key={config.id}>
                {renderConfigInput(config)}
                {saving === config.id && (
                  <Badge variant="secondary" className="mt-2">
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    Salvando...
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Agendamentos */}
      {schedulingConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedulingConfigs.map((config) => (
              <div key={config.id}>
                {renderConfigInput(config)}
                {saving === config.id && (
                  <Badge variant="secondary" className="mt-2">
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    Salvando...
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notificações */}
      {notificationConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationConfigs.map((config) => (
              <div key={config.id}>
                {renderConfigInput(config)}
                {saving === config.id && (
                  <Badge variant="secondary" className="mt-2">
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    Salvando...
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {configurations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhuma configuração encontrada. As configurações serão criadas automaticamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};