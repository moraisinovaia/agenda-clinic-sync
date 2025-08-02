import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleAppointmentForm } from './SimpleAppointmentForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface IsolatedSchedulingWrapperProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

/**
 * WRAPPER ISOLADO PARA SISTEMA NOVO DE AGENDAMENTO
 * 
 * ✅ ZERO dependências do sistema antigo
 * ✅ ZERO error boundaries que causam reload
 * ✅ ZERO hooks complexos
 * ✅ Error handling próprio sem throws
 * ✅ Estado local independente
 */
export function IsolatedSchedulingWrapper({
  onSuccess,
  onBack
}: IsolatedSchedulingWrapperProps) {
  console.log('🆕 IsolatedSchedulingWrapper: Renderizando sistema isolado');

  const handleSuccess = () => {
    console.log('🆕 Sistema Novo Isolado: Sucesso confirmado');
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Isolado */}
          <div className="flex items-center gap-4">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                🆕 Sistema Novo de Agendamento
              </h1>
              <p className="text-muted-foreground">
                Sistema isolado - Zero reloads garantidos
              </p>
            </div>
          </div>

          {/* Alert de Status */}
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-800 dark:text-green-200 text-lg">
                ✅ Sistema Isolado Ativo
              </CardTitle>
            </CardHeader>
            <CardContent className="text-green-700 dark:text-green-300 text-sm space-y-1">
              <p>• Zero page reloads em conflitos</p>
              <p>• Formulário sempre preservado</p>
              <p>• Error handling visual sem error boundaries</p>
              <p>• Performance otimizada</p>
            </CardContent>
          </Card>

          {/* Formulário Isolado */}
          <div className="relative">
            <SimpleAppointmentForm
              onSuccess={handleSuccess}
              className="w-full"
            />
          </div>

          {/* Footer Info */}
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardContent className="pt-4 text-center text-blue-700 dark:text-blue-300 text-sm">
              <p>
                🔒 Sistema completamente isolado do código legado
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}