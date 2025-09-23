import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useClientTables } from '@/hooks/useClientTables';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Building2, Check } from 'lucide-react';
import { toast } from 'sonner';

export const SuperAdminClientSelector = () => {
  const { isSuperAdmin } = useStableAuth();
  const { selectedClient, setSelectedClient } = useClientTables();

  if (!isSuperAdmin) return null;

  const handleClientSelect = (client: 'INOVAIA' | 'IPADO') => {
    setSelectedClient(client);
    toast.success(`Cliente alterado para ${client}`, {
      description: 'Recarregando página para aplicar mudanças...'
    });
    
    // Forçar reload da página para aplicar mudanças
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Seletor de Cliente</CardTitle>
          <Badge variant="secondary" className="text-xs">
            Super Admin
          </Badge>
        </div>
        <CardDescription>
          Escolha qual cliente acessar no sistema
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleClientSelect('INOVAIA')}
            variant={selectedClient === 'INOVAIA' ? 'default' : 'outline'}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-2">
              {selectedClient === 'INOVAIA' && <Check className="h-4 w-4" />}
              <span className="font-medium">InovAIA</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Tabelas principais
            </div>
          </Button>

          <Button
            onClick={() => handleClientSelect('IPADO')}
            variant={selectedClient === 'IPADO' ? 'default' : 'outline'}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-2">
              {selectedClient === 'IPADO' && <Check className="h-4 w-4" />}
              <span className="font-medium">IPADO</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Tabelas ipado_*
            </div>
          </Button>
        </div>

        {selectedClient && (
          <div className="p-3 bg-muted/30 rounded-md">
            <div className="text-xs text-muted-foreground">
              Cliente ativo: <span className="font-medium text-foreground">{selectedClient}</span>
            </div>
          </div>
        )}

        {!selectedClient && (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
            <div className="text-xs text-warning-foreground">
              ⚠️ Nenhum cliente selecionado - usando InovAIA como padrão
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};