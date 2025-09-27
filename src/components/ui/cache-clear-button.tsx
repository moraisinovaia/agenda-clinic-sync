import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cacheManager } from '@/utils/cacheManager';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CacheClearButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showDialog?: boolean;
}

export const CacheClearButton: React.FC<CacheClearButtonProps> = ({
  variant = 'outline',
  size = 'sm',
  className = '',
  showDialog = true
}) => {
  const [isClearing, setIsClearing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleClearCache = async () => {
    setIsClearing(true);
    
    try {
      const success = await cacheManager.clearAllCache();
      
      if (success) {
        toast({
          title: '✅ Cache limpo com sucesso',
          description: 'A página será recarregada para aplicar as mudanças.',
        });
        
    // Aguardar um momento antes de recarregar
    setTimeout(() => {
      window.location.reload();
    }, 1000);
      } else {
        toast({
          title: '⚠️ Problema ao limpar cache',
          description: 'Tente recarregar a página manualmente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      toast({
        title: '❌ Erro ao limpar cache',
        description: 'Tente recarregar a página manualmente.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
      setIsDialogOpen(false);
    }
  };

  const handleForceReload = async () => {
    setIsClearing(true);
    
    try {
      await cacheManager.forceReload();
    } catch (error) {
      console.error('Erro ao forçar recarregamento:', error);
      window.location.reload();
    }
  };

  if (!showDialog) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClearCache}
        disabled={isClearing}
      >
        {isClearing ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        <span className="ml-2">Limpar Cache</span>
      </Button>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
        >
          <Trash2 className="h-4 w-4" />
          {size !== 'icon' && <span className="ml-2">Limpar Cache</span>}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Limpar Cache do Navegador
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Esta ação irá limpar todos os dados em cache da aplicação e recarregar a página.
            </p>
            <div className="bg-muted p-3 rounded text-sm">
              <p className="font-medium mb-1">💡 Isso pode ajudar com:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Erros de "removeChild" no Chrome</li>
                <li>Problemas de carregamento de páginas</li>
                <li>Dados antigos em cache</li>
                <li>Problemas de performance</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isClearing}
          >
            Cancelar
          </Button>
          
          <Button
            variant="secondary"
            onClick={handleClearCache}
            disabled={isClearing}
            className="flex items-center gap-2"
          >
            {isClearing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Limpar e Recarregar
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleForceReload}
            disabled={isClearing}
            className="flex items-center gap-2"
          >
            {isClearing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Força Total
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};