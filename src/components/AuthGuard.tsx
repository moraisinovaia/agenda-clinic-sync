import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Clock, XCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDomainPartnerValidation } from '@/hooks/useDomainPartnerValidation';
import { supabase } from '@/integrations/supabase/client';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, session, loading, profile } = useAuth();
  const [authTimeout, setAuthTimeout] = useState(false);

  useEffect(() => {
    console.log('🛡️ AuthGuard: Estado atual -', {
      loading,
      user: user ? 'presente' : 'ausente',
      session: session ? 'presente' : 'ausente',
      profileStatus: profile?.status || 'sem perfil'
    });

    const timer = setTimeout(() => {
      if (loading) {
        console.log('🛡️ AuthGuard: Timeout de autenticação atingido (10s)');
        setAuthTimeout(true);
      }
    }, 10000); // 10 segundos de timeout

    return () => clearTimeout(timer);
  }, [loading, user, session, profile]);

  // Se houve timeout ou não está carregando mas não há usuário
  if (authTimeout) {
    console.log('🛡️ AuthGuard: Redirecionando devido ao timeout');
    return <Navigate to="/auth" replace />;
  }
  
  if (!loading && !user) {
    console.log('🛡️ AuthGuard: Redirecionando - sem usuário após loading');
    return <Navigate to="/auth" replace />;
  }

  // Loading state melhorado
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <p className="text-muted-foreground">Verificando autenticação...</p>
            <p className="text-xs text-muted-foreground/70">
              {authTimeout ? 'Verificação demorada detectada...' : 'Conectando ao sistema...'}
            </p>
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
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/auth';
            }}
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

  // === CAMADA 2: Validação de domínio/parceiro ===
  return <DomainGuard clienteId={profile?.cliente_id}>{children}</DomainGuard>;
}

function DomainGuard({ clienteId, children }: { clienteId: string | null | undefined; children: ReactNode }) {
  const { isAuthorized, isLoading, userPartner, domainPartner } = useDomainPartnerValidation(clienteId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verificando permissões de domínio...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    const isQueryError = userPartner === null && clienteId;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <ShieldAlert className="h-12 w-12 mx-auto text-red-500" />
          <h2 className="text-2xl font-bold">
            {isQueryError ? 'Erro de Verificação' : 'Acesso Negado'}
          </h2>
          {isQueryError ? (
            <p className="text-muted-foreground">
              Não foi possível verificar suas permissões de acesso. Por favor, tente fazer login novamente.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                Seu usuário pertence ao parceiro <strong>{userPartner}</strong>, mas você está acessando o domínio do parceiro <strong>{domainPartner}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Por favor, acesse pelo domínio correto do seu parceiro.
              </p>
            </>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/auth';
            }}
          >
            {isQueryError ? 'Fazer login novamente' : 'Sair e voltar ao login'}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

A única alteração foi trocar:
```
onClick={() => window.location.href = '/auth'}
```
por:
```
onClick={async () => {
  await supabase.auth.signOut();
  window.location.href = '/auth';
}}
