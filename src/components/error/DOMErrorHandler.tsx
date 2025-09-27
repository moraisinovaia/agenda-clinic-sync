import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, ExternalLink, Chrome, Globe, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectBrowser, getBrowserSpecificSolutions } from '@/utils/browserDetection';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isDomError: boolean;
}

export class DOMErrorHandler extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      isDomError: false 
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const isDomError = error.message?.includes('removeChild') || 
                       error.message?.includes('appendChild') ||
                       error.message?.includes('DOM') ||
                       error.message?.includes('node');
    
    console.log('🔧 DOMErrorHandler: Erro DOM detectado:', {
      message: error.message,
      isDomError,
      stack: error.stack?.substring(0, 200)
    });
    
    return { 
      hasError: true, 
      error,
      isDomError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Detectar informações do navegador
    const browserInfo = detectBrowser();
    
    console.error('🚨 DOMErrorHandler - Erro DOM crítico:', {
      error: error.message,
      component: errorInfo.componentStack?.split('\n')[1],
      timestamp: new Date().toISOString(),
      browser: `${browserInfo.name} ${browserInfo.version}`,
      problematico: browserInfo.hasKnownIssues,
      issues: browserInfo.knownIssues,
      url: window.location.href
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isDomError: false });
  };

  handleClearCacheAndReload = () => {
    // Limpar localStorage e sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Recarregar forçando cache limpo
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const browserInfo = detectBrowser();
      const solutions = getBrowserSpecificSolutions(browserInfo);
      
      // Ícone do navegador
      const BrowserIcon = browserInfo.isChrome ? Chrome : 
                         browserInfo.isFirefox ? Globe :
                         browserInfo.isSafari ? Monitor : AlertCircle;

      return (
        <div className="w-full max-w-4xl mx-auto p-4">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-semibold">
                  {this.state.isDomError ? 'Erro de compatibilidade do navegador' : 'Erro no sistema'}
                </p>
                
                <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                  <BrowserIcon className="h-4 w-4" />
                  <span>Detectado: {browserInfo.name} {browserInfo.version}</span>
                  {browserInfo.hasKnownIssues && (
                    <span className="text-yellow-600 text-xs">⚠️ Problemas conhecidos</span>
                  )}
                </div>
                
                {this.state.isDomError ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      Detectamos um problema específico do seu navegador ({browserInfo.name}). 
                      Isso pode acontecer devido ao cache, extensões ou configurações específicas.
                    </p>
                    <div className="bg-muted p-3 rounded text-xs">
                      <p className="font-medium mb-2">💡 Soluções específicas para {browserInfo.name}:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {solutions.slice(0, 4).map((solution, index) => (
                          <li key={index}>{solution}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {browserInfo.hasKnownIssues && (
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs">
                        <p className="font-medium text-yellow-800 mb-1">⚠️ Problemas conhecidos nesta versão:</p>
                        <ul className="list-disc list-inside space-y-1 text-yellow-700">
                          {browserInfo.knownIssues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">
                    {this.state.error?.message || 'Ocorreu um erro inesperado.'}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleRetry}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Tentar Novamente
                  </Button>
                  
                  {this.state.isDomError && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={this.handleClearCacheAndReload}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Limpar Cache e Recarregar
                    </Button>
                  )}
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