import { AlertCircle, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

interface PendingApprovalProps {
  profile: {
    nome: string;
    email: string;
    status: string;
    created_at: string;
  } | null;
}

export default function PendingApproval({ profile }: PendingApprovalProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const getStatusMessage = () => {
    switch (profile?.status) {
      case 'pendente':
        return {
          title: 'Conta Pendente de Aprovação',
          description: 'Sua conta foi criada com sucesso e está aguardando aprovação do administrador.',
          icon: <Clock className="h-5 w-5" />
        };
      case 'rejeitado':
        return {
          title: 'Conta Rejeitada',
          description: 'Infelizmente sua conta foi rejeitada. Entre em contato com o administrador para mais informações.',
          icon: <AlertCircle className="h-5 w-5" />
        };
      default:
        return {
          title: 'Status Desconhecido',
          description: 'Status da conta não reconhecido. Entre em contato com o administrador.',
          icon: <AlertCircle className="h-5 w-5" />
        };
    }
  };

  const status = getStatusMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            {status.icon}
          </div>
          <CardTitle className="text-xl font-bold">{status.title}</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {status.description}
            </AlertDescription>
          </Alert>

          {profile && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <div className="text-sm">
                <span className="font-medium">Nome:</span> {profile.nome}
              </div>
              <div className="text-sm">
                <span className="font-medium">Email:</span> {profile.email}
              </div>
              <div className="text-sm">
                <span className="font-medium">Solicitação:</span> {' '}
                {new Date(profile.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              {profile?.status === 'pendente' 
                ? 'Você receberá um email quando sua conta for aprovada.'
                : 'Para questões sobre sua conta, entre em contato com o administrador.'
              }
            </p>
          </div>

          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}