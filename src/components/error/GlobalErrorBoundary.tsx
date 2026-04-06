import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePartnerBranding } from '@/hooks/usePartnerBranding';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  partnerName: string;
}

interface WrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class GlobalErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error caught by ErrorBoundary:', error);
    console.error('Error Info:', errorInfo);

    this.logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      partnerName: this.props.partnerName,
    };

    console.error('Error Data for Logging:', errorData);

    // TODO: Enviar para serviço externo de logs
    // logService.error(errorData);
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Ops! Algo deu errado</CardTitle>
              <CardDescription>
                Encontramos um erro inesperado no sistema {this.props.partnerName}. Nossa equipe foi notificada automaticamente.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium mb-1">Detalhes do erro:</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {this.state.error?.message || 'Erro desconhecido'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={this.handleRefresh}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Ir para Início
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Se o problema persistir, entre em contato com o suporte.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export function GlobalErrorBoundary({ children, fallback }: WrapperProps) {
  const { partnerName } = usePartnerBranding();

  return (
    <GlobalErrorBoundaryInner partnerName={partnerName} fallback={fallback}>
      {children}
    </GlobalErrorBoundaryInner>
  );
}