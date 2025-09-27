import React, { Component, ReactNode } from 'react';
import { DOMErrorHandler } from './DOMErrorHandler';
import { CacheClearButton } from '@/components/ui/cache-clear-button';

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
    console.log('🔄 SchedulingErrorBoundary: Erro capturado:', error?.message);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 SchedulingErrorBoundary capturou erro crítico:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    return (
      <DOMErrorHandler
        fallback={
          <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Sistema de Agendamento Temporariamente Indisponível</h3>
              <p className="text-muted-foreground mb-4">
                Detectamos um problema técnico. Tente limpar o cache do navegador.
              </p>
              <CacheClearButton size="lg" variant="default" />
            </div>
          </div>
        }
      >
        {this.props.children}
      </DOMErrorHandler>
    );
  }
}