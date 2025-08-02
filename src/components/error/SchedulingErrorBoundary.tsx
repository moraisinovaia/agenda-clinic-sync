import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SchedulingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // ✅ DETECÇÃO ESPECÍFICA: Não capturar erros de validação ou conflito
  static getDerivedStateFromError(error: Error): State {
    console.log('🛡️ SchedulingErrorBoundary: Erro capturado:', error.message);
    
    // Ignorar erros específicos que não devem quebrar o componente
    const ignoredErrors = [
      'conflito',
      'ocupado', 
      'validation',
      'validação',
      'form error',
      'já existe um agendamento'
    ];
    
    const shouldIgnore = ignoredErrors.some(ignored => 
      error.message.toLowerCase().includes(ignored)
    );
    
    if (shouldIgnore) {
      console.log('🟡 SchedulingErrorBoundary: Erro ignorado (validação/conflito)');
      return { hasError: false, error: null };
    }
    
    console.log('🔴 SchedulingErrorBoundary: Erro capturado para exibição');
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.log('🛡️ SchedulingErrorBoundary: componentDidCatch:', error, errorInfo);
    
    // ✅ PRESERVAR ESTADO: Não recarregar página para erros de agendamento
    if (error.message.includes('conflict') || error.message.includes('validation')) {
      console.log('🔒 SchedulingErrorBoundary: Preservando estado do formulário');
      // Prevent page reload
      return;
    }
  }

  handleRetry = () => {
    console.log('🔄 SchedulingErrorBoundary: Tentativa de retry');
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ocorreu um erro inesperado no sistema de agendamento.
              {this.state.error?.message && (
                <div className="mt-2 text-sm">
                  Detalhes: {this.state.error.message}
                </div>
              )}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={this.handleRetry}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}