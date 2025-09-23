import { useState, useEffect } from 'react';
import { Wifi, Database, Zap, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SystemStatusPanelProps {
  className?: string;
}

export const SystemStatusPanel = ({ className }: SystemStatusPanelProps) => {
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected'>('connected');
  const [latency, setLatency] = useState(109);
  const [lastCheck, setLastCheck] = useState(new Date());

  // Simular verificação de status do sistema
  useEffect(() => {
    const checkSystemStatus = () => {
      // Verificar conexão
      setConnectionStatus(navigator.onLine ? 'online' : 'offline');
      
      // Simular latência (em um caso real, faria ping para o servidor)
      const randomLatency = Math.floor(Math.random() * 50) + 80; // 80-130ms
      setLatency(randomLatency);
      
      // Atualizar último check
      setLastCheck(new Date());
    };

    // Verificar imediatamente
    checkSystemStatus();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkSystemStatus, 30000);

    // Listener para mudanças de conexão
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 100) return 'text-green-600';
    if (ms < 200) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLatencyBadgeVariant = (ms: number): "default" | "secondary" | "destructive" | "outline" => {
    if (ms < 100) return 'default';
    if (ms < 200) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className={`w-full max-w-sm ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">Status do Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conexão */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className={`h-4 w-4 ${connectionStatus === 'online' ? 'text-green-600' : 'text-red-600'}`} />
            <span className="text-sm">Conexão</span>
          </div>
          <Badge 
            variant={connectionStatus === 'online' ? 'default' : 'destructive'}
            className="text-xs"
          >
            {connectionStatus === 'online' ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {/* Banco de Dados */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className={`h-4 w-4 ${dbStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`} />
            <span className="text-sm">Banco de Dados</span>
          </div>
          <Badge 
            variant={dbStatus === 'connected' ? 'default' : 'destructive'}
            className="text-xs"
          >
            {dbStatus === 'connected' ? 'Conectado' : 'Desconectado'}
          </Badge>
        </div>

        {/* Latência */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${getLatencyColor(latency)}`} />
            <span className="text-sm">Latência</span>
          </div>
          <Badge 
            variant={getLatencyBadgeVariant(latency)}
            className="text-xs"
          >
            {latency}ms
          </Badge>
        </div>

        {/* Última Verificação */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Última verificação</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTime(lastCheck)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};