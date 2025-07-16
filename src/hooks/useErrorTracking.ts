import { useEffect } from 'react';
import { logger } from '@/utils/logger';

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

interface ErrorTrackingOptions {
  enableReporting?: boolean;
  context?: string;
}

export const useErrorTracking = (options: ErrorTrackingOptions = {}) => {
  const { enableReporting = true, context } = options;

  useEffect(() => {
    if (!enableReporting) return;

    const handleError = (event: ErrorEvent) => {
      logger.error(
        'Erro JavaScript não capturado',
        {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        },
        context || 'GLOBAL_ERROR'
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error(
        'Promise rejeitada não tratada',
        {
          reason: event.reason,
          stack: event.reason?.stack
        },
        context || 'UNHANDLED_PROMISE'
      );
    };

    // Adicionar listeners para erros globais
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [enableReporting, context]);

  const trackError = (error: Error, additionalInfo?: any) => {
    if (enableReporting) {
      logger.error(
        'Erro rastreado manualmente',
        {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...additionalInfo
        },
        context
      );
    }
  };

  const trackEvent = (eventName: string, data?: any) => {
    if (enableReporting) {
      logger.info(`Evento: ${eventName}`, data, context);
    }
  };

  return {
    trackError,
    trackEvent
  };
};

// Hook para React Error Boundaries
export const useErrorBoundary = () => {
  const trackError = (error: Error, errorInfo: ErrorInfo) => {
    logger.error(
      'Erro capturado pelo Error Boundary',
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: errorInfo.errorBoundary
      },
      'ERROR_BOUNDARY'
    );
  };

  return { trackError };
};