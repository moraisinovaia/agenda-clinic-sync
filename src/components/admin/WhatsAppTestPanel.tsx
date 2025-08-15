import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Phone, MessageSquare, Settings } from "lucide-react";

interface DiagnosticResult {
  timestamp: string;
  extensoes: {
    net_available: boolean;
    http_available: boolean;
  };
  configuracao: {
    edge_function_url: string;
    trigger_exists: boolean;
  };
  recomendacoes: string[];
}

interface TestResult {
  test_id: string;
  success: boolean;
  response: any;
  message: string;
}

interface FallbackResult {
  success: boolean;
  status_code?: string;
  response?: any;
  message?: string;
  error?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: string;
  data?: any;
}

export function WhatsAppTestPanel() {
  const [loading, setLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [fallbackResult, setFallbackResult] = useState<FallbackResult | null>(null);
  const [celular, setCelular] = useState('87991311991');
  const [autoTestExecuted, setAutoTestExecuted] = useState(false);
  const { toast } = useToast();
  
  // Auto-executar teste avançado ao carregar
  React.useEffect(() => {
    if (!autoTestExecuted) {
      const autoTest = async () => {
        console.log('🚀 Executando teste simples automático do WhatsApp...');
        setAutoTestExecuted(true);
        await testSimplesAgora();
      };
      
      // Executar após 1 segundo
      const timer = setTimeout(autoTest, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoTestExecuted]);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('diagnosticar_whatsapp_sistema');
      if (error) throw error;
      
      setDiagnosticResult(data as unknown as DiagnosticResult);
      toast({
        title: "Diagnóstico concluído",
        description: "Verifique os resultados abaixo",
      });
    } catch (error: any) {
      console.error('Erro no diagnóstico:', error);
      toast({
        title: "Erro no diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testEdgeFunction = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('test_whatsapp_edge_function', {
        p_celular: celular,
        p_nome: 'Teste Manual',
        p_medico: 'Dr. Teste',
        p_atendimento: 'Consulta Teste'
      });
      
      if (error) throw error;
      
      const result = data as unknown as TestResult;
      setTestResult(result);
      
      // Teste concluído, sem necessidade de buscar logs
      
      toast({
        title: result?.success ? "Teste enviado!" : "Teste falhou",
        description: result?.message || "Teste executado",
        variant: result?.success ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testFallback = async () => {
    setLoading(true);
    try {
      // Buscar agendamento recente do usuário
      const { data: agendamentos } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('paciente_id', (await supabase
          .from('pacientes')
          .select('id')
          .eq('celular', celular)
          .single()).data?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!agendamentos?.length) {
        throw new Error('Nenhum agendamento encontrado para este celular');
      }

      const { data, error } = await supabase.rpc('enviar_whatsapp_fallback', {
        p_agendamento_id: agendamentos[0].id
      });
      
      if (error) throw error;
      
      const result = data as unknown as FallbackResult;
      setFallbackResult(result);
      
      toast({
        title: result?.success ? "Fallback enviado!" : "Fallback falhou",
        description: result?.error || result?.message || "Teste de fallback executado",
        variant: result?.success ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error('Erro no fallback:', error);
      toast({
        title: "Erro no fallback",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testDirectCall = async () => {
    setLoading(true);
    try {
      // Chamar edge function diretamente via client com dados de teste
      const { data, error } = await supabase.functions.invoke('whatsapp-confirmacao', {
        body: {
          agendamento_id: 'test-' + Date.now(),
          paciente_nome: 'Paciente Teste',
          celular: celular,
          medico_nome: 'Dr. Teste',
          atendimento_nome: 'Consulta de Teste',
          data_agendamento: new Date().toISOString().split('T')[0],
          hora_agendamento: '14:00',
          convenio: 'Particular',
          observacoes: 'TESTE DIRETO VIA CLIENT SUPABASE'
        }
      });

      if (error) throw error;

      const result = data as any;
      setTestResult({
        test_id: 'direct-call-' + Date.now(),
        success: result?.success || false,
        response: result,
        message: result?.message || 'Teste direto executado'
      });

      toast({
        title: result?.success ? "WhatsApp enviado via client!" : "Falha no envio via client",
        description: result?.message || "Teste direto via client executado",
        variant: result?.success ? "default" : "destructive",
      });
      
    } catch (error: any) {
      console.error('Erro no teste direto:', error);
      toast({
        title: "Erro no teste direto",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testSimplesAgora = async () => {
    console.log(`🧪 EXECUTANDO TESTE PARA ${celular}`);
    setAutoTestExecuted(true);
    setLoading(true);
    try {
      console.log('🧪 Executando teste simples agora...');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-teste-simples', {
        body: { celular }
      });

      if (error) {
        console.error('Erro na invocação:', error);
        throw error;
      }

      const result = data as any;
      
      setTestResult({
        test_id: 'simples-' + Date.now(),
        success: result?.success || false,
        response: result,
        message: result?.message || result?.error || 'Teste simples executado'
      });

      toast({
        title: result?.success ? "✅ WhatsApp FUNCIONANDO!" : "❌ WhatsApp com problema",
        description: result?.message || result?.error,
        variant: result?.success ? "default" : "destructive",
      });
      
    } catch (error: any) {
      console.error('Erro no teste simples:', error);
      
      setTestResult({
        test_id: 'error-' + Date.now(),
        success: false,
        response: error,
        message: `Erro: ${error.message}`
      });
      
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getBadgeVariant = (level: string) => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Painel de Teste WhatsApp
          </CardTitle>
          <CardDescription>
            Teste e diagnóstico do sistema de confirmação WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="celular">Número para teste</Label>
              <Input
                id="celular"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="87991311991"
              />
            </div>
            
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                🚀 Teste Automático Executando...
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Um teste será enviado automaticamente para <strong>{celular}</strong> em alguns segundos.
                Aguarde a mensagem no WhatsApp!
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={testSimplesAgora}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                🚀 TESTE AGORA
              </Button>
              
              <Button 
                onClick={runDiagnostic}
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                Diagnóstico
              </Button>

              <Button 
                onClick={testDirectCall}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                Teste Antigo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {diagnosticResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Resultado do Diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Extensões</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>net</span>
                    {diagnosticResult.extensoes.net_available ? 
                      <CheckCircle className="h-4 w-4 text-green-500" /> : 
                      <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </div>
                  <div className="flex items-center justify-between">
                    <span>http</span>
                    {diagnosticResult.extensoes.http_available ? 
                      <CheckCircle className="h-4 w-4 text-green-500" /> : 
                      <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Configuração</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Trigger</span>
                    {diagnosticResult.configuracao.trigger_exists ? 
                      <CheckCircle className="h-4 w-4 text-green-500" /> : 
                      <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="font-medium mb-2">Recomendações</h4>
              <ul className="space-y-1">
                {diagnosticResult.recomendacoes.map((rec: string, index: number) => (
                  <li key={index} className="text-sm text-muted-foreground">• {rec}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResult.success ? 
                <CheckCircle className="h-5 w-5 text-green-500" /> : 
                <XCircle className="h-5 w-5 text-red-500" />
              }
              Resultado do Teste Trigger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>Status:</strong> {testResult.success ? 'Sucesso' : 'Falha'}</div>
              <div><strong>Test ID:</strong> {testResult.test_id}</div>
              <div><strong>Response:</strong> {testResult.response}</div>
              <div><strong>Mensagem:</strong> {testResult.message}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {fallbackResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {fallbackResult.success ? 
                <CheckCircle className="h-5 w-5 text-green-500" /> : 
                <XCircle className="h-5 w-5 text-red-500" />
              }
              Resultado do Teste Fallback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>Status:</strong> {fallbackResult.success ? 'Sucesso' : 'Falha'}</div>
              {fallbackResult.status_code && <div><strong>Status Code:</strong> {fallbackResult.status_code}</div>}
              {fallbackResult.message && <div><strong>Mensagem:</strong> {fallbackResult.message}</div>}
              {fallbackResult.error && <div><strong>Erro:</strong> {fallbackResult.error}</div>}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}