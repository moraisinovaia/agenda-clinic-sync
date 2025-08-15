import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Clock, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface N8nLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  context: string;
  data: any;
}

export function N8nWebhookMonitor() {
  const [logs, setLogs] = useState<N8nLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    errors: 0,
    today: 0
  });
  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // Buscar logs do N8N webhook
      const { data: logsData, error: logsError } = await supabase
        .from('system_logs')
        .select('*')
        .in('context', ['N8N_WEBHOOK', 'N8N_TRIGGER', 'N8N_WEBHOOK_ERROR', 'N8N_TRIGGER_ERROR'])
        .order('timestamp', { ascending: false })
        .limit(20);

      if (logsError) throw logsError;
      setLogs(logsData || []);

      // Calcular estatísticas
      const success = logsData?.filter(log => log.level === 'info' && log.context.includes('WEBHOOK')).length || 0;
      const errors = logsData?.filter(log => log.level === 'error').length || 0;
      const today = logsData?.filter(log => 
        new Date(log.timestamp).toDateString() === new Date().toDateString()
      ).length || 0;

      setStats({
        total: (logsData?.length || 0),
        success,
        errors,
        today
      });

    } catch (error: any) {
      console.error('Erro ao buscar logs N8N:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar logs do webhook N8N",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleWebhook = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: enabled.toString() })
        .eq('key', 'n8n_webhook_enabled');

      if (error) throw error;

      setWebhookEnabled(enabled);
      toast({
        title: "Configuração atualizada",
        description: `Webhook N8N ${enabled ? 'habilitado' : 'desabilitado'} com sucesso`,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar configuração:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar configuração do webhook",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Buscar configuração atual
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'n8n_webhook_enabled')
      .single()
      .then(({ data }) => {
        if (data) {
          setWebhookEnabled(data.value === 'true');
        }
      });

    // Auto-refresh a cada 30 segundos
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-500/10 text-red-700 border-red-200';
      default:
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header e Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Sucessos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Monitor N8N Webhook
              </CardTitle>
              <CardDescription>
                Sistema automático de envio de agendamentos para N8N
              </CardDescription>
            </div>
            <Button
              onClick={fetchLogs}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="webhook-enabled"
              checked={webhookEnabled}
              onCheckedChange={toggleWebhook}
            />
            <Label htmlFor="webhook-enabled">
              Webhook N8N {webhookEnabled ? 'Habilitado' : 'Desabilitado'}
            </Label>
            <Badge variant={webhookEnabled ? 'default' : 'secondary'}>
              {webhookEnabled ? 'ATIVO' : 'INATIVO'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            URL: https://n8n.inovaia.online/webhook-test/whatsapp-webhook
          </p>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs Recentes</CardTitle>
          <CardDescription>
            Últimos 20 eventos do webhook N8N
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Carregando logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum log encontrado</p>
              <p className="text-sm">Crie um agendamento para ver os logs aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getLevelIcon(log.level)}
                      <Badge className={getLevelColor(log.level)}>
                        {log.level.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{log.context}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm">{log.message}</p>
                  
                  {log.data && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver detalhes
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}