import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, CheckCircle, XCircle, Clock, User, Bot } from 'lucide-react';

interface APIResponse {
  success: boolean;
  message?: string;
  error?: string;
  [key: string]: any;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  response?: APIResponse;
}

const API_BASE_URL = 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8'
};

export const WhatsAppAgentDashboard = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('simulator');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Estados para teste de endpoints específicos
  const [testEndpoint, setTestEndpoint] = useState('schedule');
  const [testPayload, setTestPayload] = useState('');
  const [lastResponse, setLastResponse] = useState<APIResponse | null>(null);

  const simulateWhatsAppMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Detect intent and extract data
      const intent = detectIntent(userMessage);
      const endpoint = getEndpointFromIntent(intent);
      const payload = extractDataFromMessage(userMessage, intent);

      let response: APIResponse;

      if (endpoint && payload) {
        // Make API call
        const apiResponse = await fetch(`${API_BASE_URL}/${endpoint}`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(payload)
        });
        
        response = await apiResponse.json();
      } else {
        response = {
          success: false,
          message: 'Não consegui entender sua solicitação. Por favor, seja mais específico.',
          error: 'Intent não detectado ou dados insuficientes'
        };
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: formatBotResponse(response, intent),
        timestamp: new Date(),
        response
      };

      setMessages(prev => [...prev, botMsg]);

      if (response.success) {
        toast({
          title: "✅ Sucesso",
          description: response.message || "Operação realizada com sucesso"
        });
      } else {
        toast({
          title: "❌ Erro",
          description: response.error || response.message || "Erro na operação",
          variant: "destructive"
        });
      }

    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
        response: { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
      };

      setMessages(prev => [...prev, errorMsg]);
      
      toast({
        title: "❌ Erro de Sistema",
        description: "Falha na comunicação com a API",
        variant: "destructive"
      });
    }

    setIsLoading(false);
  };

  const detectIntent = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('agendar') || lowerMsg.includes('marcar')) return 'schedule';
    if (lowerMsg.includes('consultar') || lowerMsg.includes('quando')) return 'check-patient';
    if (lowerMsg.includes('remarcar') || lowerMsg.includes('mudar')) return 'reschedule';
    if (lowerMsg.includes('cancelar')) return 'cancel';
    if (lowerMsg.includes('horarios') || lowerMsg.includes('disponivel')) return 'availability';
    if (lowerMsg.includes('buscar') || lowerMsg.includes('procurar')) return 'patient-search';
    
    return 'greeting';
  };

  const getEndpointFromIntent = (intent: string): string | null => {
    const endpoints = {
      'schedule': 'schedule',
      'check-patient': 'check-patient',
      'reschedule': 'reschedule',
      'cancel': 'cancel',
      'availability': 'availability',
      'patient-search': 'patient-search'
    };
    
    return endpoints[intent as keyof typeof endpoints] || null;
  };

  const extractDataFromMessage = (message: string, intent: string): any => {
    // Simplified extraction - in real implementation this would be more sophisticated
    switch (intent) {
      case 'schedule':
        return {
          paciente_nome: "João Silva",
          data_nascimento: "1990-01-15",
          convenio: "SUS",
          telefone: "11999999999",
          celular: "11999999999",
          medico_nome: "Dr. Max",
          atendimento_nome: "Teste Ergométrico",
          data_consulta: "2025-01-20",
          hora_consulta: "14:00",
          observacoes: "Agendamento via simulador WhatsApp"
        };
      
      case 'check-patient':
        return {
          paciente_nome: "João Silva",
          data_nascimento: "1990-01-15",
          celular: "11999999999"
        };
      
      case 'availability':
        return {
          medico_nome: "Dr. Max",
          data_consulta: "2025-01-20",
          periodo: "manha"
        };
      
      default:
        return null;
    }
  };

  const formatBotResponse = (response: APIResponse, intent: string): string => {
    if (!response.success) {
      return `❌ ${response.error || response.message || 'Erro na operação'}`;
    }

    switch (intent) {
      case 'schedule':
        return `✅ ${response.message}\n📅 Data: ${response.data || 'N/A'}\n⏰ Horário: ${response.hora || 'N/A'}\n👨‍⚕️ Médico: ${response.medico || 'N/A'}`;
      
      case 'check-patient':
        return `✅ ${response.message}\n📋 ${response.total || 0} consulta(s) encontrada(s)`;
      
      case 'availability':
        return `✅ ${response.message}\n📅 ${response.horarios_disponiveis?.length || 0} horários disponíveis`;
      
      default:
        return `✅ ${response.message || 'Operação realizada com sucesso'}`;
    }
  };

  const testEndpointDirectly = async () => {
    if (!testPayload.trim()) {
      toast({
        title: "❌ Erro",
        description: "Por favor, insira um payload JSON válido",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const payload = JSON.parse(testPayload);
      
      const response = await fetch(`${API_BASE_URL}/${testEndpoint}`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      setLastResponse(result);

      toast({
        title: result.success ? "✅ Sucesso" : "❌ Erro",
        description: result.message || result.error || 'Teste concluído',
        variant: result.success ? "default" : "destructive"
      });

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
      
      setLastResponse(errorResult);
      
      toast({
        title: "❌ Erro",
        description: "Erro ao fazer requisição ou parsear JSON",
        variant: "destructive"
      });
    }

    setIsLoading(false);
  };

  const examplePayloads = {
    schedule: {
      paciente_nome: "João Silva",
      data_nascimento: "1990-01-15",
      convenio: "SUS",
      telefone: "11999999999",
      celular: "11999999999",
      medico_nome: "Dr. Max",
      atendimento_nome: "Teste Ergométrico",
      data_consulta: "2025-01-20",
      hora_consulta: "14:00",
      observacoes: "Primeira consulta via API"
    },
    'check-patient': {
      paciente_nome: "João Silva",
      data_nascimento: "1990-01-15",
      celular: "11999999999"
    },
    availability: {
      medico_nome: "Dr. Max",
      data_consulta: "2025-01-20",
      periodo: "manha"
    }
  };

  const handleSendMessage = () => {
    simulateWhatsAppMessage(currentMessage);
    setCurrentMessage('');
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">WhatsApp Agent Dashboard</h2>
          <p className="text-muted-foreground">Teste e monitore as funcionalidades do agente LLM</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="simulator">Simulador WhatsApp</TabsTrigger>
          <TabsTrigger value="api-test">Teste de API</TabsTrigger>
        </TabsList>

        <TabsContent value="simulator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Simulador de Conversa WhatsApp
              </CardTitle>
              <CardDescription>
                Simule conversas com o agente como se fosse pelo WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chat Messages */}
              <div className="border rounded-lg p-4 bg-muted/30 min-h-[400px] max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Bot className="h-12 w-12 mb-2" />
                    <p>Nenhuma mensagem ainda</p>
                    <p className="text-sm">Digite uma mensagem para começar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 ${
                          msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <div className={`p-2 rounded-full ${
                          msg.type === 'user' ? 'bg-primary' : 'bg-secondary'
                        }`}>
                          {msg.type === 'user' ? (
                            <User className="h-4 w-4 text-primary-foreground" />
                          ) : (
                            <Bot className="h-4 w-4 text-secondary-foreground" />
                          )}
                        </div>
                        <div className={`max-w-[80%] ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                          <div
                            className={`p-3 rounded-lg ${
                              msg.type === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card border'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {msg.timestamp.toLocaleTimeString()}
                            {msg.response && (
                              <Badge variant={msg.response.success ? 'default' : 'destructive'} className="h-4">
                                {msg.response.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {isLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Bot className="h-4 w-4 animate-pulse" />
                    <span>Digitando...</span>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Digite sua mensagem como se fosse WhatsApp..."
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isLoading}
                  className="min-h-[60px]"
                />
                <div className="flex flex-col gap-2">
                  <Button onClick={handleSendMessage} disabled={isLoading || !currentMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={clearChat} disabled={messages.length === 0}>
                    Limpar
                  </Button>
                </div>
              </div>

              {/* Quick Examples */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentMessage("Gostaria de agendar uma consulta com Dr. Max para dia 20/01/2025 às 14:00h")}
                >
                  Exemplo: Agendar
                </Button>
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentMessage("Quero consultar meus agendamentos, meu nome é João Silva")}
                >
                  Exemplo: Consultar
                </Button>
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentMessage("Quais horários estão disponíveis com Dr. Max no dia 20/01?")}
                >
                  Exemplo: Disponibilidade
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-test" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Teste de Endpoint</CardTitle>
                <CardDescription>
                  Teste diretamente os endpoints da API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint</Label>
                  <select
                    id="endpoint"
                    value={testEndpoint}
                    onChange={(e) => {
                      setTestEndpoint(e.target.value);
                      setTestPayload(JSON.stringify(examplePayloads[e.target.value as keyof typeof examplePayloads] || {}, null, 2));
                    }}
                    className="w-full p-2 border border-input rounded-md"
                  >
                    <option value="schedule">schedule (Agendar)</option>
                    <option value="check-patient">check-patient (Consultar)</option>
                    <option value="reschedule">reschedule (Remarcar)</option>
                    <option value="cancel">cancel (Cancelar)</option>
                    <option value="availability">availability (Disponibilidade)</option>
                    <option value="patient-search">patient-search (Buscar)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payload">Payload JSON</Label>
                  <Textarea
                    id="payload"
                    placeholder="Insira o JSON do payload..."
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>

                <Button onClick={testEndpointDirectly} disabled={isLoading} className="w-full">
                  {isLoading ? 'Testando...' : 'Testar Endpoint'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Última Resposta</CardTitle>
                <CardDescription>
                  Resposta do último teste realizado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lastResponse ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {lastResponse.success ? (
                        <Badge className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Erro
                        </Badge>
                      )}
                    </div>
                    
                    <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(lastResponse, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Nenhum teste realizado ainda</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>
              <strong>URL Base:</strong> {API_BASE_URL}<br />
              <strong>Autenticação:</strong> Bearer Token configurado<br />
              <strong>Endpoints disponíveis:</strong> schedule, check-patient, reschedule, cancel, availability, patient-search
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};