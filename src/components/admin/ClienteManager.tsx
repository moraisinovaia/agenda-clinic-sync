import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Eye, Users, Calendar, UserCog } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useStableAuth } from '@/hooks/useStableAuth';

interface Cliente {
  id: string;
  nome: string;
  logo_url?: string;
  ativo: boolean;
  configuracoes?: any;
  created_at: string;
  updated_at: string;
}

interface ClienteStats {
  total_medicos: number;
  total_pacientes: number;
  total_agendamentos: number;
  total_usuarios: number;
}

export const ClienteManager = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteStats, setClienteStats] = useState<Record<string, ClienteStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    logo_url: '',
    configuracoes: {}
  });
  const { toast } = useToast();
  const { isAdmin, loading: authLoading, isAuthenticated } = useStableAuth();

  const fetchClientes = async () => {
    // Verificar se o usuário está autenticado e é admin antes de fazer a consulta
    if (!isAuthenticated || !isAdmin) {
      setError('Acesso negado. Apenas administradores podem ver esta página.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data: clientesData, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Erro na consulta de clientes:', error);
        throw new Error(`Erro ao buscar clientes: ${error.message}`);
      }

      setClientes(clientesData || []);

      // Buscar estatísticas para cada cliente
      const stats: Record<string, ClienteStats> = {};
      for (const cliente of clientesData || []) {
        try {
          const [medicosRes, pacientesRes, agendamentosRes, usuariosRes] = await Promise.all([
            supabase.from('medicos').select('id', { count: 'exact' }).eq('cliente_id', cliente.id),
            supabase.from('pacientes').select('id', { count: 'exact' }).eq('cliente_id', cliente.id),
            supabase.from('agendamentos').select('id', { count: 'exact' }).eq('cliente_id', cliente.id),
            supabase.from('profiles').select('id', { count: 'exact' }).eq('cliente_id', cliente.id)
          ]);

          stats[cliente.id] = {
            total_medicos: medicosRes.count || 0,
            total_pacientes: pacientesRes.count || 0,
            total_agendamentos: agendamentosRes.count || 0,
            total_usuarios: usuariosRes.count || 0
          };
        } catch (statsError) {
          console.warn(`Erro ao buscar estatísticas do cliente ${cliente.id}:`, statsError);
          stats[cliente.id] = {
            total_medicos: 0,
            total_pacientes: 0,
            total_agendamentos: 0,
            total_usuarios: 0
          };
        }
      }
      setClienteStats(stats);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      const errorMessage = error.message || 'Erro desconhecido ao carregar clientes';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só executar quando a autenticação estiver carregada
    if (!authLoading) {
      fetchClientes();
    }
  }, [authLoading, isAuthenticated, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCliente) {
        // Atualizar cliente existente
        const { error } = await supabase
          .from('clientes')
          .update({
            nome: formData.nome,
            logo_url: formData.logo_url || null,
            configuracoes: formData.configuracoes,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCliente.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cliente atualizado com sucesso"
        });
      } else {
        // Criar novo cliente
        const { error } = await supabase
          .from('clientes')
          .insert({
            nome: formData.nome,
            logo_url: formData.logo_url || null,
            ativo: true,
            configuracoes: formData.configuracoes
          });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cliente criado com sucesso"
        });
      }

      setDialogOpen(false);
      setEditingCliente(null);
      setFormData({ nome: '', logo_url: '', configuracoes: {} });
      fetchClientes();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar cliente",
        variant: "destructive"
      });
    }
  };

  const toggleClienteStatus = async (cliente: Cliente) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ 
          ativo: !cliente.ativo,
          updated_at: new Date().toISOString()
        })
        .eq('id', cliente.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Cliente ${!cliente.ativo ? 'ativado' : 'desativado'} com sucesso`
      });

      fetchClientes();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do cliente",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      logo_url: cliente.logo_url || '',
      configuracoes: cliente.configuracoes || {}
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCliente(null);
    setFormData({ nome: '', logo_url: '', configuracoes: {} });
    setDialogOpen(true);
  };

  // Mostrar loading enquanto a autenticação está carregando
  if (authLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Verificando autenticação...</div>
        </CardContent>
      </Card>
    );
  }

  // Verificar se o usuário tem permissão
  if (!isAuthenticated || !isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Acesso negado. Apenas administradores podem acessar esta página.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar erro se houver
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-destructive mb-4">{error}</div>
            <Button onClick={fetchClientes} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar loading dos dados
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando clientes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Clientes</h2>
          <p className="text-muted-foreground">Gerencie as clínicas do sistema</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Clínica *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="logo_url">URL do Logo (opcional)</Label>
                <Input
                  id="logo_url"
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://exemplo.com/logo.png"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCliente ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {clientes.map((cliente) => {
          const stats = clienteStats[cliente.id] || {
            total_medicos: 0,
            total_pacientes: 0,
            total_agendamentos: 0,
            total_usuarios: 0
          };

          return (
            <Card key={cliente.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {cliente.logo_url && (
                        <img 
                          src={cliente.logo_url} 
                          alt={`Logo ${cliente.nome}`}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold">{cliente.nome}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant={cliente.ativo ? "default" : "secondary"}>
                            {cliente.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Criado em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{stats.total_medicos}</div>
                          <div className="text-xs text-muted-foreground">Médicos</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{stats.total_pacientes}</div>
                          <div className="text-xs text-muted-foreground">Pacientes</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{stats.total_agendamentos}</div>
                          <div className="text-xs text-muted-foreground">Agendamentos</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{stats.total_usuarios}</div>
                          <div className="text-xs text-muted-foreground">Usuários</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`status-${cliente.id}`} className="text-sm">
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </Label>
                      <Switch
                        id={`status-${cliente.id}`}
                        checked={cliente.ativo}
                        onCheckedChange={() => toggleClienteStatus(cliente)}
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(cliente)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {clientes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cliente cadastrado ainda.</p>
              <p>Clique em "Novo Cliente" para começar.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};