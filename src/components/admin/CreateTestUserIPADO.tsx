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
      console.log('🔄 Criando usuário teste para IPADO...');
      
      // 1. Primeiro, verificar se já existe
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'teste@ipado.com')
        .single();

      if (existingUser) {
        toast({
          title: 'Usuário já existe',
          description: 'O usuário teste para IPADO já foi criado',
        });
        setTestUserCreated(true);
        return;
      }

      // 2. Criar usuário via signup
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: 'teste@ipado.com',
        password: 'senha123456',
        options: {
          data: {
            nome: 'Usuário Teste IPADO',
            username: 'teste_ipado'
          }
        }
      });

      if (signupError) {
        throw new Error(`Erro no signup: ${signupError.message}`);
      }

      if (!signupData.user) {
        throw new Error('Usuário não foi criado no signup');
      }

      console.log('✅ Usuário criado no auth:', signupData.user.id);

      // 3. Aguardar um pouco para o perfil ser criado via trigger
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Buscar cliente IPADO
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', 'IPADO')
        .single();

      if (clienteError || !clienteData) {
        // Criar cliente IPADO se não existir
        const { data: novoCliente, error: criarClienteError } = await supabase
          .from('clientes')
          .insert({
            nome: 'IPADO',
            ativo: true,
            configuracoes: { tipo: 'clinica', sistema_origem: 'manual' }
          })
          .select()
          .single();

        if (criarClienteError) {
          throw new Error(`Erro ao criar cliente IPADO: ${criarClienteError.message}`);
        }

        console.log('✅ Cliente IPADO criado:', novoCliente.id);
      }

      // 5. Aprovar usuário automaticamente usando a função RPC
      const { data: approvalData, error: approvalError } = await supabase.rpc('aprovar_usuario', {
        p_user_id: signupData.user.id,
        p_aprovador_id: profile?.user_id,
        p_cliente_id: null // Vai usar IPADO como padrão
      });

      if (approvalError || !(approvalData as any)?.success) {
        console.error('Erro na aprovação:', approvalError, approvalData);
        throw new Error(`Erro na aprovação: ${(approvalData as any)?.error || approvalError?.message}`);
      }

      console.log('✅ Usuário aprovado automaticamente');

      toast({
        title: 'Usuário teste criado!',
        description: 'Email: teste@ipado.com | Senha: senha123456',
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