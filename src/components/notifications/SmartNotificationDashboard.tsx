import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bell, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Send,
  AlertTriangle
} from 'lucide-react';

interface NotificationAnalytics {
  total_sent: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  success_rate: number;
  daily_stats: Record<string, number>;
}

interface NotificationConfig {
  enabled: boolean;
  reminder_48h: boolean;
  reminder_24h: boolean;
  reminder_2h: boolean;
  reminder_15min: boolean;
  confirmation_enabled: boolean;
  followup_enabled: boolean;
  auto_optimization: boolean;
}

export const SmartNotificationDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [config, setConfig] = useState<NotificationConfig>({
    enabled: true,
    reminder_48h: true,
    reminder_24h: true,
    reminder_2h: true,
    reminder_15min: false,
    confirmation_enabled: true,
    followup_enabled: false,
    auto_optimization: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [processingNow, setProcessingNow] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar analytics
      const { data, error } = await supabase.functions.invoke('notification-scheduler', {
        body: { action: 'analytics' }
      });

      if (error) throw error;

      setAnalytics(data.analytics);
      
      // Carregar configurações (mock por enquanto)
      const savedConfig = localStorage.getItem('notification_config');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados das notificações',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processNotificationsNow = async () => {
    setProcessingNow(true);
    try {
      const { data, error } = await supabase.functions.invoke('notification-scheduler', {
        body: { action: 'process' }
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${data.sent} notificações enviadas com sucesso`,
      });

      await loadData();
    } catch (error) {
      console.error('Erro ao processar notificações:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar notificações',
        variant: 'destructive'
      });
    } finally {
      setProcessingNow(false);
    }
  };

  const updateConfig = (key: keyof NotificationConfig, value: boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    localStorage.setItem('notification_config', JSON.stringify(newConfig));
    
    toast({
      title: 'Configuração atualizada',
      description: 'As alterações foram salvas',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const typeLabels = {
    '48h': 'Lembrete 48h',
    '24h': 'Confirmação 24h',
    '2h': 'Lembrete 2h',
    '15min': 'Alerta Recepção',
    'confirmacao': 'Confirmações',
    'followup': 'Follow-up'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Notificações Inteligentes</h2>
          <p className="text-muted-foreground">
            Sistema automatizado de lembretes e confirmações
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={processNotificationsNow}
            disabled={processingNow}
            variant="outline"
          >
            {processingNow ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                Processando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Processar Agora
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Enviadas</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.total_sent || 0}</div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.success_rate || 0}%</div>
                <Progress value={analytics?.success_rate || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lembretes 24h</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.by_type['24h'] || 0}</div>
                <p className="text-xs text-muted-foreground">Confirmações enviadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sistema</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Badge variant={config.enabled ? "default" : "secondary"}>
                    {config.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Status do sistema</p>
              </CardContent>
            </Card>
          </div>

          {/* Tipos de Notificação */}
          <Card>
            <CardHeader>
              <CardTitle>Notificações por Tipo</CardTitle>
              <CardDescription>
                Distribuição de notificações enviadas por categoria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics?.by_type || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <span className="font-medium">{typeLabels[type] || type}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">{count}</span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ 
                            width: `${analytics?.total_sent ? (count / analytics.total_sent) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics?.by_status || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {status === 'sent' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="capitalize">{status}</span>
                      </div>
                      <Badge variant={status === 'sent' ? 'default' : 'destructive'}>
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Atividade Diária</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(analytics?.daily_stats || {})
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 7)
                    .map(([date, count]) => (
                    <div key={date} className="flex items-center justify-between text-sm">
                      <span>{new Date(date).toLocaleDateString('pt-BR')}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Configurações Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Configure o comportamento do sistema de notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Sistema Ativo</label>
                  <p className="text-xs text-muted-foreground">
                    Ativar/desativar todo o sistema de notificações
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => updateConfig('enabled', checked)}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Lembretes Automáticos</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm">Lembrete 48h antes</label>
                    <p className="text-xs text-muted-foreground">
                      Inclui preparos e confirmação inicial
                    </p>
                  </div>
                  <Switch
                    checked={config.reminder_48h}
                    onCheckedChange={(checked) => updateConfig('reminder_48h', checked)}
                    disabled={!config.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm">Confirmação 24h antes</label>
                    <p className="text-xs text-muted-foreground">
                      Solicita confirmação de presença
                    </p>
                  </div>
                  <Switch
                    checked={config.reminder_24h}
                    onCheckedChange={(checked) => updateConfig('reminder_24h', checked)}
                    disabled={!config.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm">Lembrete 2h antes</label>
                    <p className="text-xs text-muted-foreground">
                      Lembrete final com localização
                    </p>
                  </div>
                  <Switch
                    checked={config.reminder_2h}
                    onCheckedChange={(checked) => updateConfig('reminder_2h', checked)}
                    disabled={!config.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm">Alerta 15min (Recepção)</label>
                    <p className="text-xs text-muted-foreground">
                      Notifica a recepção quando paciente está chegando
                    </p>
                  </div>
                  <Switch
                    checked={config.reminder_15min}
                    onCheckedChange={(checked) => updateConfig('reminder_15min', checked)}
                    disabled={!config.enabled}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Recursos Avançados</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm">Confirmações Interativas</label>
                    <p className="text-xs text-muted-foreground">
                      Permite confirmar/cancelar via WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={config.confirmation_enabled}
                    onCheckedChange={(checked) => updateConfig('confirmation_enabled', checked)}
                    disabled={!config.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm">Follow-up Pós-Consulta</label>
                    <p className="text-xs text-muted-foreground">
                      Pesquisa de satisfação automática
                    </p>
                  </div>
                  <Switch
                    checked={config.followup_enabled}
                    onCheckedChange={(checked) => updateConfig('followup_enabled', checked)}
                    disabled={!config.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm">Otimização Automática</label>
                    <p className="text-xs text-muted-foreground">
                      Ajusta horários baseado no comportamento do paciente
                    </p>
                  </div>
                  <Switch
                    checked={config.auto_optimization}
                    onCheckedChange={(checked) => updateConfig('auto_optimization', checked)}
                    disabled={!config.enabled}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Mensagem</CardTitle>
              <CardDescription>
                Personalize as mensagens enviadas automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  A personalização de templates estará disponível em breve.
                </div>
                
                <div className="grid gap-4">
                  {Object.entries(typeLabels).map(([type, label]) => (
                    <div key={type} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{label}</h4>
                        <Badge variant="outline">Padrão</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Template otimizado para {label.toLowerCase()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};