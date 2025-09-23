import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { waitForSession, ensureValidSession } from '@/utils/authHelpers';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, session, loading, profile } = useAuth();
  const [retryCount, setRetryCount] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);

  // Aguardar que a sessão esteja completamente carregada
  useEffect(() => {
    if (!loading && user) {
      const checkSession = async () => {
        try {
          const isReady = await waitForSession(3000);
          await ensureValidSession();
          setSessionReady(isReady);
        } catch (error) {
          console.error('Erro ao verificar sessão:', error);
          setSessionReady(false);
        }
      };
      
      checkSession();
    }
  }, [user, loading]);

  // Loading state melhorado
  if (loading || (user && !sessionReady)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <p className="text-muted-foreground">
              {!sessionReady && user ? 'Carregando sessão...' : 'Verificando autenticação...'}
            </p>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Tentativa {retryCount} de 3
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Se não há usuário após tentativas, redirecionar para login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Verificar se o usuário está aprovado
  if (user && profile && profile.status !== 'aprovado') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="space-y-2">
            {profile.status === 'pendente' ? (
              <>
                <Clock className="h-12 w-12 mx-auto text-amber-500" />
                <h2 className="text-2xl font-bold">Aguardando Aprovação</h2>
                <p className="text-muted-foreground">
                  Sua conta foi criada com sucesso e está aguardando aprovação de um administrador.
                </p>
                <p className="text-sm text-muted-foreground">
                  Você receberá um email quando sua conta for aprovada.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 mx-auto text-red-500" />
                <h2 className="text-2xl font-bold">Acesso Negado</h2>
                <p className="text-muted-foreground">
                  Sua solicitação de acesso foi rejeitada.
                </p>
                <p className="text-sm text-muted-foreground">
                  Entre em contato com o administrador para mais informações.
                </p>
              </>
            )}
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/auth'}
          >
            Voltar ao Login
          </Button>
        </div>
      </div>
    );
  }

  // Se há usuário mas está carregando perfil, permitir acesso temporário
  if (user && !profile) {
    console.log('Usuário autenticado sem perfil carregado, permitindo acesso temporário');
  }

  return <>{children}</>;
}