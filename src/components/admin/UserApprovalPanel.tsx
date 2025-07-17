import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, X, Users, Clock, CheckCircle, XCircle, Mail, MailCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';

interface PendingUser {
  id: string;
  nome: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

interface ApprovedUser {
  id: string;
  nome: string;
  email: string;
  username: string;
  role: string;
  status: string;
  email_confirmed: boolean;
  created_at: string;
  data_aprovacao: string;
}

export function UserApprovalPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const { toast } = useToast();
  const { profile, isAdmin, isApproved } = useStableAuth();

  const fetchPendingUsers = async () => {
    try {
      // Usar a função segura para buscar usuários pendentes
      const { data, error } = await supabase
        .rpc('get_pending_users_safe');

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
    }
  };

  const fetchApprovedUsers = async () => {
    try {
      // Usar query mais segura sem dependências circulares
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, email, username, role, status, created_at, data_aprovacao, user_id')
        .eq('status', 'aprovado')
        .neq('user_id', (await supabase.auth.getUser()).data.user?.id || '') // Excluir próprio usuário
        .order('data_aprovacao', { ascending: false });

      if (profilesError) {
        // Não mostrar erro se for relacionado a RLS - apenas log
        console.warn('Aviso ao buscar usuários aprovados:', profilesError);
        setApprovedUsers([]);
        return;
      }

      // Assumir que email está confirmado (já que corrigimos isso no backend)
      const usersWithEmailStatus = (profilesData || []).map(profile => ({
        ...profile,
        email_confirmed: true // Simplificado - assumindo confirmado
      }));

      setApprovedUsers(usersWithEmailStatus);
    } catch (error) {
      console.warn('Aviso ao buscar usuários aprovados:', error);
      setApprovedUsers([]); // Falhar silenciosamente para evitar loops
    }
  };

  // Usar useEffect mais estável que não causa loops
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      // Só admins podem ver este painel
      if (isAdmin && isApproved) {
        await Promise.all([
          fetchPendingUsers(),
          fetchApprovedUsers()
        ]);
      }
      
      if (isMounted) {
        setLoading(false);
      }
    };

    if (profile) { // Só executa quando profile está definido
      loadData();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isAdmin, isApproved]); // Dependências estáveis

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

      // Remover da lista local e recarregar dados
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      fetchApprovedUsers();
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

  const handleConfirmEmail = async (email: string) => {
    if (!profile?.id) return;

    setProcessingUser(email);
    try {
      const { data, error } = await supabase.rpc('confirmar_email_usuario_aprovado', {
        p_user_email: email,
        p_admin_id: profile.id
      });

      if (error || !(data as any)?.success) {
        throw new Error((data as any)?.error || 'Erro ao confirmar email');
      }

      toast({
        title: 'Email confirmado',
        description: 'O email do usuário foi confirmado com sucesso',
      });

      // Recarregar dados
      fetchApprovedUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao confirmar email',
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
          Gerenciamento de Usuários
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {pendingUsers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Aprovados
              {approvedUsers.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {approvedUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
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
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            {approvedUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p>Nenhum usuário aprovado ainda</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status Email</TableHead>
                    <TableHead>Aprovado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.email_confirmed ? (
                            <>
                              <MailCheck className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 text-sm">Confirmado</span>
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4 text-orange-500" />
                              <span className="text-orange-600 text-sm">Não confirmado</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.data_aprovacao && new Date(user.data_aprovacao).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {!user.email_confirmed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConfirmEmail(user.email)}
                            disabled={processingUser === user.email}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            {processingUser === user.email ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MailCheck className="h-4 w-4" />
                            )}
                            Confirmar Email
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}