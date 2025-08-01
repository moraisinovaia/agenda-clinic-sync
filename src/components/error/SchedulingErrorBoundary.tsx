import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  static getDerivedStateFromError(error: Error): State {
    // CRITICAL: Não interceptar erros de validação/conflito
    // Estes devem ser tratados pelo próprio formulário
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('já está ocupado') || 
        errorMessage.includes('bloqueada') ||
        errorMessage.includes('idade') ||
        errorMessage.includes('convênio') ||
        errorMessage.includes('obrigatório') ||
        errorMessage.includes('inválido') ||
        errorMessage.includes('conflito')) {
      console.log('🔄 SchedulingErrorBoundary: Erro de validação ignorado - deixando formulário tratar');
      return { hasError: false, error: null };
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 SchedulingErrorBoundary capturou erro:', error, errorInfo);
    
    // Verificar se é erro de validação
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('já está ocupado') || 
        errorMessage.includes('bloqueada') ||
        errorMessage.includes('idade') ||
        errorMessage.includes('convênio') ||
        errorMessage.includes('obrigatório') ||
        errorMessage.includes('inválido') ||
        errorMessage.includes('conflito')) {
      console.log('🔄 SchedulingErrorBoundary: Ignorando erro de validação');
      return;
    }
    
    // Prevenir qualquer possível reload da página
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = '';
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-4xl mx-auto p-4">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Erro no sistema de agendamento</p>
                <p className="text-sm">
                  {this.state.error?.message || 'Ocorreu um erro inesperado. Seus dados foram preservados.'}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleRetry}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}