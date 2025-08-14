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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [celular, setCelular] = useState('87991311991');
  const { toast } = useToast();

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
      
      // Buscar logs recentes
      const { data: logsData } = await supabase
        .from('system_logs')
        .select('*')
        .like('context', '%WHATSAPP%')
        .order('timestamp', { ascending: false })
        .limit(5);
      
      setLogs((logsData || []) as LogEntry[]);
      
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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button 
                onClick={runDiagnostic}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                Diagnóstico
              </Button>
              
              <Button 
                onClick={testEdgeFunction}
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                Teste Trigger
              </Button>
              
              <Button 
                onClick={testFallback}
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
                Teste Fallback
              </Button>

              <Button 
                onClick={testDirectCall}
                disabled={loading}
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Teste Direto
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

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Logs Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start gap-2 p-2 border rounded">
                  <Badge variant={getBadgeVariant(log.level)}>
                    {log.level}
                  </Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{log.message}</div>
                    <div className="text-xs text-muted-foreground">{log.context}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}