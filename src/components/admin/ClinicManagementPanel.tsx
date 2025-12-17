import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, Building2, Plus, Users, Calendar, Stethoscope, Edit, RefreshCw, 
  Phone, MapPin, MessageSquare, Settings, AlertCircle, CheckCircle2, Bot
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  logo_url: string | null;
  ativo: boolean;
  created_at: string;
}

interface LLMConfig {
  id?: string;
  nome_clinica: string;
  data_minima_agendamento: string | null;
  dias_busca_inicial: number;
  dias_busca_expandida: number;
  mensagem_bloqueio_padrao: string | null;
}

interface ClienteStats {
  total_medicos: number;
  total_pacientes: number;
  total_agendamentos: number;
  total_usuarios: number;
  agendamentos_hoje: number;
}

interface EditFormData {
  nome: string;
  telefone: string;
  whatsapp: string;
  endereco: string;
  ativo: boolean;
  // LLM Config
  data_minima_agendamento: string;
  dias_busca_inicial: number;
  dias_busca_expandida: number;
  mensagem_bloqueio_padrao: string;
}

export function ClinicManagementPanel() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newClienteData, setNewClienteData] = useState({
    nome: '',
    telefone: '',
    whatsapp: '',
    endereco: ''
  });
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    nome: '',
    telefone: '',
    whatsapp: '',
    endereco: '',
    ativo: true,
    data_minima_agendamento: '',
    dias_busca_inicial: 14,
    dias_busca_expandida: 45,
    mensagem_bloqueio_padrao: ''
  });
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [clienteStats, setClienteStats] = useState<Record<string, ClienteStats>>({});
  const [loadingStats, setLoadingStats] = useState<string | null>(null);
  const [loadingLLMConfig, setLoadingLLMConfig] = useState(false);
  const { toast } = useToast();
  const { profile, isAdmin } = useStableAuth();
  const queryClient = useQueryClient();

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

  const fetchLLMConfig = async (clienteId: string) => {
    try {
      setLoadingLLMConfig(true);
      const { data, error } = await supabase
        .from('llm_clinic_config')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setLlmConfig(data as LLMConfig | null);
      
      // Atualizar form com dados do LLM config
      if (data) {
        setEditFormData(prev => ({
          ...prev,
          data_minima_agendamento: data.data_minima_agendamento || '',
          dias_busca_inicial: data.dias_busca_inicial || 14,
          dias_busca_expandida: data.dias_busca_expandida || 45,
          mensagem_bloqueio_padrao: data.mensagem_bloqueio_padrao || ''
        }));
      }
    } catch (error: any) {
      console.error('Erro ao buscar config LLM:', error);
    } finally {
      setLoadingLLMConfig(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchClientes();
    }
  }, [isAdmin]);

  const handleCreateCliente = async () => {
    if (!newClienteData.nome.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite o nome da clínica',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      // Criar cliente
      const { data, error } = await supabase.rpc('criar_cliente', {
        p_nome: newClienteData.nome.trim(),
        p_admin_user_id: profile?.user_id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; cliente_id?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar cliente');
      }

      // Atualizar com dados de contato
      if (result.cliente_id) {
        const { error: updateError } = await supabase.rpc('atualizar_cliente', {
          p_cliente_id: result.cliente_id,
          p_telefone: newClienteData.telefone || null,
          p_whatsapp: newClienteData.whatsapp || null,
          p_endereco: newClienteData.endereco || null,
          p_admin_user_id: profile?.user_id
        });

        if (updateError) console.error('Erro ao atualizar contato:', updateError);

        // Criar config LLM inicial
        const { error: llmError } = await supabase.rpc('sincronizar_cliente_llm', {
          p_cliente_id: result.cliente_id,
          p_nome_clinica: newClienteData.nome.trim(),
          p_telefone: newClienteData.telefone || null,
          p_whatsapp: newClienteData.whatsapp || null,
          p_endereco: newClienteData.endereco || null
        });

        if (llmError) console.error('Erro ao criar config LLM:', llmError);
      }

      toast({
        title: 'Sucesso',
        description: 'Clínica criada com sucesso',
      });

      setNewClienteData({ nome: '', telefone: '', whatsapp: '', endereco: '' });
      setShowCreateModal(false);
      fetchClientes();
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
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
      // Atualizar dados básicos do cliente
      const { data, error } = await supabase.rpc('atualizar_cliente', {
        p_cliente_id: editingCliente.id,
        p_nome: editFormData.nome,
        p_ativo: editFormData.ativo,
        p_telefone: editFormData.telefone || null,
        p_whatsapp: editFormData.whatsapp || null,
        p_endereco: editFormData.endereco || null,
        p_admin_user_id: profile?.user_id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar cliente');
      }

      // Sincronizar com llm_clinic_config
      const { error: llmError } = await supabase.rpc('sincronizar_cliente_llm', {
        p_cliente_id: editingCliente.id,
        p_nome_clinica: editFormData.nome,
        p_telefone: editFormData.telefone || null,
        p_whatsapp: editFormData.whatsapp || null,
        p_endereco: editFormData.endereco || null,
        p_data_minima_agendamento: editFormData.data_minima_agendamento || null,
        p_dias_busca_inicial: editFormData.dias_busca_inicial,
        p_dias_busca_expandida: editFormData.dias_busca_expandida,
        p_mensagem_bloqueio_padrao: editFormData.mensagem_bloqueio_padrao || null
      });

      if (llmError) {
        console.error('Erro ao sincronizar LLM config:', llmError);
      }

      toast({
        title: 'Sucesso',
        description: 'Clínica atualizada e sincronizada com sucesso',
      });

      setShowEditModal(false);
      setEditingCliente(null);
      fetchClientes();
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
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

  const openEditModal = async (cliente: Cliente) => {
    setEditingCliente(cliente);
    setEditFormData({
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      whatsapp: cliente.whatsapp || '',
      endereco: cliente.endereco || '',
      ativo: cliente.ativo,
      data_minima_agendamento: '',
      dias_busca_inicial: 14,
      dias_busca_expandida: 45,
      mensagem_bloqueio_padrao: ''
    });
    setLlmConfig(null);
    setShowEditModal(true);
    
    // Buscar config LLM
    await fetchLLMConfig(cliente.id);
  };

  const getConfigStatus = (cliente: Cliente) => {
    const hasContact = cliente.telefone || cliente.whatsapp;
    const hasAddress = cliente.endereco;
    
    if (hasContact && hasAddress) {
      return { status: 'complete', label: 'Completo', variant: 'default' as const };
    } else if (hasContact || hasAddress) {
      return { status: 'partial', label: 'Parcial', variant: 'secondary' as const };
    }
    return { status: 'incomplete', label: 'Incompleto', variant: 'destructive' as const };
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
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gestão de Clínicas
              <Badge variant="secondary" className="ml-2">
                {clientes.length}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              Gerencie clínicas, contatos e configurações da API LLM
            </CardDescription>
          </div>
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
                  <TableHead>Clínica</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Estatísticas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => {
                  const configStatus = getConfigStatus(cliente);
                  return (
                    <TableRow key={cliente.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{cliente.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {cliente.telefone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {cliente.telefone}
                            </span>
                          )}
                          {cliente.whatsapp && (
                            <span className="flex items-center gap-1 text-green-600">
                              <MessageSquare className="h-3 w-3" />
                              {cliente.whatsapp}
                            </span>
                          )}
                          {!cliente.telefone && !cliente.whatsapp && (
                            <span className="text-muted-foreground text-xs">Não configurado</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={configStatus.variant}>
                          {configStatus.status === 'complete' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {configStatus.status === 'incomplete' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {configStatus.label}
                        </Badge>
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
                              'Carregar'
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
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar Clínica */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Nova Clínica
            </DialogTitle>
            <DialogDescription>
              Cadastre uma nova clínica com informações de contato
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Clínica *</Label>
              <Input
                id="nome"
                value={newClienteData.nome}
                onChange={(e) => setNewClienteData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Clínica São José"
              />
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={newClienteData.telefone}
                  onChange={(e) => setNewClienteData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  WhatsApp
                </Label>
                <Input
                  id="whatsapp"
                  value={newClienteData.whatsapp}
                  onChange={(e) => setNewClienteData(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endereco" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Endereço
              </Label>
              <Textarea
                id="endereco"
                value={newClienteData.endereco}
                onChange={(e) => setNewClienteData(prev => ({ ...prev, endereco: e.target.value }))}
                placeholder="Rua, número, bairro, cidade - UF"
                rows={2}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Editar Clínica
            </DialogTitle>
            <DialogDescription>
              Configure informações, contato e API LLM
            </DialogDescription>
          </DialogHeader>
          
          {editingCliente && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info" className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Informações
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Contato
                </TabsTrigger>
                <TabsTrigger value="llm" className="flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  API LLM
                </TabsTrigger>
              </TabsList>
              
              {/* Tab Informações */}
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nome">Nome da Clínica</Label>
                  <Input
                    id="edit-nome"
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, nome: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-ativo"
                    checked={editFormData.ativo}
                    onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, ativo: checked }))}
                  />
                  <Label htmlFor="edit-ativo">Clínica Ativa</Label>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    <strong>ID:</strong> {editingCliente.id}
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Criado em:</strong> {new Date(editingCliente.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </TabsContent>
              
              {/* Tab Contato */}
              <TabsContent value="contact" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-telefone" className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Telefone
                    </Label>
                    <Input
                      id="edit-telefone"
                      value={editFormData.telefone}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, telefone: e.target.value }))}
                      placeholder="(00) 0000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-whatsapp" className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      WhatsApp
                    </Label>
                    <Input
                      id="edit-whatsapp"
                      value={editFormData.whatsapp}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-endereco" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Endereço
                  </Label>
                  <Textarea
                    id="edit-endereco"
                    value={editFormData.endereco}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, endereco: e.target.value }))}
                    placeholder="Rua, número, bairro, cidade - UF"
                    rows={2}
                  />
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-sm">
                  <p className="text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Settings className="h-4 w-4" />
                    Os dados de contato são sincronizados automaticamente com a API LLM
                  </p>
                </div>
              </TabsContent>
              
              {/* Tab LLM */}
              <TabsContent value="llm" className="space-y-4 mt-4">
                {loadingLLMConfig ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-sm mb-4">
                      <p className="text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Bot className="h-4 w-4" />
                        Configurações usadas pelo agente LLM (N8N/WhatsApp)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-data-minima">Data Mínima de Agendamento</Label>
                      <Input
                        id="edit-data-minima"
                        type="date"
                        value={editFormData.data_minima_agendamento}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_minima_agendamento: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Data a partir da qual o agente pode agendar
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-dias-inicial">Dias Busca Inicial</Label>
                        <Input
                          id="edit-dias-inicial"
                          type="number"
                          min={1}
                          max={90}
                          value={editFormData.dias_busca_inicial}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, dias_busca_inicial: parseInt(e.target.value) || 14 }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Janela inicial de busca
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-dias-expandida">Dias Busca Expandida</Label>
                        <Input
                          id="edit-dias-expandida"
                          type="number"
                          min={1}
                          max={180}
                          value={editFormData.dias_busca_expandida}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, dias_busca_expandida: parseInt(e.target.value) || 45 }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Se não achar, expande para
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-mensagem-bloqueio">Mensagem de Bloqueio Padrão</Label>
                      <Textarea
                        id="edit-mensagem-bloqueio"
                        value={editFormData.mensagem_bloqueio_padrao}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, mensagem_bloqueio_padrao: e.target.value }))}
                        placeholder="Mensagem exibida quando a agenda está bloqueada"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Mensagem enviada pelo agente quando não há disponibilidade
                      </p>
                    </div>
                    
                    {llmConfig?.id ? (
                      <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg text-sm">
                        <p className="text-green-700 dark:text-green-300 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Configuração LLM existente - será atualizada
                        </p>
                      </div>
                    ) : (
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-sm">
                        <p className="text-blue-700 dark:text-blue-300 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Nova configuração LLM será criada ao salvar
                        </p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
          
          <DialogFooter className="mt-6">
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
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
