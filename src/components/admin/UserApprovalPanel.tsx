import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, X, Users, Clock, CheckCircle, XCircle, Mail, MailCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';
import { DeleteUserModal } from './DeleteUserModal';

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
  created_at: string;
  data_aprovacao: string;
}

interface EmailStatus {
  profile_id: string;
  email_confirmed: boolean;
  email_confirmed_at: string | null;
}

export function UserApprovalPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [emailStatuses, setEmailStatuses] = useState<Map<string, EmailStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ApprovedUser | null>(null);
  const { toast } = useToast();
  const { profile, isAdmin, isApproved } = useStableAuth();

  const fetchPendingUsers = async () => {
    try {
      console.log('🔍 Buscando usuários pendentes...');
      
      // Usar a função RPC corrigida
      const { data, error } = await supabase
        .rpc('get_pending_users_safe');

      if (error) {
        console.error('❌ Erro ao buscar usuários pendentes:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar usuários pendentes: ' + error.message,
          variant: 'destructive',
        });
        setPendingUsers([]);
        return;
      }

      console.log('✅ Usuários pendentes encontrados:', data?.length || 0);
      setPendingUsers(data || []);
    } catch (error) {
      console.error('❌ Erro inesperado ao buscar usuários pendentes:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao carregar usuários pendentes',
        variant: 'destructive',
      });
      setPendingUsers([]);
    }
  };

  const fetchApprovedUsers = async () => {
    try {
      console.log('🔍 Buscando usuários aprovados...');
      
      const { data, error } = await supabase.rpc('get_approved_users_safe');

      if (error) {
        console.error('❌ Erro ao buscar usuários aprovados:', error);
        toast({
          title: 'Aviso',
          description: 'Não foi possível carregar usuários aprovados',
          variant: 'default',
        });
        setApprovedUsers([]);
        return;
      }

      console.log('✅ Usuários aprovados encontrados:', data?.length || 0);
      const users = data || [];
      setApprovedUsers(users);

      // Buscar status de emails em lote via Edge Function
      if (users.length > 0 && profile?.id) {
        await fetchEmailStatuses(users.map(u => u.id));
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao buscar usuários aprovados:', error);
      setApprovedUsers([]);
    }
  };

  const fetchEmailStatuses = async (userIds: string[]) => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('user-management', {
        body: {
          action: 'batch_check_emails',
          user_ids: userIds,
          admin_id: profile.id
        }
      });

      if (error) {
        console.error('❌ Erro ao buscar status de emails:', error);
        return;
      }

      if (data?.success && data?.email_statuses) {
        const statusMap = new Map<string, EmailStatus>();
        data.email_statuses.forEach((status: EmailStatus) => {
          statusMap.set(status.profile_id, status);
        });
        setEmailStatuses(statusMap);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar status de emails:', error);
    }
  };

  // Usar useEffect mais estável que não causa loops
  useEffect(() => {
    let isMounted = true;
    
    console.log('🔄 UserApprovalPanel useEffect - isAdmin:', isAdmin, 'isApproved:', isApproved, 'profile:', profile?.nome);
    
    const loadData = async () => {
      // Só admins podem ver este painel
      if (isAdmin && isApproved) {
        console.log('✅ Usuário é admin aprovado, carregando dados...');
        await Promise.all([
          fetchPendingUsers(),
          fetchApprovedUsers()
        ]);
      } else {
        console.log('⚠️ Usuário não é admin aprovado, não carregando dados');
      }
      
      if (isMounted) {
        setLoading(false);
      }
    };

    if (profile) { // Só executa quando profile está definido
      loadData();
    } else {
      console.log('⚠️ Profile ainda não definido, aguardando...');
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isAdmin, isApproved]); // Dependências estáveis

  const handleApproveUser = async (userId: string) => {
    if (!profile?.id) {
      console.error('❌ Profile ID não encontrado:', profile);
      toast({
        title: 'Erro de autenticação',
        description: 'Não foi possível identificar o administrador. Tente fazer login novamente.',
        variant: 'destructive',
      });
      return;
    }

    console.log('🔄 Iniciando aprovação de usuário:', { userId, aprovadorId: profile.id });
    setProcessingUser(userId);
    
    try {
      const { data, error } = await supabase.rpc('aprovar_usuario', {
        p_user_id: userId,
        p_aprovador_id: profile.id
      });

      console.log('📡 Resposta da função aprovar_usuario:', { data, error });

      if (error) {
        console.error('❌ Erro na função RPC:', error);
        throw new Error(`Erro na função: ${error.message}`);
      }

      if (!(data as any)?.success) {
        console.error('❌ Função retornou sucesso=false:', data);
        throw new Error((data as any)?.error || 'A função retornou erro sem descrição');
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
      const { data, error } = await supabase.functions.invoke('user-management', {
        body: {
          action: 'confirm_email',
          user_email: email,
          admin_id: profile.id
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao confirmar email');
      }

      toast({
        title: 'Sucesso',
        description: 'Email confirmado com sucesso'
      });

      // Recarregar dados
      await fetchApprovedUsers();
    } catch (error: any) {
      console.error('Erro ao confirmar email:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao confirmar email do usuário',
        variant: 'destructive'
      });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!profile?.id || !userToDelete) return;

    setProcessingUser(userToDelete.id);
    try {
      const { data, error } = await supabase.functions.invoke('user-management', {
        body: {
          action: 'delete_user',
          user_id: userToDelete.id,
          admin_id: profile.id
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao excluir usuário');
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário excluído com sucesso'
      });

      // Remover da lista local
      setApprovedUsers(prev => prev.filter(user => user.id !== userToDelete.id));
      setEmailStatuses(prev => {
        const newMap = new Map(prev);
        newMap.delete(userToDelete.id);
        return newMap;
      });
      closeDeleteModal();
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir usuário',
        variant: 'destructive'
      });
    } finally {
      setProcessingUser(null);
    }
  };

  const openDeleteModal = (user: ApprovedUser) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setUserToDelete(null);
  };

  // Se não é admin aprovado, não mostrar nada
  if (!isAdmin) {
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
                          {emailStatuses.get(user.id)?.email_confirmed ? (
                            <>
                              <MailCheck className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 text-sm">Confirmado</span>
                            </>
                          ) : emailStatuses.has(user.id) ? (
                            <>
                              <Mail className="h-4 w-4 text-orange-500" />
                              <span className="text-orange-600 text-sm">Não confirmado</span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-muted-foreground text-sm">Verificando...</span>
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
                        <div className="flex gap-2 justify-end">
                          {emailStatuses.has(user.id) && !emailStatuses.get(user.id)?.email_confirmed && (
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDeleteModal(user)}
                            disabled={processingUser === user.id || user.id === profile?.id}
                            className="text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                            title={user.id === profile?.id ? 'Não é possível excluir seu próprio usuário' : 'Excluir usuário'}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <DeleteUserModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteUser}
        userName={userToDelete?.nome || ''}
        isLoading={processingUser === userToDelete?.id}
      />
    </Card>
  );
}