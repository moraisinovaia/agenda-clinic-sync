import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function TestLogin() {
  const { user, profile } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testUsernameLogin = async () => {
    addTestResult('Testando login com username...');
    try {
      // Primeiro vamos verificar se há algum profile com username
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .not('username', 'is', null);
      
      addTestResult(`Encontrados ${profiles?.length || 0} profiles com username`);
      
      if (profiles && profiles.length > 0) {
        addTestResult(`Exemplo: username "${profiles[0].username}" para ${profiles[0].nome}`);
      }
    } catch (error) {
      addTestResult(`Erro no teste: ${error}`);
    }
  };

  const testProfileFetch = async () => {
    if (!user) {
      addTestResult('Usuário não logado');
      return;
    }

    addTestResult('Testando busca de profile...');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        addTestResult(`Erro ao buscar profile: ${error.message}`);
      } else {
        addTestResult(`Profile encontrado: ${data.nome} (username: ${data.username || 'não definido'})`);
      }
    } catch (error) {
      addTestResult(`Erro no teste: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle>Teste de Login/Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p><strong>Usuário logado:</strong> {user ? user.email : 'Nenhum'}</p>
          <p><strong>Profile:</strong> {profile ? `${profile.nome} (${profile.username || 'sem username'})` : 'Nenhum'}</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={testUsernameLogin} variant="outline">
            Testar Username
          </Button>
          <Button onClick={testProfileFetch} variant="outline" disabled={!user}>
            Testar Profile
          </Button>
          <Button onClick={clearResults} variant="outline">
            Limpar
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="bg-muted p-4 rounded max-h-40 overflow-y-auto">
            <h4 className="font-medium mb-2">Resultados:</h4>
            {testResults.map((result, index) => (
              <div key={index} className="text-sm font-mono">
                {result}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}