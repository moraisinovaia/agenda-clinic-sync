import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, Plus, Users, Calendar, Stethoscope, Edit, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';

interface Cliente {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

interface ClienteStats {
  total_medicos: number;
  total_pacientes: number;
  total_agendamentos: number;
  total_usuarios: number;
  agendamentos_hoje: number;
}

export function ClinicManagementPanel() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newClienteName, setNewClienteName] = useState('');
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [clienteStats, setClienteStats] = useState<Record<string, ClienteStats>>({});
  const [loadingStats, setLoadingStats] = useState<string | null>(null);
  const { toast } = useToast();
  const { profile, isAdmin } = useStableAuth();

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_clientes_ativos');

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os clientes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClienteStats = async (clienteId: string) => {
    try {
      setLoadingStats(clienteId);
      const { data, error } = await supabase.rpc('get_client_stats', {
        p_cliente_id: clienteId
      });

      if (error) throw error;
      
      if (data && typeof data === 'object') {
        setClienteStats(prev => ({
          ...prev,
          [clienteId]: data as unknown as ClienteStats
        }));
      }
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoadingStats(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchClientes();
    }
  }, [isAdmin]);

  const handleCreateCliente = async () => {
    if (!newClienteName.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite o nome da clínica',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('criar_cliente', {
        p_nome: newClienteName.trim(),
        p_admin_user_id: profile?.user_id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; cliente_id?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar cliente');
      }

      toast({
        title: 'Sucesso',
        description: 'Clínica criada com sucesso',
      });

      setNewClienteName('');
      setShowCreateModal(false);
      fetchClientes();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar clínica',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateCliente = async () => {
    if (!editingCliente) return;

    setUpdating(editingCliente.id);
    try {
      const { data, error } = await supabase.rpc('atualizar_cliente', {
        p_cliente_id: editingCliente.id,
        p_nome: editingCliente.nome,
        p_ativo: editingCliente.ativo,
        p_admin_user_id: profile?.user_id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar cliente');
      }

      toast({
        title: 'Sucesso',
        description: 'Clínica atualizada com sucesso',
      });

      setShowEditModal(false);
      setEditingCliente(null);
      fetchClientes();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar clínica',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const openEditModal = (cliente: Cliente) => {
    setEditingCliente({ ...cliente });
    setShowEditModal(true);
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Gestão de Clínicas
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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Gestão de Clínicas
            <Badge variant="secondary" className="ml-2">
              {clientes.length}
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchClientes}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Clínica
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clientes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2" />
              <p>Nenhuma clínica cadastrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Estatísticas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell>
                      <Badge variant={cliente.ativo ? 'default' : 'secondary'}>
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {clienteStats[cliente.id] ? (
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Stethoscope className="h-3 w-3" />
                            {clienteStats[cliente.id].total_medicos}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {clienteStats[cliente.id].total_usuarios}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {clienteStats[cliente.id].agendamentos_hoje} hoje
                          </span>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchClienteStats(cliente.id)}
                          disabled={loadingStats === cliente.id}
                        >
                          {loadingStats === cliente.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Ver'
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(cliente)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar Clínica */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Clínica</DialogTitle>
            <DialogDescription>
              Adicione uma nova clínica ao sistema. Após criar, você poderá aprovar usuários para esta clínica.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Clínica</Label>
              <Input
                id="nome"
                value={newClienteName}
                onChange={(e) => setNewClienteName(e.target.value)}
                placeholder="Ex: Clínica São José"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCliente} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                'Criar Clínica'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Clínica */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Clínica</DialogTitle>
            <DialogDescription>
              Atualize as informações da clínica.
            </DialogDescription>
          </DialogHeader>
          {editingCliente && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome da Clínica</Label>
                <Input
                  id="edit-nome"
                  value={editingCliente.nome}
                  onChange={(e) => setEditingCliente({ ...editingCliente, nome: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-ativo"
                  checked={editingCliente.ativo}
                  onCheckedChange={(checked) => setEditingCliente({ ...editingCliente, ativo: checked })}
                />
                <Label htmlFor="edit-ativo">Clínica Ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCliente} disabled={updating === editingCliente?.id}>
              {updating === editingCliente?.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
