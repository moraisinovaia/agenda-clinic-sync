import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Zap, MessageSquare } from "lucide-react";

interface TesteResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp?: string;
}

export function WhatsAppTesteRapido() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<TesteResult | null>(null);
  const [tentativas, setTentativas] = useState(0);
  const { toast } = useToast();
  
  const celular = '87991311991';

  const executarTeste = async () => {
    const novaTentativa = tentativas + 1;
    setTentativas(novaTentativa);
    setLoading(true);
    
    console.log(`🚀 [TENTATIVA ${novaTentativa}] Testando WhatsApp para ${celular}`);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-teste-simples', {
        body: { celular }
      });

      console.log('📊 Resultado da função:', { data, error });

      if (error) {
        console.error('❌ Erro na invocação:', error);
        throw new Error(error.message || 'Erro desconhecido na função');
      }

      const result = data as TesteResult;
      result.timestamp = new Date().toLocaleString('pt-BR');
      
      setResultado(result);

      if (result.success) {
        console.log('✅ SUCESSO! WhatsApp enviado');
        toast({
          title: "🚀 SUCESSO! WhatsApp ENVIADO!",
          description: `Mensagem de teste enviada para ${celular}`,
          duration: 5000,
        });
      } else {
        console.log('❌ FALHA:', result.message);
        toast({
          title: "❌ Falha no envio",
          description: result.message,
          variant: "destructive",
          duration: 8000,
        });
      }
      
    } catch (error: any) {
      console.error('❌ Erro geral:', error);
      
      const errorResult: TesteResult = {
        success: false,
        message: `Erro: ${error.message}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        details: error
      };
      
      setResultado(errorResult);
      
      toast({
        title: "❌ Erro no teste",
        description: error.message,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-executar ao carregar
  useEffect(() => {
    console.log('🔥 Componente de teste rápido carregado');
    const timer = setTimeout(() => {
      console.log('⏰ Executando teste automático...');
      executarTeste();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Teste Rápido WhatsApp
        </CardTitle>
        <CardDescription>
          Teste automático para {celular} - Tentativa #{tentativas}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button 
            onClick={executarTeste}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                TESTAR AGORA #{tentativas + 1}
              </>
            )}
          </Button>
          
          <Badge variant={loading ? "secondary" : (resultado?.success ? "default" : "destructive")}>
            {loading ? "Testando..." : (resultado?.success ? "✅ FUNCIONOU" : "❌ Com problema")}
          </Badge>
        </div>

        {resultado && (
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-start gap-2 mb-2">
              {resultado.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <div className="font-medium">
                  {resultado.success ? "✅ WhatsApp FUNCIONANDO!" : "❌ Problema detectado"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {resultado.message}
                </div>
                {resultado.timestamp && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {resultado.timestamp}
                  </div>
                )}
              </div>
            </div>
            
            {resultado.details && (
              <details className="mt-2">
                <summary className="text-sm cursor-pointer text-muted-foreground">
                  Ver detalhes técnicos
                </summary>
                <pre className="text-xs mt-2 p-2 bg-background rounded overflow-auto">
                  {JSON.stringify(resultado.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          💡 <strong>Como funciona:</strong> Este teste envia uma mensagem real de WhatsApp para verificar se todo o sistema está operacional.
          Se você receber a mensagem, significa que está tudo funcionando perfeitamente!
        </div>
      </CardContent>
    </Card>
  );
}