import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Search, Eye, Filter } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';

interface AuditLog {
  id: string;
  action: string;
  target_client_id?: string;
  target_user_id?: string;
  details?: any;
  created_at: string;
  admin_id: string;
}

interface AuditLogProps {
  logs: AuditLog[];
}

export const AuditLog = ({ logs }: AuditLogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionColor = (action: string) => {
    if (action.includes('APPROVE')) return 'default';
    if (action.includes('REJECT') || action.includes('DELETE')) return 'destructive';
    if (action.includes('CREATE') || action.includes('ADD')) return 'default';
    if (action.includes('UPDATE') || action.includes('SWITCH')) return 'secondary';
    return 'outline';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('APPROVE')) return '✅';
    if (action.includes('REJECT')) return '❌';
    if (action.includes('CREATE')) return '➕';
    if (action.includes('DELETE')) return '🗑️';
    if (action.includes('UPDATE')) return '✏️';
    if (action.includes('SWITCH')) return '🔄';
    return '📝';
  };

  const formatAction = (action: string) => {
    const actionMap: { [key: string]: string } = {
      'BULK_APPROVE_USERS': 'Aprovação em Lote de Usuários',
      'BULK_REJECT_USERS': 'Rejeição em Lote de Usuários',
      'CLIENT_SWITCH': 'Troca de Cliente',
      'USER_APPROVE': 'Aprovação de Usuário',
      'USER_REJECT': 'Rejeição de Usuário',
      'CREATE_USER': 'Criação de Usuário',
      'UPDATE_USER': 'Atualização de Usuário',
      'DELETE_USER': 'Exclusão de Usuário',
    };
    return actionMap[action] || action.replace(/_/g, ' ').toLowerCase();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Log de Auditoria
            </CardTitle>
            <Badge variant="secondary">
              {logs.length} registros
            </Badge>
          </div>
          
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ação ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? 'Nenhum log encontrado' : 'Nenhum log de auditoria disponível'}
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getActionIcon(log.action)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{formatAction(log.action)}</p>
                        <Badge variant={getActionColor(log.action)} className="text-xs">
                          {log.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {log.details && Object.keys(log.details).length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {log.details.count ? `${log.details.count} itens` : 'Com detalhes'}
                      </Badge>
                    )}
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <span className="text-lg">{getActionIcon(log.action)}</span>
                            {formatAction(log.action)}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium">ID do Log</p>
                              <p className="text-sm text-muted-foreground font-mono">{log.id}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Data/Hora</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                              </p>
                            </div>
                            {log.target_client_id && (
                              <div>
                                <p className="text-sm font-medium">Cliente Alvo</p>
                                <p className="text-sm text-muted-foreground font-mono">{log.target_client_id}</p>
                              </div>
                            )}
                            {log.target_user_id && (
                              <div>
                                <p className="text-sm font-medium">Usuário Alvo</p>
                                <p className="text-sm text-muted-foreground font-mono">{log.target_user_id}</p>
                              </div>
                            )}
                          </div>
                          
                          {log.details && (
                            <div>
                              <p className="text-sm font-medium mb-2">Detalhes</p>
                              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};