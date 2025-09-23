import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, UserPlus, UserMinus, Shield, AlertTriangle } from 'lucide-react';
import { useSuperAdminContext } from '@/hooks/useSuperAdminContext';

interface User {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: string;
  status: string;
  ativo: boolean;
  created_at: string;
}

interface ClientData {
  id: string;
  nome: string;
  ativo: boolean;
}

interface BulkUserActionsProps {
  selectedClient: string | null;
  clientsData: ClientData[];
}

export const BulkUserActions = ({ selectedClient, clientsData }: BulkUserActionsProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const { logAction } = useSuperAdminContext();

  const fetchUsers = async () => {
    if (!selectedClient) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const clientData = clientsData.find(c => c.id === selectedClient);
      if (!clientData) return;

      const isIpado = clientData.nome === 'IPADO';
      const tableName = isIpado ? 'ipado_profiles' : 'profiles';

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os usuários"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    setSelectedUsers([]); // Clear selection when client changes
  }, [selectedClient, clientsData]);

  const bulkApproveUsers = async () => {
    if (selectedUsers.length === 0) return;

    setActionLoading(true);
    try {
      const clientData = clientsData.find(c => c.id === selectedClient);
      if (!clientData) return;

      const isIpado = clientData.nome === 'IPADO';
      const tableName = isIpado ? 'ipado_profiles' : 'profiles';

      const { error } = await supabase
        .from(tableName)
        .update({ 
          status: 'aprovado',
          data_aprovacao: new Date().toISOString()
        })
        .in('id', selectedUsers);

      if (error) throw error;

      await logAction(
        'BULK_APPROVE_USERS',
        selectedClient,
        undefined,
        { userIds: selectedUsers, count: selectedUsers.length }
      );

      toast({
        title: "Sucesso",
        description: `${selectedUsers.length} usuário(s) aprovado(s) com sucesso`
      });

      setSelectedUsers([]);
      await fetchUsers();
    } catch (error: any) {
      console.error('Error approving users:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao aprovar usuários"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const bulkRejectUsers = async () => {
    if (selectedUsers.length === 0) return;

    setActionLoading(true);
    try {
      const clientData = clientsData.find(c => c.id === selectedClient);
      if (!clientData) return;

      const isIpado = clientData.nome === 'IPADO';
      const tableName = isIpado ? 'ipado_profiles' : 'profiles';

      const { error } = await supabase
        .from(tableName)
        .update({ status: 'rejeitado' })
        .in('id', selectedUsers);

      if (error) throw error;

      await logAction(
        'BULK_REJECT_USERS',
        selectedClient,
        undefined,
        { userIds: selectedUsers, count: selectedUsers.length }
      );

      toast({
        title: "Sucesso",
        description: `${selectedUsers.length} usuário(s) rejeitado(s)`
      });

      setSelectedUsers([]);
      await fetchUsers();
    } catch (error: any) {
      console.error('Error rejecting users:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao rejeitar usuários"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllPending = () => {
    const pendingUsers = users.filter(u => u.status === 'pendente').map(u => u.id);
    setSelectedUsers(pendingUsers);
  };

  if (!selectedClient) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Selecione um cliente para gerenciar usuários</p>
        </CardContent>
      </Card>
    );
  }

  const clientName = clientsData.find(c => c.id === selectedClient)?.nome || '';
  const pendingUsers = users.filter(u => u.status === 'pendente');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar Usuários - {clientName}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {users.length} total
              </Badge>
              {pendingUsers.length > 0 && (
                <Badge variant="destructive">
                  {pendingUsers.length} pendentes
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk Actions */}
          <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Ações em Lote:</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={selectAllPending}
              disabled={pendingUsers.length === 0}
            >
              Selecionar Pendentes ({pendingUsers.length})
            </Button>
            <Button 
              variant="default" 
              size="sm"
              onClick={bulkApproveUsers}
              disabled={selectedUsers.length === 0 || actionLoading}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Aprovar ({selectedUsers.length})
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={bulkRejectUsers}
              disabled={selectedUsers.length === 0 || actionLoading}
            >
              <UserMinus className="h-4 w-4 mr-1" />
              Rejeitar ({selectedUsers.length})
            </Button>
          </div>

          {/* Users List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Carregando usuários...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
              </div>
            ) : (
              users.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{user.nome}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {user.role}
                        </Badge>
                        <Badge 
                          variant={
                            user.status === 'aprovado' ? 'default' :
                            user.status === 'pendente' ? 'secondary' :
                            'destructive'
                          }
                        >
                          {user.status === 'pendente' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {user.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};