import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, X, Users, Clock, CheckCircle, Trash2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';
import { DeleteUserModal } from './DeleteUserModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PendingUser {
  id: string;
  nome: string;
  email: string;
  username: string;
  cargo: string;
  created_at: string;
}

interface ApprovedUser {
  id: string;
  nome: string;
  email: string;
  username: string;
  cargo: string;
  status: string;
  created_at: string;
  data_aprovacao: string;
  cliente_nome?: string;
  user_id?: string;
  role?: string;
}

type AppRole = 'recepcionista' | 'admin_clinica' | 'medico' | 'admin';

const ROLE_LABELS: Record<AppRole, string> = {
  recepcionista: 'Recepcionista',
  admin_clinica: 'Admin da Clínica',
  medico: 'Médico',
  admin: 'Administrador Global'
};

interface Cliente {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export function UserApprovalPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<Record<string, string>>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});
  const [loading, setLoading] = useState(true);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ApprovedUser | null>(null);
  const { toast } = useToast();
  const { profile, isAdmin, isApproved, isClinicAdmin, clinicAdminClienteId } = useStableAuth();

  const fetchPendingUsers = async () => {
    try {
      console.log('🔍 Buscando usuários pendentes...', { isAdmin, isClinicAdmin, clinicAdminClienteId });
      
      let data, error;
      
      // Admin da clínica: buscar apenas da sua clínica
      if (isClinicAdmin && clinicAdminClienteId) {
        console.log('🏥 Buscando usuários pendentes da clínica:', clinicAdminClienteId);
        const result = await supabase.rpc('get_pending_users_for_clinic', {
          p_cliente_id: clinicAdminClienteId
        });
        data = result.data;
        error = result.error;
      } else {
        // Admin global: buscar todos
        const result = await supabase.rpc('get_pending_users_safe');
        data = result.data;
        error = result.error;
      }

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
      console.log('🔍 Buscando usuários aprovados...', { isAdmin, isClinicAdmin, clinicAdminClienteId });
      
      let data, error;
      
      // Admin da clínica: buscar apenas da sua clínica
      if (isClinicAdmin && clinicAdminClienteId) {
        console.log('🏥 Buscando usuários aprovados da clínica:', clinicAdminClienteId);
        const result = await supabase.rpc('get_approved_users_for_clinic', {
          p_cliente_id: clinicAdminClienteId
        });
        data = result.data;
        error = result.error;
      } else {
        // Admin global: buscar todos
        const result = await supabase.rpc('get_approved_users_safe');
        data = result.data;
        error = result.error;
      }

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
      setApprovedUsers(data || []);
    } catch (error) {
      console.error('❌ Erro inesperado ao buscar usuários aprovados:', error);
      setApprovedUsers([]);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase.rpc('get_clientes_ativos');

      if (error) {
        console.error('❌ Erro ao buscar clientes:', error);
        return;
      }

      setClientes(data || []);
    } catch (error) {
      console.error('❌ Erro inesperado ao buscar clientes:', error);
    }
  };

  // Usar useEffect mais estável que não causa loops
  useEffect(() => {
    let isMounted = true;
    
    console.log('🔄 UserApprovalPanel useEffect - isAdmin:', isAdmin, 'isClinicAdmin:', isClinicAdmin, 'isApproved:', isApproved, 'profile:', profile?.nome);
    
    const loadData = async () => {
      // Admins e admins da clínica podem ver este painel
      if ((isAdmin || isClinicAdmin) && isApproved) {
        console.log('✅ Usuário é admin/admin_clinica aprovado, carregando dados...');
        
        // Para admin da clínica, não precisa buscar lista de clientes
        if (isAdmin && !isClinicAdmin) {
          await Promise.all([
            fetchPendingUsers(),
            fetchApprovedUsers(),
            fetchClientes()
          ]);
        } else {
          await Promise.all([
            fetchPendingUsers(),
            fetchApprovedUsers()
          ]);
        }
      } else {
        console.log('⚠️ Usuário não é admin/admin_clinica aprovado, não carregando dados');
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
  }, [isAdmin, isClinicAdmin, isApproved, clinicAdminClienteId]); // Dependências estáveis

  const handleApproveUser = async (userId: string) => {
    if (!profile?.user_id) {
      console.error('❌ User ID não encontrado:', profile);
      toast({
        title: 'Erro de autenticação',
        description: 'Não foi possível identificar o administrador. Tente fazer login novamente.',
        variant: 'destructive',
      });
      return;
    }

    // Buscar email do usuário para confirmar
    const userToApprove = pendingUsers.find(u => u.id === userId);
    if (!userToApprove) {
      toast({
        title: 'Erro',
        description: 'Usuário não encontrado na lista',
        variant: 'destructive',
      });
      return;
    }

    // Obter cliente_id e role selecionados
    // Para admin da clínica, usar sempre o clinicAdminClienteId
    const clienteId = isClinicAdmin ? clinicAdminClienteId : (selectedClienteId[userId] || null);
    const role = selectedRole[userId] || 'recepcionista';
    
    console.log('🔄 Iniciando aprovação de usuário:', { 
      userId, 
      aprovadorUserId: profile.user_id, 
      clienteId, 
      role,
      isClinicAdmin,
      clinicAdminClienteId 
    });
    setProcessingUser(userId);
    
    try {
      // @ts-ignore - p_role foi adicionado na migração mas types ainda não foram atualizados
      const { data, error } = await supabase.rpc('aprovar_usuario', {
        p_user_id: userId,
        p_aprovador_user_id: profile.user_id,
        p_cliente_id: clienteId,
        p_role: role
      } as any);

      console.log('📡 Resposta da função aprovar_usuario:', { data, error });

      if (error) {
        console.error('❌ Erro na função RPC:', error);
        throw new Error(`Erro na função: ${error.message}`);
      }

      if (!(data as any)?.success) {
        console.error('❌ Função retornou sucesso=false:', data);
        throw new Error((data as any)?.error || 'A função retornou erro sem descrição');
      }

      // Confirmar email automaticamente via Edge Function
      console.log('📧 Confirmando email automaticamente para:', userToApprove.email);
      const { data: confirmData, error: confirmError } = await supabase.functions.invoke('user-management', {
        body: {
          action: 'confirm_email',
          user_email: userToApprove.email,
          admin_id: profile.user_id
        }
      });

      if (confirmError) {
        console.warn('⚠️ Erro ao confirmar email (não crítico):', confirmError);
      } else if (!confirmData?.success) {
        console.warn('⚠️ Falha ao confirmar email:', confirmData?.error);
      } else {
        console.log('✅ Email confirmado automaticamente');
      }

      toast({
        title: 'Usuário aprovado',
        description: 'O usuário foi aprovado e pode acessar o sistema imediatamente',
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
    if (!profile?.user_id) return;

    setProcessingUser(userId);
    try {
      const { data, error } = await supabase.rpc('rejeitar_usuario', {
        p_user_id: userId,
        p_aprovador_user_id: profile.user_id
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


  const handleDeleteUser = async () => {
    if (!profile?.user_id || !userToDelete) return;

    setProcessingUser(userToDelete.id);
    try {
      const { data, error } = await supabase.functions.invoke('user-management', {
        body: {
          action: 'delete_user',
          user_id: userToDelete.id,
          admin_id: profile.user_id
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

  // Se não é admin ou admin da clínica aprovado, não mostrar nada
  if (!isAdmin && !isClinicAdmin) {
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
                    {/* Admin global vê seletor de clínica */}
                    {isAdmin && !isClinicAdmin && <TableHead>Clínica</TableHead>}
                    <TableHead>Permissão</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.username || '-'}</TableCell>
                      {/* Admin global vê seletor de clínica */}
                      {isAdmin && !isClinicAdmin && (
                        <TableCell>
                          <Select
                            value={selectedClienteId[user.id] || ''}
                            onValueChange={(value) => setSelectedClienteId(prev => ({
                              ...prev,
                              [user.id]: value
                            }))}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Selecionar clínica">
                                {selectedClienteId[user.id] 
                                  ? clientes.find(c => c.id === selectedClienteId[user.id])?.nome 
                                  : <span className="flex items-center gap-1 text-muted-foreground">
                                      <Building2 className="h-3 w-3" />
                                      Padrão (IPADO)
                                    </span>
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {clientes.map((cliente) => (
                                <SelectItem key={cliente.id} value={cliente.id}>
                                  {cliente.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell>
                        <Select
                          value={selectedRole[user.id] || 'recepcionista'}
                          onValueChange={(value) => setSelectedRole(prev => ({
                            ...prev,
                            [user.id]: value as AppRole
                          }))}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue>
                              {ROLE_LABELS[selectedRole[user.id] || 'recepcionista']}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recepcionista">Recepcionista</SelectItem>
                            {/* Admin da clínica pode promover outros a admin_clinica */}
                            <SelectItem value="admin_clinica">Admin da Clínica</SelectItem>
                            <SelectItem value="medico">Médico</SelectItem>
                            {/* Só admin global pode criar outros admins globais */}
                            {isAdmin && !isClinicAdmin && <SelectItem value="admin">Admin Global</SelectItem>}
                          </SelectContent>
                        </Select>
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
                    <TableHead>Clínica</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Aprovado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.username || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.cliente_nome || 'IPADO'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'admin_clinica' ? 'default' : 'secondary'}>
                          {ROLE_LABELS[(user.role as AppRole) || 'recepcionista']}
                        </Badge>
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