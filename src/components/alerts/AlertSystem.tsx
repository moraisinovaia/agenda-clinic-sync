import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AlertConfig {
  id?: string;
  type: 'system' | 'appointment' | 'critical';
  enabled: boolean;
  email: string;
  conditions: {
    systemDown?: boolean;
    appointmentConflicts?: boolean;
    criticalErrors?: boolean;
    databaseIssues?: boolean;
  };
}

export const AlertSystem = () => {
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [testEmail, setTestEmail] = useState('moraisinovaia@gmail.com');
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAlertConfigs();
  }, []);

  const loadAlertConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_clinica')
        .select('*')
        .eq('categoria', 'alertas');

      if (error) throw error;

      if (data && data.length > 0) {
        const configs = data.map(item => ({
          id: item.id,
          type: item.chave.replace('alert_', '') as 'system' | 'appointment' | 'critical',
          enabled: item.ativo || false,
          email: item.valor,
          conditions: (typeof item.dados_extras === 'object' && item.dados_extras && !Array.isArray(item.dados_extras)) 
            ? item.dados_extras as AlertConfig['conditions']
            : {}
        }));
        setAlerts(configs);
      } else {
        // Configurações padrão
        setAlerts([
          {
            type: 'system',
            enabled: true,
            email: 'moraisinovaia@gmail.com',
            conditions: {
              systemDown: true,
              databaseIssues: true
            }
          },
          {
            type: 'appointment',
            enabled: true,
            email: 'moraisinovaia@gmail.com', 
            conditions: {
              appointmentConflicts: true
            }
          },
          {
            type: 'critical',
            enabled: true,
            email: 'moraisinovaia@gmail.com',
            conditions: {
              criticalErrors: true
            }
          }
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de alertas:', error);
    }
  };

  const saveAlertConfig = async (config: AlertConfig) => {
    try {
      setIsLoading(true);
      
      const configData = {
        categoria: 'alertas',
        chave: `alert_${config.type}`,
        valor: config.email,
        ativo: config.enabled,
        dados_extras: config.conditions
      };

      if (config.id) {
        const { error } = await supabase
          .from('configuracoes_clinica')
          .update(configData)
          .eq('id', config.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes_clinica')
          .insert(configData);
        
        if (error) throw error;
      }

      toast({
        title: "Configuração salva",
        description: "Alertas configurados com sucesso!"
      });

      loadAlertConfigs();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração de alertas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestAlert = async () => {
    try {
      setIsTesting(true);

      const response = await supabase.functions.invoke('gmail-alerts', {
        body: {
          to: testEmail,
          subject: 'Teste do Sistema de Alertas',
          message: `Este é um teste do sistema de alertas da Endogastro. O sistema está funcionando corretamente!`,
          alertType: 'system',
          data: {
            timestamp: new Date().toISOString(),
            systemStatus: 'operational',
            testDetails: 'Teste de funcionalidade de alertas via Gmail SMTP'
          }
        }
      });

      if (response.error) throw response.error;

      toast({
        title: "Email de teste enviado!",
        description: `Verifique a caixa de entrada de ${testEmail}`
      });
    } catch (error) {
      console.error('Erro ao enviar email de teste:', error);
      toast({
        title: "Erro no teste",
        description: "Erro ao enviar email de teste. Verifique as configurações.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const updateAlertConfig = (index: number, field: string, value: any) => {
    const updatedAlerts = [...alerts];
    if (field.includes('.')) {
      const [parentField, childField] = field.split('.');
      const currentParent = updatedAlerts[index][parentField as keyof AlertConfig];
      updatedAlerts[index] = {
        ...updatedAlerts[index],
        [parentField]: {
          ...(typeof currentParent === 'object' && currentParent ? currentParent : {}),
          [childField]: value
        }
      };
    } else {
      updatedAlerts[index] = {
        ...updatedAlerts[index],
        [field]: value
      };
    }
    setAlerts(updatedAlerts);
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'system': return <Settings className="h-4 w-4" />;
      case 'appointment': return <Bell className="h-4 w-4" />;
      case 'critical': return <AlertCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertTypeBadge = (type: string) => {
    const variants = {
      system: 'default',
      appointment: 'secondary', 
      critical: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || 'default'}>
        {getAlertTypeIcon(type)}
        <span className="ml-1 capitalize">{type}</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sistema de Alertas</h2>
          <p className="text-muted-foreground">
            Configure alertas automáticos via Gmail SMTP
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Gmail SMTP
        </Badge>
      </div>

      {/* Teste de Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Teste do Sistema
          </CardTitle>
          <CardDescription>
            Envie um email de teste para verificar se a configuração está funcionando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="testEmail">Email para teste</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={sendTestAlert}
                disabled={isTesting || !testEmail}
              >
                {isTesting ? 'Enviando...' : 'Enviar Teste'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Alertas */}
      <div className="grid gap-4">
        {alerts.map((alert, index) => (
          <Card key={`${alert.type}-${index}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getAlertTypeBadge(alert.type)}
                  <span className="capitalize">{alert.type} Alerts</span>
                </div>
                <Switch
                  checked={alert.enabled}
                  onCheckedChange={(enabled) => updateAlertConfig(index, 'enabled', enabled)}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`email-${index}`}>Email de destino</Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  value={alert.email}
                  onChange={(e) => updateAlertConfig(index, 'email', e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Condições de Alerta</Label>
                <div className="space-y-2">
                  {alert.type === 'system' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Sistema fora do ar</span>
                        <Switch
                          checked={alert.conditions.systemDown || false}
                          onCheckedChange={(checked) => 
                            updateAlertConfig(index, 'conditions.systemDown', checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Problemas no banco de dados</span>
                        <Switch
                          checked={alert.conditions.databaseIssues || false}
                          onCheckedChange={(checked) => 
                            updateAlertConfig(index, 'conditions.databaseIssues', checked)
                          }
                        />
                      </div>
                    </>
                  )}
                  
                  {alert.type === 'appointment' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Conflitos de agendamento</span>
                      <Switch
                        checked={alert.conditions.appointmentConflicts || false}
                        onCheckedChange={(checked) => 
                          updateAlertConfig(index, 'conditions.appointmentConflicts', checked)
                        }
                      />
                    </div>
                  )}
                  
                  {alert.type === 'critical' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Erros críticos</span>
                      <Switch
                        checked={alert.conditions.criticalErrors || false}
                        onCheckedChange={(checked) => 
                          updateAlertConfig(index, 'conditions.criticalErrors', checked)
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              <Button 
                onClick={() => saveAlertConfig(alert)}
                disabled={isLoading}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Salvar Configuração
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};