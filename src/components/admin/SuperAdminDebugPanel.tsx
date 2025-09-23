import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStableAuth } from '@/hooks/useStableAuth';
import { useClientTables } from '@/hooks/useClientTables';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, RefreshCw, Database, User, Settings } from 'lucide-react';

export const SuperAdminDebugPanel = () => {
  const { user, profile, isSuperAdmin } = useStableAuth();
  const { selectedClient, getTables, checkClientType } = useClientTables();
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (!isSuperAdmin) return null;

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const clientType = await checkClientType();
      const tables = await getTables();
      
      setDebugInfo({
        timestamp: new Date().toLocaleString(),
        user: {
          id: user?.id,
          email: user?.email,
          created_at: user?.created_at
        },
        profile: {
          id: profile?.id,
          nome: profile?.nome,
          email: profile?.email,
          role: profile?.role,
          status: profile?.status,
          cliente_id: profile?.cliente_id,
          isSuperAdmin
        },
        clientInfo: {
          selectedClient,
          detectedClientType: clientType ? 'IPADO' : 'INOVAIA',
          tables
        }
      });
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      setDebugInfo({
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toLocaleString()
      });
    }
    setLoading(false);
  };

  return (
    <Card className="border-warning">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-warning" />
                <CardTitle className="text-sm">Super Admin Debug Panel</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Debug
                </Badge>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            <CardDescription>
              Sistema de diagnóstico para super-administrador
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={runDiagnostics}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Executar Diagnóstico
              </Button>
            </div>

            {debugInfo && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Último diagnóstico: {debugInfo.timestamp}
                </div>

                {debugInfo.error ? (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <div className="text-sm font-medium text-destructive">Erro no Diagnóstico</div>
                    <div className="text-xs text-destructive/80 mt-1">{debugInfo.error}</div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {/* User Info */}
                    <div className="p-3 bg-muted/30 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-3 w-3" />
                        <span className="text-xs font-medium">Usuário</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>ID: {debugInfo.user?.id}</div>
                        <div>Email: {debugInfo.user?.email}</div>
                      </div>
                    </div>

                    {/* Profile Info */}
                    <div className="p-3 bg-muted/30 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="h-3 w-3" />
                        <span className="text-xs font-medium">Perfil</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Nome: {debugInfo.profile?.nome}</div>
                        <div>Role: {debugInfo.profile?.role}</div>
                        <div>Status: {debugInfo.profile?.status}</div>
                        <div>Super Admin: {debugInfo.profile?.isSuperAdmin ? 'Sim' : 'Não'}</div>
                      </div>
                    </div>

                    {/* Client Info */}
                    <div className="p-3 bg-muted/30 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-3 w-3" />
                        <span className="text-xs font-medium">Cliente</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Selecionado: {debugInfo.clientInfo?.selectedClient || 'Nenhum'}</div>
                        <div>Detectado: {debugInfo.clientInfo?.detectedClientType}</div>
                      </div>
                      
                      {debugInfo.clientInfo?.tables && (
                        <div className="mt-2">
                          <div className="text-xs font-medium mb-1">Tabelas em uso:</div>
                          <div className="text-xs text-muted-foreground">
                            {Object.entries(debugInfo.clientInfo.tables).map(([key, value]) => (
                              <div key={key}>{key}: {value as string}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};