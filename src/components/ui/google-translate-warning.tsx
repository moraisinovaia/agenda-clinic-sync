import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleTranslateWarningProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export function GoogleTranslateWarning({ isVisible, onDismiss }: GoogleTranslateWarningProps) {
  if (!isVisible) return null;

  return (
    <Alert variant="default" className="mb-4 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Google Tradutor detectado
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              O Google Tradutor pode interferir no funcionamento do sistema de agendamento. 
              Para evitar erros, recomendamos desabilitar temporariamente a tradução nesta página.
            </p>
            <div className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
              <p><strong>Como desabilitar:</strong></p>
              <p>• Clique no ícone do Google Tradutor no navegador</p>
              <p>• Selecione "Nunca traduzir este site"</p>
              <p>• Ou use o navegador em modo incógnito</p>
            </div>
          </div>
          <Button
            variant="ghost" 
            size="sm"
            onClick={onDismiss}
            className="shrink-0 -mr-2 -mt-2 text-yellow-600 hover:text-yellow-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}