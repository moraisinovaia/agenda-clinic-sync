import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { RefreshCw, Plus, Pencil, Trash2, FileText, Search, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Preparo {
  id: string;
  nome: string;
  exame: string;
  jejum_horas: number | null;
  restricoes_alimentares: string | null;
  medicacao_suspender: string | null;
  dias_suspensao: number | null;
  itens_levar: string | null;
  valor_particular: number | null;
  valor_convenio: number | null;
  forma_pagamento: string | null;
  observacoes_especiais: string | null;
  observacoes_valor: string | null;
  instrucoes: Record<string, unknown> | null;
  created_at: string;
  cliente_id: string;
}

interface PreparoFormData {
  nome: string;
  exame: string;
  jejum_horas: number | null;
  restricoes_alimentares: string;
  medicacao_suspender: string;
  dias_suspensao: number | null;
  itens_levar: string;
  valor_particular: number | null;
  valor_convenio: number | null;
  forma_pagamento: string;
  observacoes_especiais: string;
  observacoes_valor: string;
}

const FORMAS_PAGAMENTO = [
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
  'Boleto',
  'Convênio'
];

export const PreparosManagementPanel: React.FC = () => {
  const { isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const queryClient = useQueryClient();
  
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPreparo, setEditingPreparo] = useState<Preparo | null>(null);
  const [deletingPreparo, setDeletingPreparo] = useState<Preparo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<PreparoFormData>({
    nome: '',
    exame: '',
    jejum_horas: null,
    restricoes_alimentares: '',
    medicacao_suspender: '',
    dias_suspensao: null,
    itens_levar: '',
    valor_particular: null,
    valor_convenio: null,
    forma_pagamento: '',
    observacoes_especiais: '',
    observacoes_valor: ''
  });

  const effectiveClinicId = isClinicAdmin ? clinicAdminClienteId : selectedClinicId;

  // Buscar clientes (apenas para admin global)
  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clientes_ativos');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !isClinicAdmin
  });

  // Buscar preparos da clínica
  const { data: preparos, isLoading, refetch } = useQuery({
    queryKey: ['preparos-clinica', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      const { data, error } = await supabase
        .from('preparos')
        .select('*')
        .eq('cliente_id', effectiveClinicId)
        .order('nome');
      if (error) throw error;
      return (data || []) as Preparo[];
    },
    enabled: !!effectiveClinicId
  });

  // Buscar exames disponíveis
  const { data: examesDisponiveis } = useQuery({
    queryKey: ['exames-clinica', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      const { data, error } = await supabase
        .from('atendimentos')
        .select('id, nome')
        .eq('cliente_id', effectiveClinicId)
        .eq('tipo', 'exame')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    enabled: !!effectiveClinicId
  });

  // Mutation para criar preparo
  const createMutation = useMutation({
    mutationFn: async (data: PreparoFormData) => {
      if (!effectiveClinicId) throw new Error('Clínica não selecionada');
      
      const { data: result, error } = await supabase
        .from('preparos')
        .insert({
          cliente_id: effectiveClinicId,
          nome: data.nome,
          exame: data.exame,
          jejum_horas: data.jejum_horas,
          restricoes_alimentares: data.restricoes_alimentares || null,
          medicacao_suspender: data.medicacao_suspender || null,
          dias_suspensao: data.dias_suspensao,
          itens_levar: data.itens_levar || null,
          valor_particular: data.valor_particular,
          valor_convenio: data.valor_convenio,
          forma_pagamento: data.forma_pagamento || null,
          observacoes_especiais: data.observacoes_especiais || null,
          observacoes_valor: data.observacoes_valor || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('Preparo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['preparos-clinica'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Mutation para atualizar preparo
  const updateMutation = useMutation({
    mutationFn: async ({ preparoId, data }: { preparoId: string; data: PreparoFormData }) => {
      const { data: result, error } = await supabase
        .from('preparos')
        .update({
          nome: data.nome,
          exame: data.exame,
          jejum_horas: data.jejum_horas,
          restricoes_alimentares: data.restricoes_alimentares || null,
          medicacao_suspender: data.medicacao_suspender || null,
          dias_suspensao: data.dias_suspensao,
          itens_levar: data.itens_levar || null,
          valor_particular: data.valor_particular,
          valor_convenio: data.valor_convenio,
          forma_pagamento: data.forma_pagamento || null,
          observacoes_especiais: data.observacoes_especiais || null,
          observacoes_valor: data.observacoes_valor || null
        })
        .eq('id', preparoId)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('Preparo atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['preparos-clinica'] });
      resetForm();
      setIsDialogOpen(false);
      setEditingPreparo(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Mutation para deletar preparo
  const deleteMutation = useMutation({
    mutationFn: async (preparoId: string) => {
      const { error } = await supabase
        .from('preparos')
        .delete()
        .eq('id', preparoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Preparo excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['preparos-clinica'] });
      setDeletingPreparo(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      exame: '',
      jejum_horas: null,
      restricoes_alimentares: '',
      medicacao_suspender: '',
      dias_suspensao: null,
      itens_levar: '',
      valor_particular: null,
      valor_convenio: null,
      forma_pagamento: '',
      observacoes_especiais: '',
      observacoes_valor: ''
    });
    setEditingPreparo(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (preparo: Preparo) => {
    setEditingPreparo(preparo);
    setFormData({
      nome: preparo.nome,
      exame: preparo.exame,
      jejum_horas: preparo.jejum_horas,
      restricoes_alimentares: preparo.restricoes_alimentares || '',
      medicacao_suspender: preparo.medicacao_suspender || '',
      dias_suspensao: preparo.dias_suspensao,
      itens_levar: preparo.itens_levar || '',
      valor_particular: preparo.valor_particular,
      valor_convenio: preparo.valor_convenio,
      forma_pagamento: preparo.forma_pagamento || '',
      observacoes_especiais: preparo.observacoes_especiais || '',
      observacoes_valor: preparo.observacoes_valor || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome do preparo é obrigatório');
      return;
    }
    if (!formData.exame.trim()) {
      toast.error('Exame relacionado é obrigatório');
      return;
    }

    if (editingPreparo) {
      updateMutation.mutate({ preparoId: editingPreparo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Filtrar preparos pela busca
  const preparosFiltrados = useMemo(() => {
    if (!preparos || !searchTerm.trim()) return preparos || [];
    const termo = searchTerm.toLowerCase().trim();
    return preparos.filter(preparo => 
      preparo.nome.toLowerCase().includes(termo) ||
      preparo.exame.toLowerCase().includes(termo)
    );
  }, [preparos, searchTerm]);

  // Se não é admin nem clinic_admin, não mostrar
  if (!isAdmin && !isClinicAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Preparos para Exames</CardTitle>
            {preparos && (
              <Badge variant="secondary">
                {searchTerm ? `${preparosFiltrados.length} de ${preparos.length}` : `${preparos.length} preparos`}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCreate}
              disabled={!effectiveClinicId}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Preparo
            </Button>
          </div>
        </div>
        <CardDescription>
          Gerencie instruções de preparo para exames
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seletor de clínica (apenas para admin global) */}
        {isAdmin && !isClinicAdmin && (
          <div className="space-y-2">
            <Label>Selecionar Clínica</Label>
            <Select value={selectedClinicId || ''} onValueChange={setSelectedClinicId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma clínica..." />
              </SelectTrigger>
              <SelectContent>
                {clientes?.map((cliente: { id: string; nome: string }) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Campo de pesquisa */}
        {effectiveClinicId && preparos && preparos.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou exame..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Tabela de preparos */}
        {effectiveClinicId && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Exame</TableHead>
                  <TableHead>Jejum</TableHead>
                  <TableHead>Medicação</TableHead>
                  <TableHead>Valores</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : preparosFiltrados && preparosFiltrados.length > 0 ? (
                  preparosFiltrados.map((preparo) => (
                    <TableRow key={preparo.id}>
                      <TableCell className="font-medium">{preparo.nome}</TableCell>
                      <TableCell>{preparo.exame}</TableCell>
                      <TableCell>
                        {preparo.jejum_horas ? (
                          <Badge variant="outline">{preparo.jejum_horas}h</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {preparo.medicacao_suspender ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            <span className="text-xs truncate max-w-[100px]" title={preparo.medicacao_suspender}>
                              {preparo.dias_suspensao ? `${preparo.dias_suspensao}d` : 'Sim'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          {preparo.valor_particular != null && (
                            <span>Part: R$ {preparo.valor_particular.toFixed(2)}</span>
                          )}
                          {preparo.valor_convenio != null && (
                            <span className="text-muted-foreground">Conv: R$ {preparo.valor_convenio.toFixed(2)}</span>
                          )}
                          {preparo.valor_particular == null && preparo.valor_convenio == null && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(preparo)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingPreparo(preparo)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : searchTerm ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum preparo encontrado para "{searchTerm}"
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum preparo cadastrado nesta clínica
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!effectiveClinicId && !isClinicAdmin && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Selecione uma clínica para gerenciar preparos</p>
          </div>
        )}

        {/* Dialog de Criar/Editar */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPreparo ? 'Editar Preparo' : 'Novo Preparo'}
              </DialogTitle>
              <DialogDescription>
                {editingPreparo 
                  ? 'Atualize as instruções de preparo'
                  : 'Preencha as instruções de preparo para o exame'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Nome e Exame */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Preparo *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Preparo Colonoscopia"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exame">Exame Relacionado *</Label>
                  <Select 
                    value={formData.exame} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, exame: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o exame..." />
                    </SelectTrigger>
                    <SelectContent>
                      {examesDisponiveis?.map((exame) => (
                        <SelectItem key={exame.id} value={exame.nome}>{exame.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Ou digite o nome do exame..."
                    value={formData.exame}
                    onChange={(e) => setFormData(prev => ({ ...prev, exame: e.target.value }))}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Jejum */}
              <div className="space-y-2">
                <Label htmlFor="jejum_horas">Jejum (horas)</Label>
                <Input
                  id="jejum_horas"
                  type="number"
                  min={0}
                  placeholder="Ex: 12"
                  value={formData.jejum_horas ?? ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    jejum_horas: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                />
              </div>

              {/* Restrições Alimentares */}
              <div className="space-y-2">
                <Label htmlFor="restricoes_alimentares">Restrições Alimentares</Label>
                <Textarea
                  id="restricoes_alimentares"
                  placeholder="Ex: Evitar alimentos com resíduos, fibras, sementes..."
                  value={formData.restricoes_alimentares}
                  onChange={(e) => setFormData(prev => ({ ...prev, restricoes_alimentares: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Medicação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medicacao_suspender">Medicação a Suspender</Label>
                  <Textarea
                    id="medicacao_suspender"
                    placeholder="Ex: AAS, Anticoagulantes..."
                    value={formData.medicacao_suspender}
                    onChange={(e) => setFormData(prev => ({ ...prev, medicacao_suspender: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_suspensao">Dias de Suspensão</Label>
                  <Input
                    id="dias_suspensao"
                    type="number"
                    min={0}
                    placeholder="Ex: 7"
                    value={formData.dias_suspensao ?? ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      dias_suspensao: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  />
                </div>
              </div>

              {/* Itens para Levar */}
              <div className="space-y-2">
                <Label htmlFor="itens_levar">Itens para Levar</Label>
                <Textarea
                  id="itens_levar"
                  placeholder="Ex: Documento com foto, Cartão do convênio, Exames anteriores..."
                  value={formData.itens_levar}
                  onChange={(e) => setFormData(prev => ({ ...prev, itens_levar: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Valores */}
              <div className="space-y-3 p-4 border rounded-lg">
                <span className="text-sm font-medium">Valores</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valor_particular">Valor Particular (R$)</Label>
                    <Input
                      id="valor_particular"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0,00"
                      value={formData.valor_particular ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        valor_particular: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor_convenio">Valor Convênio (R$)</Label>
                    <Input
                      id="valor_convenio"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0,00"
                      value={formData.valor_convenio ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        valor_convenio: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                    <Select 
                      value={formData.forma_pagamento} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, forma_pagamento: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.map((forma) => (
                          <SelectItem key={forma} value={forma}>{forma}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes_valor">Observações sobre Valores</Label>
                  <Input
                    id="observacoes_valor"
                    placeholder="Ex: Parcelamento em até 3x sem juros..."
                    value={formData.observacoes_valor}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes_valor: e.target.value }))}
                  />
                </div>
              </div>

              {/* Observações Especiais */}
              <div className="space-y-2">
                <Label htmlFor="observacoes_especiais">Observações Especiais</Label>
                <Textarea
                  id="observacoes_especiais"
                  placeholder="Instruções adicionais, avisos importantes..."
                  value={formData.observacoes_especiais}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes_especiais: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingPreparo ? 'Salvar Alterações' : 'Criar Preparo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alert Dialog de Exclusão */}
        <AlertDialog open={!!deletingPreparo} onOpenChange={(open) => !open && setDeletingPreparo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o preparo "{deletingPreparo?.nome}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingPreparo && deleteMutation.mutate(deletingPreparo.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default PreparosManagementPanel;
