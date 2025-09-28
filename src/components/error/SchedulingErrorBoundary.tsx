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
  errorInfo: React.ErrorInfo | null;
}

export class SchedulingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.log('🔄 SchedulingErrorBoundary: Erro capturado:', error?.message);
    
    // Log específico para erros de DOM (removeChild)
    if (error.message?.includes('removeChild') || error.message?.includes('Node')) {
      console.error('🚨 DOM Error detectado no agendamento:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
    
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    console.error('🚨 SchedulingErrorBoundary capturou erro crítico:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Log específico para erros relacionados a OAuth
    const userAgent = navigator.userAgent;
    const isGoogleAuth = document.querySelector('[data-testid="google-signin"]') !== null;
    
    if (isGoogleAuth || error.message?.includes('removeChild')) {
      console.error('🔍 Possível conflito Google OAuth + DOM:', {
        userAgent,
        hasGoogleElements: isGoogleAuth,
        domNodes: document.querySelectorAll('[id*="google"], [class*="google"]').length
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