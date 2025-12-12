import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Edit, Building2, Stethoscope, Filter } from 'lucide-react';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { usePagination } from '@/hooks/usePagination';

interface AtendimentoFormData {
  nome: string;
  tipo: 'consulta' | 'exame' | 'procedimento';
  codigo: string;
  valor_particular: number | null;
  coparticipacao_unimed_20: number | null;
  coparticipacao_unimed_40: number | null;
  forma_pagamento: string;
  observacoes: string;
  restricoes: string;
  medico_id: string | null;
  ativo: boolean;
}

const emptyFormData: AtendimentoFormData = {
  nome: '',
  tipo: 'consulta',
  codigo: '',
  valor_particular: null,
  coparticipacao_unimed_20: null,
  coparticipacao_unimed_40: null,
  forma_pagamento: '',
  observacoes: '',
  restricoes: '',
  medico_id: null,
  ativo: true,
};

export function ServiceManagementPanel() {
  const { isAdmin } = useStableAuth();
  const queryClient = useQueryClient();

  // Estados
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [formData, setFormData] = useState<AtendimentoFormData>(emptyFormData);

  // Query: Clínicas (apenas admin global)
  const { data: clinicas = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clientes_ativos');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Auto-selecionar primeira clínica
  if (clinicas.length > 0 && !selectedClinicId) {
    setSelectedClinicId(clinicas[0].id);
  }

  // Query: Atendimentos da clínica selecionada
  const { data: atendimentos = [], isLoading: loadingAtendimentos } = useQuery({
    queryKey: ['atendimentos-admin', selectedClinicId],
    queryFn: async () => {
      if (!selectedClinicId) return [];
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('cliente_id', selectedClinicId)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClinicId,
  });

  // Query: Médicos da clínica (para vínculo opcional)
  const { data: medicos = [] } = useQuery({
    queryKey: ['medicos-admin', selectedClinicId],
    queryFn: async () => {
      if (!selectedClinicId) return [];
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, especialidade')
        .eq('cliente_id', selectedClinicId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClinicId,
  });

  // Filtrar atendimentos
  const filteredAtendimentos = useMemo(() => {
    return atendimentos.filter((atendimento) => {
      const matchesSearch = 
        atendimento.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        atendimento.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipo = filterTipo === 'all' || atendimento.tipo === filterTipo;
      const matchesStatus = 
        filterStatus === 'all' || 
        (filterStatus === 'ativo' && atendimento.ativo) ||
        (filterStatus === 'inativo' && !atendimento.ativo);
      return matchesSearch && matchesTipo && matchesStatus;
    });
  }, [atendimentos, searchTerm, filterTipo, filterStatus]);

  // Paginação
  const pagination = usePagination(filteredAtendimentos, { itemsPerPage: 10 });

  // Mutation: Criar atendimento
  const createMutation = useMutation({
    mutationFn: async (data: AtendimentoFormData) => {
      const { error } = await supabase.from('atendimentos').insert({
        cliente_id: selectedClinicId,
        nome: data.nome,
        tipo: data.tipo,
        codigo: data.codigo || null,
        valor_particular: data.valor_particular,
        coparticipacao_unimed_20: data.coparticipacao_unimed_20,
        coparticipacao_unimed_40: data.coparticipacao_unimed_40,
        forma_pagamento: data.forma_pagamento || null,
        observacoes: data.observacoes || null,
        restricoes: data.restricoes || null,
        medico_id: data.medico_id || null,
        ativo: data.ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Serviço criado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['atendimentos-admin', selectedClinicId] });
      closeModal();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar serviço: ${error.message}`);
    },
  });

  // Mutation: Atualizar atendimento
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AtendimentoFormData }) => {
      const { error } = await supabase.from('atendimentos').update({
        nome: data.nome,
        tipo: data.tipo,
        codigo: data.codigo || null,
        valor_particular: data.valor_particular,
        coparticipacao_unimed_20: data.coparticipacao_unimed_20,
        coparticipacao_unimed_40: data.coparticipacao_unimed_40,
        forma_pagamento: data.forma_pagamento || null,
        observacoes: data.observacoes || null,
        restricoes: data.restricoes || null,
        medico_id: data.medico_id || null,
        ativo: data.ativo,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Serviço atualizado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['atendimentos-admin', selectedClinicId] });
      closeModal();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar serviço: ${error.message}`);
    },
  });

  // Mutation: Toggle status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('atendimentos')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status atualizado');
      queryClient.invalidateQueries({ queryKey: ['atendimentos-admin', selectedClinicId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });

  // Handlers
  const openCreateModal = () => {
    setEditingService(null);
    setFormData(emptyFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (service: any) => {
    setEditingService(service);
    setFormData({
      nome: service.nome || '',
      tipo: service.tipo || 'consulta',
      codigo: service.codigo || '',
      valor_particular: service.valor_particular,
      coparticipacao_unimed_20: service.coparticipacao_unimed_20,
      coparticipacao_unimed_40: service.coparticipacao_unimed_40,
      forma_pagamento: service.forma_pagamento || '',
      observacoes: service.observacoes || '',
      restricoes: service.restricoes || '',
      medico_id: service.medico_id || null,
      ativo: service.ativo ?? true,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData(emptyFormData);
  };

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome do serviço é obrigatório');
      return;
    }

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getTipoBadge = (tipo: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      consulta: 'default',
      exame: 'secondary',
      procedimento: 'outline',
    };
    return <Badge variant={variants[tipo] || 'outline'}>{tipo}</Badge>;
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Acesso restrito a administradores.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Gerenciamento de Serviços/Atendimentos
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecionar clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinicas.map((clinica: any) => (
                      <SelectItem key={clinica.id} value={clinica.id}>
                        {clinica.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={openCreateModal} disabled={!selectedClinicId}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Serviço
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="consulta">Consulta</SelectItem>
                  <SelectItem value="exame">Exame</SelectItem>
                  <SelectItem value="procedimento">Procedimento</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {loadingAtendimentos ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : filteredAtendimentos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {selectedClinicId ? 'Nenhum serviço encontrado.' : 'Selecione uma clínica.'}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor Particular</TableHead>
                    <TableHead>Copart. 20%</TableHead>
                    <TableHead>Copart. 40%</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((atendimento: any) => (
                    <TableRow key={atendimento.id}>
                      <TableCell className="font-medium">{atendimento.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{atendimento.codigo || '-'}</TableCell>
                      <TableCell>{getTipoBadge(atendimento.tipo)}</TableCell>
                      <TableCell>{formatCurrency(atendimento.valor_particular)}</TableCell>
                      <TableCell>{formatCurrency(atendimento.coparticipacao_unimed_20)}</TableCell>
                      <TableCell>{formatCurrency(atendimento.coparticipacao_unimed_40)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={atendimento.ativo}
                          onCheckedChange={(checked) => 
                            toggleStatusMutation.mutate({ id: atendimento.id, ativo: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(atendimento)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 border-t">
                <PaginationControls 
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  onPageChange={pagination.goToPage}
                  onFirstPage={pagination.goToFirstPage}
                  onLastPage={pagination.goToLastPage}
                  onNextPage={pagination.goToNextPage}
                  onPreviousPage={pagination.goToPreviousPage}
                  totalItems={pagination.totalItems}
                  itemsPerPage={pagination.itemsPerPage}
                  showInfo
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar/Editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar Serviço' : 'Novo Serviço'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Consulta Gastro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v: 'consulta' | 'exame' | 'procedimento') => 
                    setFormData({ ...formData, tipo: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consulta">Consulta</SelectItem>
                    <SelectItem value="exame">Exame</SelectItem>
                    <SelectItem value="procedimento">Procedimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ex: CONS-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medico">Médico Vinculado (opcional)</Label>
                <Select
                  value={formData.medico_id || 'none'}
                  onValueChange={(v) => 
                    setFormData({ ...formData, medico_id: v === 'none' ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (disponível para todos)</SelectItem>
                    {medicos.map((medico: any) => (
                      <SelectItem key={medico.id} value={medico.id}>
                        {medico.nome} - {medico.especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_particular">Valor Particular (R$)</Label>
                <Input
                  id="valor_particular"
                  type="number"
                  step="0.01"
                  value={formData.valor_particular || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    valor_particular: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copart_20">Copart. Unimed 20% (R$)</Label>
                <Input
                  id="copart_20"
                  type="number"
                  step="0.01"
                  value={formData.coparticipacao_unimed_20 || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    coparticipacao_unimed_20: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copart_40">Copart. Unimed 40% (R$)</Label>
                <Input
                  id="copart_40"
                  type="number"
                  step="0.01"
                  value={formData.coparticipacao_unimed_40 || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    coparticipacao_unimed_40: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
              <Input
                id="forma_pagamento"
                value={formData.forma_pagamento}
                onChange={(e) => setFormData({ ...formData, forma_pagamento: e.target.value })}
                placeholder="Ex: Dinheiro, Cartão, PIX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações gerais sobre o serviço..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="restricoes">Restrições</Label>
              <Textarea
                id="restricoes"
                value={formData.restricoes}
                onChange={(e) => setFormData({ ...formData, restricoes: e.target.value })}
                placeholder="Ex: Não disponível para menores de 18 anos..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Serviço ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending 
                ? 'Salvando...' 
                : editingService ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
