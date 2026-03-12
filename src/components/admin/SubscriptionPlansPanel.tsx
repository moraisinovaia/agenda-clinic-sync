import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Pencil, CreditCard, Building2, RefreshCw } from 'lucide-react';

interface PlanData {
  id: string;
  cliente_id: string;
  plano: string;
  status: string;
  max_medicos: number;
  max_usuarios: number;
  max_agendamentos_mes: number;
  max_pacientes: number;
  valor_mensal: number | null;
  data_inicio: string;
  data_fim: string | null;
  trial_ate: string | null;
  dia_vencimento: number | null;
  clientes: { nome: string } | null;
}

interface EditForm {
  plano: string;
  status: string;
  max_medicos: number;
  max_usuarios: number;
  max_agendamentos_mes: number;
  max_pacientes: number;
  valor_mensal: number | null;
  dia_vencimento: number | null;
}

export function SubscriptionPlansPanel() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    plano: 'basico',
    status: 'ativo',
    max_medicos: 10,
    max_usuarios: 5,
    max_agendamentos_mes: 1000,
    max_pacientes: 5000,
    valor_mensal: null,
    dia_vencimento: 10,
  });

  const { data: plans, isLoading, refetch } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_assinatura')
        .select('*, clientes(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PlanData[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EditForm> }) => {
      const { error } = await supabase
        .from('planos_assinatura')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Plano atualizado com sucesso');
      setEditingPlan(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar plano: ' + error.message);
    },
  });

  const handleEdit = (plan: PlanData) => {
    setEditingPlan(plan);
    setEditForm({
      plano: plan.plano,
      status: plan.status,
      max_medicos: plan.max_medicos,
      max_usuarios: plan.max_usuarios,
      max_agendamentos_mes: plan.max_agendamentos_mes,
      max_pacientes: plan.max_pacientes,
      valor_mensal: plan.valor_mensal,
      dia_vencimento: plan.dia_vencimento,
    });
  };

  const handleSave = () => {
    if (!editingPlan) return;
    updateMutation.mutate({ id: editingPlan.id, updates: editForm });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'default';
      case 'trial': return 'secondary';
      case 'suspenso': return 'destructive';
      case 'cancelado': return 'outline';
      default: return 'secondary';
    }
  };

  const planoLabel = (plano: string) => {
    switch (plano) {
      case 'basico': return 'Básico';
      case 'profissional': return 'Profissional';
      case 'enterprise': return 'Enterprise';
      default: return plano;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>Gestão de Planos de Assinatura</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando planos...</p>
        ) : !plans?.length ? (
          <p className="text-muted-foreground text-center py-8">Nenhum plano cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Médicos</TableHead>
                  <TableHead className="text-center">Usuários</TableHead>
                  <TableHead className="text-center">Agend./mês</TableHead>
                  <TableHead className="text-center">Pacientes</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {plan.clientes?.nome || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>{planoLabel(plan.plano)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(plan.status)}>{plan.status}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{plan.max_medicos}</TableCell>
                    <TableCell className="text-center">{plan.max_usuarios}</TableCell>
                    <TableCell className="text-center">{plan.max_agendamentos_mes.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{plan.max_pacientes.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {plan.valor_mensal != null ? `R$ ${plan.valor_mensal.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Plano — {editingPlan?.clientes?.nome}</DialogTitle>
            <DialogDescription>Ajuste os limites e configurações do plano desta clínica.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={editForm.plano} onValueChange={(v) => setEditForm(p => ({ ...p, plano: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Máx. Médicos</Label>
              <Input type="number" value={editForm.max_medicos} onChange={(e) => setEditForm(p => ({ ...p, max_medicos: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Máx. Usuários</Label>
              <Input type="number" value={editForm.max_usuarios} onChange={(e) => setEditForm(p => ({ ...p, max_usuarios: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Máx. Agendamentos/mês</Label>
              <Input type="number" value={editForm.max_agendamentos_mes} onChange={(e) => setEditForm(p => ({ ...p, max_agendamentos_mes: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Máx. Pacientes</Label>
              <Input type="number" value={editForm.max_pacientes} onChange={(e) => setEditForm(p => ({ ...p, max_pacientes: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Valor Mensal (R$)</Label>
              <Input type="number" step="0.01" value={editForm.valor_mensal ?? ''} onChange={(e) => setEditForm(p => ({ ...p, valor_mensal: e.target.value ? parseFloat(e.target.value) : null }))} />
            </div>
            <div className="space-y-2">
              <Label>Dia Vencimento</Label>
              <Input type="number" min={1} max={28} value={editForm.dia_vencimento ?? ''} onChange={(e) => setEditForm(p => ({ ...p, dia_vencimento: e.target.value ? parseInt(e.target.value) : null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
