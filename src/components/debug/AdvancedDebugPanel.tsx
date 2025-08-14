import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Bug, AlertTriangle, CheckCircle } from 'lucide-react';

// Função global de diagnóstico completo
declare global {
  interface Window {
    debugAgendamentos: () => Promise<any>;
  }
}

const initializeGlobalDebug = () => {
  if (typeof window !== 'undefined') {
    window.debugAgendamentos = async () => {
      console.log('🔍 DIAGNÓSTICO AVANÇADO INICIADO');
      console.log('=====================================');
      
      try {
        // Verificar Supabase client
        console.log('📡 1. Verificando Supabase Client...');
        console.log('Supabase disponível:', !!supabase);
        console.log('Supabase configurado:', !!supabase);
        
        // Verificar autenticação
        console.log('🔐 2. Verificando Autenticação...');
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        console.log('Sessão ativa:', !!session);
        console.log('Usuário ID:', session?.user?.id);
        console.log('Erro auth:', authError);
        
        // Testar conexão direta com tabela
        console.log('📊 3. Testando Conexão Direta...');
        const { data, error, count } = await supabase
          .from('agendamentos')
          .select('*', { count: 'exact' });
        
        console.log('Query direta resultado:', {
          sucesso: !error,
          erro: error?.message,
          total: count,
          dadosRecebidos: data?.length,
          primeiroItem: data?.[0]
        });
        
        if (data && data.length > 0) {
          console.log('📋 Estrutura dos dados:', Object.keys(data[0]));
          
          // Verificar Dr. Edson especificamente  
          const edsonData = data.filter(apt => {
            return apt.medico_id === '2'; // Dr. Edson tem ID 2
          });
          
          console.log('👨‍⚕️ Agendamentos Dr. Edson:', {
            total: edsonData.length,
            dados: edsonData.slice(0, 5).map(apt => ({
              id: apt.id,
              data: apt.data_agendamento,
              medico_id: apt.medico_id
            }))
          });
          
          // Verificar 09/09/2025 especificamente
          const sept9Data = data.filter(apt => {
            if (apt.data_agendamento) {
              const formatted = new Date(apt.data_agendamento).toISOString().split('T')[0];
              return formatted === '2025-09-09';
            }
            return false;
          });
          
          console.log('📅 Agendamentos 09/09/2025:', {
            total: sept9Data.length,
            dados: sept9Data.slice(0, 3)
          });
        }
        
        // Testar RPC se existir
        console.log('⚙️ 4. Testando RPC...');
        try {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('buscar_agendamentos_otimizado');
          
          console.log('RPC resultado:', {
            sucesso: !rpcError,
            erro: rpcError?.message,
            dadosRecebidos: rpcData?.length,
            primeiroItem: rpcData?.[0]
          });
          
        } catch (err: any) {
          console.log('⚠️ RPC não disponível ou erro:', err.message);
        }
        
        // Verificar políticas RLS
        console.log('🛡️ 5. Testando RLS (Row Level Security)...');
        try {
          const { data: rls } = await supabase
            .from('agendamentos')
            .select('id')
            .limit(1);
          
          console.log('RLS test:', rls ? '✅ Acesso permitido' : '❌ Acesso negado');
        } catch (err: any) {
          console.log('❌ RLS bloqueando acesso:', err.message);
        }
        
        // 🚨 VERIFICAR AUTH DEADLOCK
        console.log('🚨 6. Verificando Auth Deadlock...');
        const scripts = document.querySelectorAll('script');
        let foundAsyncCallback = false;
        
        scripts.forEach(script => {
          if (script.textContent && script.textContent.includes('onAuthStateChange')) {
            if (script.textContent.includes('async (event, session)')) {
              foundAsyncCallback = true;
              console.warn('⚠️ PROBLEMA ENCONTRADO: Callback async em onAuthStateChange');
              console.warn('🔧 SOLUÇÃO: Usar setTimeout para evitar deadlock');
            }
          }
        });
        
        console.log('Auth Deadlock:', foundAsyncCallback ? '❌ DETECTADO' : '✅ OK');
        
        console.log('=====================================');
        console.log('✅ DIAGNÓSTICO CONCLUÍDO - Verifique os logs acima');
        
        return {
          supabaseOk: !!supabase,
          sessionOk: !!session,
          dataCount: data?.length || 0,
          authDeadlock: foundAsyncCallback,
          timestamp: new Date().toISOString()
        };
        
      } catch (error: any) {
        console.error('❌ Erro no diagnóstico:', error);
        return {
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    };
  }
};

interface AdvancedDebugPanelProps {
  appointments?: any[];
  selectedDoctor?: any;
  currentDate?: string;
}

export const AdvancedDebugPanel: React.FC<AdvancedDebugPanelProps> = ({ 
  appointments = [], 
  selectedDoctor, 
  currentDate 
}) => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expanded, setExpanded] = useState(true);

  React.useEffect(() => {
    initializeGlobalDebug();
  }, []);

  const runCompleteDebug = async () => {
    setIsRunning(true);
    try {
      const result = await window.debugAgendamentos();
      setDebugInfo(result);
    } catch (err: any) {
      console.error('Erro no debug:', err);
      setDebugInfo({ error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  const clearCacheAndReload = () => {
    if (confirm('🚨 LIMPEZA TOTAL\n\nIsso vai:\n• Limpar todo cache\n• Recarregar página\n• Forçar nova busca\n\nContinuar?')) {
      localStorage.clear();
      sessionStorage.clear();
      
      // Limpar cache do service worker se existir
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => registration.unregister());
        });
      }
      
      // Limpar cache do browser
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => caches.delete(cacheName));
        });
      }
      
      setTimeout(() => {
        window.location.href = window.location.href + '?nocache=' + Date.now();
      }, 500);
    }
  };

  const testDirectSupabase = async () => {
    console.log('🧪 TESTE DIRETO SUPABASE');
    
    try {
      // Teste 1: Verificar se tabela existe
      const { data, error } = await supabase
        .from('agendamentos')
        .select('count', { count: 'exact', head: true });
      
      console.log('📊 Tabela agendamentos:', { 
        existe: !error, 
        erro: error?.message,
        total: data 
      });
      
      // Teste 2: Buscar todos os dados
      const { data: allData, error: allError } = await supabase
        .from('agendamentos')
        .select('*')
        .limit(10);
      
      console.log('📋 Todos os agendamentos:', {
        sucesso: !allError,
        total: allData?.length,
        dados: allData?.slice(0, 3) // Primeiros 3
      });
      
      // Teste 3: Verificar estrutura
      if (allData && allData.length > 0) {
        console.log('🏗️ Estrutura da tabela:', Object.keys(allData[0]));
      }
      
      alert(`✅ Teste concluído!\nTotal encontrado: ${allData?.length || 0}\nVerifique o console para detalhes.`);
      
    } catch (err: any) {
      console.error('❌ Erro no teste:', err);
      alert('❌ Erro no teste. Verifique console.');
    }
  };

  return (
    <Card className="fixed top-4 right-4 z-50 w-96 bg-gradient-to-br from-blue-900 to-purple-900 text-white border-white/20">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-white/20">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          <span className="font-bold">Debug Avançado</span>
          <span className="bg-red-500/80 text-xs px-2 py-1 rounded">
            PROBLEMA ATIVO
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
          className="text-white hover:bg-white/10"
        >
          {expanded ? '➖' : '➕'}
        </Button>
      </div>

      {/* Status rápido */}
      <div className="p-4">
        <div className="bg-black/30 p-3 rounded-lg mb-4">
          <div className="text-sm space-y-1">
            <div>📊 Total: <strong>{appointments?.length || 0}</strong></div>
            <div>👨‍⚕️ Médico: <strong>{selectedDoctor?.nome || 'Nenhum'}</strong></div>
            <div>📅 Data: <strong>{currentDate || 'Não definida'}</strong></div>
            <div className="text-red-400">
              🚨 Status: <strong>AGENDAMENTOS NÃO APARECEM</strong>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3">
            {/* Botões de ação */}
            <div className="space-y-2">
              <Button 
                onClick={runCompleteDebug}
                disabled={isRunning}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Executando...' : '🔍 DIAGNÓSTICO COMPLETO'}
              </Button>

              <Button 
                onClick={testDirectSupabase}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                🧪 Teste Direto Supabase
              </Button>

              <Button 
                onClick={clearCacheAndReload}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="sm"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                🚨 LIMPEZA TOTAL + RELOAD
              </Button>
            </div>

            {/* Resultado do debug */}
            {debugInfo && (
              <div className="bg-black/30 p-3 rounded-lg text-xs">
                <div className="font-bold mb-2">📋 Último Debug:</div>
                <div className="space-y-1">
                  <div>• Supabase: {debugInfo.supabaseOk ? '✅' : '❌'}</div>
                  <div>• Sessão: {debugInfo.sessionOk ? '✅' : '❌'}</div>
                  <div>• Dados: {debugInfo.dataCount || 0}</div>
                  {debugInfo.authDeadlock !== undefined && (
                    <div className={debugInfo.authDeadlock ? 'text-red-400' : 'text-green-400'}>
                      • Auth Deadlock: {debugInfo.authDeadlock ? '❌ DETECTADO' : '✅ OK'}
                    </div>
                  )}
                  <div>• Hora: {debugInfo.timestamp ? new Date(debugInfo.timestamp).toLocaleTimeString() : 'N/A'}</div>
                  {debugInfo.error && (
                    <div className="text-red-400">• Erro: {debugInfo.error}</div>
                  )}
                </div>
              </div>
            )}

            {/* Instruções */}
            <div className="bg-white/10 p-3 rounded-lg text-xs">
              <div className="font-bold mb-2">🎯 Próximos Passos:</div>
              <div className="space-y-1">
                <div>1. Execute "Diagnóstico Completo"</div>
                <div>2. Verifique console (F12)</div>
                <div>3. Se Auth Deadlock ❌, precisa corrigir useAuth</div>
                <div>4. Se necessário, use "Limpeza Total"</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AdvancedDebugPanel;