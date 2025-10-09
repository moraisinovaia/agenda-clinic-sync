import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, User, Mail, Shield } from 'lucide-react';

export function AuthTest() {
  const { user, profile, session, loading, signOut } = useAuth();

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <Loader2 className="h-4 w-4 animate-spin" />;
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean | null, label: string) => {
    if (status === null) return <Badge variant="outline">Carregando...</Badge>;
    return (
      <Badge variant={status ? "default" : "destructive"}>
        {status ? label : `Sem ${label.toLowerCase()}`}
      </Badge>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Teste de Autenticação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Geral */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            {getStatusIcon(loading ? null : !!user)}
            <span className="text-sm font-medium">Usuário</span>
            {getStatusBadge(loading ? null : !!user, "Autenticado")}
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon(loading ? null : !!session)}
            <span className="text-sm font-medium">Sessão</span>
            {getStatusBadge(loading ? null : !!session, "Ativa")}
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon(loading ? null : !!profile)}
            <span className="text-sm font-medium">Perfil</span>
            {getStatusBadge(loading ? null : !!profile, "Carregado")}
          </div>
        </div>

        {/* Detalhes do Usuário */}
        {user && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Usuário
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">ID:</span> {user.id}
              </div>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span className="font-medium">Email:</span> {user.email}
              </div>
              <div>
                <span className="font-medium">Confirmado:</span> 
                <Badge variant={user.email_confirmed_at ? "default" : "destructive"} className="ml-1">
                  {user.email_confirmed_at ? "Sim" : "Não"}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Criado em:</span> 
                {new Date(user.created_at).toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        )}

        {/* Detalhes do Perfil */}
        {profile && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold">Dados do Perfil</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Nome:</span> {profile.nome}
              </div>
              <div>
                <span className="font-medium">Username:</span> {profile.username || 'Não definido'}
              </div>
              <div>
                <span className="font-medium">Ativo:</span> 
                <Badge variant={profile.ativo ? "default" : "destructive"} className="ml-1">
                  {profile.ativo ? "Sim" : "Não"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Ações de Teste */}
        <div className="flex gap-2 pt-4 border-t">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            size="sm"
          >
            Recarregar Página
          </Button>
          <Button 
            onClick={signOut} 
            variant="destructive"
            size="sm"
          >
            Fazer Logout
          </Button>
        </div>

        {/* Estado de Loading */}
        {loading && (
          <div className="text-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}