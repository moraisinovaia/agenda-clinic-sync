import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';

export function CreateTestUserIPADO() {
  const [loading, setLoading] = useState(false);
  const [testUserCreated, setTestUserCreated] = useState(false);
  const { toast } = useToast();
  const { profile, isAdmin } = useStableAuth();

  const createTestUser = async () => {
    if (!isAdmin) {
      toast({
        title: 'Acesso negado',
        description: 'Apenas administradores podem criar usuários teste',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      console.log('🔄 Criando usuário teste para IPADO via RPC...');
      
      // Usar a nova função RPC robusta
      const { data: result, error } = await supabase.rpc('criar_usuario_teste_ipado');

      if (error) {
        throw new Error(`Erro na função RPC: ${error.message}`);
      }

      const typedResult = result as any;

      if (!typedResult?.success) {
        throw new Error(typedResult?.error || 'Erro desconhecido na criação do usuário');
      }

      console.log('✅ Resultado da criação:', typedResult);

      toast({
        title: 'Usuário teste criado!',
        description: `Email: ${typedResult.credentials.email} | Senha: ${typedResult.credentials.password}`,
      });

      setTestUserCreated(true);

    } catch (error: any) {
      console.error('❌ Erro ao criar usuário teste:', error);
      toast({
        title: 'Erro ao criar usuário teste',
        description: error.message || 'Erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Usuário Teste IPADO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {testUserCreated ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-4 w-4" />
              <span className="font-medium">Usuário teste criado!</span>
            </div>
            
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <div className="text-sm">
                <span className="font-medium">Email:</span> teste@ipado.com
              </div>
              <div className="text-sm">
                <span className="font-medium">Senha:</span> senha123456
              </div>
              <Badge variant="secondary" className="text-xs">
                Cliente: IPADO
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Use essas credenciais para testar o sistema IPADO</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Criar um usuário de teste pré-aprovado para acessar o sistema IPADO.
            </p>
            
            <Button 
              onClick={createTestUser} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando usuário...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar Usuário Teste
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}