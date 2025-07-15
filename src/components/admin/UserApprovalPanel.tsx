import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Check, X, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PendingUser {
  id: string;
  nome: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

export function UserApprovalPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_usuarios_pendentes')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar usuários pendentes:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar usuários pendentes',
          variant: 'destructive',
        });
        return;
      }

      setPendingUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários pendentes:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao carregar usuários',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só admins podem ver este painel
    if (profile?.role === 'admin' && profile?.status === 'aprovado') {
      fetchPendingUsers();
    } else {
      setLoading(false);
    }
  }, [profile]);

  const handleApproveUser = async (userId: string) => {
    if (!profile?.id) return;

    setProcessingUser(userId);
    try {
      const { data, error } = await supabase.rpc('aprovar_usuario', {
        p_user_id: userId,
        p_aprovador_id: profile.id
      });

      if (error || !(data as any)?.success) {
        throw new Error((data as any)?.error || 'Erro ao aprovar usuário');
      }

      toast({
        title: 'Usuário aprovado',
        description: 'O usuário foi aprovado e pode acessar o sistema',
      });

      // Remover da lista local
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
    } catch (error: any) {
      toast({
        title: 'Erro ao aprovar',
        description: error.message || 'Erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!profile?.id) return;

    setProcessingUser(userId);
    try {
      const { data, error } = await supabase.rpc('rejeitar_usuario', {
        p_user_id: userId,
        p_aprovador_id: profile.id
      });

      if (error || !(data as any)?.success) {
        throw new Error((data as any)?.error || 'Erro ao rejeitar usuário');
      }

      toast({
        title: 'Usuário rejeitado',
        description: 'O acesso foi negado para este usuário',
      });

      // Remover da lista local
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
    } catch (error: any) {
      toast({
        title: 'Erro ao rejeitar',
        description: error.message || 'Erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setProcessingUser(null);
    }
  };

  // Se não é admin aprovado, não mostrar nada
  if (profile?.role !== 'admin' || profile?.status !== 'aprovado') {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Aprovação de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Aprovação de Usuários
          {pendingUsers.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingUsers.length} pendente{pendingUsers.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>Nenhum usuário pendente de aprovação</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.nome}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {new Date(user.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproveUser(user.id)}
                        disabled={processingUser === user.id}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        {processingUser === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectUser(user.id)}
                        disabled={processingUser === user.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {processingUser === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Rejeitar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}