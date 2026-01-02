import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { RefreshCw, Plus, Pencil, Stethoscope, Users, Search } from 'lucide-react';

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
  ativo: boolean;
  convenios_aceitos: string[] | null;
  idade_minima: number | null;
  idade_maxima: number | null;
  observacoes: string | null;
  horarios: Record<string, unknown> | null;
  created_at: string;
  crm?: string | null;
  rqe?: string | null;
}

interface Atendimento {
  id: string;
  nome: string;
  tipo: string;
}

interface MedicoFormData {
  nome: string;
  especialidade: string;
  convenios_aceitos: string[];
  outroConvenio: string;
  atendimentos_ids: string[];
  outroAtendimento: string;
  outroAtendimentoTipo: string;
  idade_minima: number | null;
  idade_maxima: number | null;
  observacoes: string;
  ativo: boolean;
  // Campos LLM
  tipo_agendamento: 'ordem_chegada' | 'hora_marcada';
  permite_agendamento_online: boolean;
  // Campos de registro profissional
  crm: string;
  rqe: string;
}

const CONVENIOS_DISPONIVEIS = [
  'PARTICULAR',
  'UNIMED',
  'UNIMED 20%',
  'UNIMED 40%',
  'BRADESCO',
  'SULAMERICA',
  'AMIL',
  'HAPVIDA',
  'NOTREDAME',
  'CASSI',
  'GEAP',
  'IPSEMG',
  'PLANSERV',
  'OUTRO'
];

const ESPECIALIDADES_SUGERIDAS = [
  'Gastroenterologia',
  'Endoscopia',
  'Colonoscopia',
  'Clínica Geral',
  'Cardiologia',
  'Dermatologia',
  'Ginecologia',
  'Ortopedia',
  'Pediatria',
  'Neurologia'
];

export const DoctorManagementPanel: React.FC = () => {
  const { isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const queryClient = useQueryClient();
  
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Medico | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<MedicoFormData>({
    nome: '',
    especialidade: '',
    convenios_aceitos: [],
    outroConvenio: '',
    atendimentos_ids: [],
    outroAtendimento: '',
    outroAtendimentoTipo: 'exame',
    idade_minima: null,
    idade_maxima: null,
    observacoes: '',
    ativo: true,
    tipo_agendamento: 'ordem_chegada',
    permite_agendamento_online: true,
    crm: '',
    rqe: ''
  });

  // Para admin_clinica, usar seu cliente_id automaticamente
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

  // Buscar médicos da clínica selecionada
  const { data: medicos, isLoading, refetch } = useQuery({
    queryKey: ['medicos-por-clinica', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      const { data, error } = await supabase.rpc('get_medicos_por_clinica', {
        p_cliente_id: effectiveClinicId
      });
      if (error) throw error;
      return (data || []) as Medico[];
    },
    enabled: !!effectiveClinicId
  });

  // Buscar atendimentos disponíveis da clínica
  const { data: atendimentosDisponiveis } = useQuery({
    queryKey: ['atendimentos-clinica', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      const { data, error } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo, medico_id')
        .eq('cliente_id', effectiveClinicId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as (Atendimento & { medico_id?: string })[];
    },
    enabled: !!effectiveClinicId
  });

  // Mutation para criar médico
  const createMutation = useMutation({
    mutationFn: async (data: MedicoFormData) => {
      if (!effectiveClinicId) throw new Error('Clínica não selecionada');
      
      const { data: result, error } = await supabase.rpc('criar_medico', {
        p_cliente_id: effectiveClinicId,
        p_nome: data.nome,
        p_especialidade: data.especialidade,
        p_convenios_aceitos: data.convenios_aceitos.length > 0 ? data.convenios_aceitos : null,
        p_idade_minima: data.idade_minima || 0,
        p_idade_maxima: data.idade_maxima,
        p_observacoes: data.observacoes || null,
        p_atendimentos_ids: data.atendimentos_ids.length > 0 ? data.atendimentos_ids : null
      });
      
      if (error) throw error;
      
      const resultObj = result as { success: boolean; error?: string; message?: string };
      if (!resultObj.success) {
        throw new Error(resultObj.error || 'Erro ao criar médico');
      }
      
      return resultObj;
    },
    onSuccess: () => {
      toast.success('Médico criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['medicos-por-clinica'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Mutation para atualizar médico
  const updateMutation = useMutation({
    mutationFn: async ({ medicoId, data }: { medicoId: string; data: MedicoFormData }) => {
      const { data: result, error } = await supabase.rpc('atualizar_medico', {
        p_medico_id: medicoId,
        p_dados: {
          nome: data.nome,
          especialidade: data.especialidade,
          ativo: data.ativo,
          convenios_aceitos: data.convenios_aceitos,
          idade_minima: data.idade_minima,
          idade_maxima: data.idade_maxima,
          observacoes: data.observacoes,
          crm: data.crm || null,
          rqe: data.rqe || null,
          horarios: {
            tipo_agendamento: data.tipo_agendamento,
            permite_agendamento_online: data.permite_agendamento_online
          }
        },
        p_atendimentos_ids: data.atendimentos_ids.length > 0 ? data.atendimentos_ids : []
      });
      
      if (error) throw error;
      
      const resultObj = result as { success: boolean; error?: string; message?: string };
      if (!resultObj.success) {
        throw new Error(resultObj.error || 'Erro ao atualizar médico');
      }
      
      return resultObj;
    },
    onSuccess: () => {
      toast.success('Médico atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['medicos-por-clinica'] });
      resetForm();
      setIsDialogOpen(false);
      setEditingDoctor(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      especialidade: '',
      convenios_aceitos: [],
      outroConvenio: '',
      atendimentos_ids: [],
      outroAtendimento: '',
      outroAtendimentoTipo: 'exame',
      idade_minima: null,
      idade_maxima: null,
      observacoes: '',
      ativo: true,
      tipo_agendamento: 'ordem_chegada',
      permite_agendamento_online: true,
      crm: '',
      rqe: ''
    });
    setEditingDoctor(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (medico: Medico) => {
    setEditingDoctor(medico);
    
    // Separar convênios padrão dos personalizados
    const conveniosPadrao = medico.convenios_aceitos?.filter(c => CONVENIOS_DISPONIVEIS.includes(c)) || [];
    const conveniosPersonalizados = medico.convenios_aceitos?.filter(c => !CONVENIOS_DISPONIVEIS.includes(c)) || [];
    const outroConvenioExistente = conveniosPersonalizados.length > 0 ? conveniosPersonalizados.join(', ') : '';
    
    // Buscar atendimentos vinculados ao médico
    const atendimentosDoMedico = atendimentosDisponiveis?.filter(a => 
      a.medico_id === medico.id
    ).map(a => a.id) || [];
    
    setFormData({
      nome: medico.nome,
      especialidade: medico.especialidade,
      convenios_aceitos: conveniosPersonalizados.length > 0 
        ? [...conveniosPadrao, 'OUTRO'] 
        : conveniosPadrao,
      outroConvenio: outroConvenioExistente,
      atendimentos_ids: atendimentosDoMedico,
      outroAtendimento: '',
      outroAtendimentoTipo: 'exame',
      idade_minima: medico.idade_minima,
      idade_maxima: medico.idade_maxima,
      observacoes: medico.observacoes || '',
      ativo: medico.ativo,
      tipo_agendamento: (medico.horarios?.tipo_agendamento as 'ordem_chegada' | 'hora_marcada') || 'ordem_chegada',
      permite_agendamento_online: medico.horarios?.permite_agendamento_online !== false,
      crm: medico.crm || '',
      rqe: medico.rqe || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome do médico é obrigatório');
      return;
    }
    if (!formData.especialidade.trim()) {
      toast.error('Especialidade é obrigatória');
      return;
    }

    // Processar convênios: remover "OUTRO" e adicionar o convênio personalizado
    const conveniosFinal = [
      ...formData.convenios_aceitos.filter(c => c !== 'OUTRO'),
      ...(formData.outroConvenio.trim() ? [formData.outroConvenio.trim().toUpperCase()] : [])
    ];

    let atendimentosIdsFinal = [...formData.atendimentos_ids];

    // Se há atendimento personalizado, criar primeiro
    if (formData.outroAtendimento.trim() && effectiveClinicId) {
      try {
        const { data: novoAtendimento, error: atendError } = await supabase
          .from('atendimentos')
          .insert({
            cliente_id: effectiveClinicId,
            nome: formData.outroAtendimento.trim(),
            tipo: formData.outroAtendimentoTipo,
            ativo: true
          })
          .select('id')
          .single();
        
        if (atendError) {
          toast.error('Erro ao criar atendimento personalizado: ' + atendError.message);
          return;
        }
        
        if (novoAtendimento) {
          atendimentosIdsFinal.push(novoAtendimento.id);
          queryClient.invalidateQueries({ queryKey: ['atendimentos-clinica'] });
        }
      } catch (err) {
        toast.error('Erro ao criar atendimento personalizado');
        return;
      }
    }

    const dataToSubmit = {
      ...formData,
      convenios_aceitos: conveniosFinal,
      atendimentos_ids: atendimentosIdsFinal
    };

    if (editingDoctor) {
      updateMutation.mutate({ medicoId: editingDoctor.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleAtendimentoToggle = (atendimentoId: string) => {
    setFormData(prev => ({
      ...prev,
      atendimentos_ids: prev.atendimentos_ids.includes(atendimentoId)
        ? prev.atendimentos_ids.filter(id => id !== atendimentoId)
        : [...prev.atendimentos_ids, atendimentoId]
    }));
  };

  const handleConvenioToggle = (convenio: string) => {
    setFormData(prev => ({
      ...prev,
      convenios_aceitos: prev.convenios_aceitos.includes(convenio)
        ? prev.convenios_aceitos.filter(c => c !== convenio)
        : [...prev.convenios_aceitos, convenio]
    }));
  };

  // Especialidades únicas dos médicos existentes
  const especialidadesExistentes = useMemo(() => {
    if (!medicos) return ESPECIALIDADES_SUGERIDAS;
    const existentes = [...new Set(medicos.map(m => m.especialidade))];
    return [...new Set([...existentes, ...ESPECIALIDADES_SUGERIDAS])].sort();
  }, [medicos]);

  // Filtrar médicos pela busca
  const medicosFiltrados = useMemo(() => {
    if (!medicos || !searchTerm.trim()) return medicos || [];
    const termo = searchTerm.toLowerCase().trim();
    return medicos.filter(medico => 
      medico.nome.toLowerCase().includes(termo) ||
      medico.especialidade.toLowerCase().includes(termo)
    );
  }, [medicos, searchTerm]);

  // Se não é admin nem clinic_admin, não mostrar
  if (!isAdmin && !isClinicAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <CardTitle>Gestão de Médicos</CardTitle>
            {medicos && (
              <Badge variant="secondary">
                {searchTerm ? `${medicosFiltrados.length} de ${medicos.length}` : `${medicos.length} médicos`}
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
              Novo Médico
            </Button>
          </div>
        </div>
        <CardDescription>
          {isClinicAdmin 
            ? 'Gerencie os médicos da sua clínica' 
            : 'Gerencie médicos por clínica'}
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
        {effectiveClinicId && medicos && medicos.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Tabela de médicos */}
        {effectiveClinicId && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CRM/RQE</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Convênios</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : medicosFiltrados && medicosFiltrados.length > 0 ? (
                  medicosFiltrados.map((medico) => {
                    const tipoAgendamento = (medico.horarios?.tipo_agendamento as string) || 'ordem_chegada';
                    const permiteOnline = medico.horarios?.permite_agendamento_online !== false;
                    return (
                      <TableRow key={medico.id}>
                        <TableCell className="font-medium">{medico.nome}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-xs">
                            {medico.crm && <span className="text-muted-foreground">CRM: {medico.crm}</span>}
                            {medico.rqe && <span className="text-muted-foreground">RQE: {medico.rqe}</span>}
                            {!medico.crm && !medico.rqe && <span className="text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>{medico.especialidade}</TableCell>
                        <TableCell>
                          {medico.convenios_aceitos?.length ? (
                            <Badge variant="outline">
                              {medico.convenios_aceitos.length} aceitos
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="text-xs w-fit">
                              {tipoAgendamento === 'hora_marcada' ? 'Hora Marcada' : 'Ordem Chegada'}
                            </Badge>
                            {permiteOnline && (
                              <Badge variant="outline" className="text-xs w-fit text-green-600 border-green-300">
                                Online
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={medico.ativo ? 'default' : 'secondary'}>
                            {medico.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(medico)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : searchTerm ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum médico encontrado para "{searchTerm}"
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum médico cadastrado nesta clínica
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!effectiveClinicId && !isClinicAdmin && (
          <div className="text-center py-8 text-muted-foreground">
            <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Selecione uma clínica para gerenciar seus médicos</p>
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
                {editingDoctor ? 'Editar Médico' : 'Novo Médico'}
              </DialogTitle>
              <DialogDescription>
                {editingDoctor 
                  ? 'Atualize as informações do médico'
                  : 'Preencha as informações para cadastrar um novo médico'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Dr. João Silva"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>

              {/* CRM e RQE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crm">CRM</Label>
                  <Input
                    id="crm"
                    placeholder="Ex: 12345/MG"
                    value={formData.crm}
                    onChange={(e) => setFormData(prev => ({ ...prev, crm: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rqe">RQE</Label>
                  <Input
                    id="rqe"
                    placeholder="Ex: 54321"
                    value={formData.rqe}
                    onChange={(e) => setFormData(prev => ({ ...prev, rqe: e.target.value }))}
                  />
                </div>
              </div>

              {/* Especialidade */}
              <div className="space-y-2">
                <Label htmlFor="especialidade">Especialidade *</Label>
                <Select 
                  value={formData.especialidade} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, especialidade: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite..." />
                  </SelectTrigger>
                  <SelectContent>
                    {especialidadesExistentes.map((esp) => (
                      <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Ou digite uma especialidade personalizada..."
                  value={formData.especialidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, especialidade: e.target.value }))}
                  className="mt-2"
                />
              </div>

              {/* Status (apenas edição) */}
              {editingDoctor && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="ativo">Médico Ativo</Label>
                  <Switch
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                  />
                </div>
              )}

              {/* Configuração LLM / Agendamento Online */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">LLM API</Badge>
                  <span className="text-sm font-medium">Configuração de Agendamento</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_agendamento">Tipo de Agendamento</Label>
                    <Select 
                      value={formData.tipo_agendamento} 
                      onValueChange={(value: 'ordem_chegada' | 'hora_marcada') => 
                        setFormData(prev => ({ ...prev, tipo_agendamento: value }))
                      }
                    >
                      <SelectTrigger id="tipo_agendamento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ordem_chegada">Ordem de Chegada</SelectItem>
                        <SelectItem value="hora_marcada">Hora Marcada</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define como os horários são distribuídos para pacientes
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="permite_agendamento_online">Agendamento Online</Label>
                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <span className="text-sm">
                        {formData.permite_agendamento_online ? 'Habilitado' : 'Desabilitado'}
                      </span>
                      <Switch
                        id="permite_agendamento_online"
                        checked={formData.permite_agendamento_online}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, permite_agendamento_online: checked }))
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Permite agendamentos via WhatsApp/Bot
                    </p>
                  </div>
                </div>
              </div>

              {/* Convênios */}
              <div className="space-y-2">
                <Label>Convênios Aceitos</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-lg">
                  {CONVENIOS_DISPONIVEIS.map((convenio) => (
                    <div key={convenio} className="flex items-center space-x-2">
                      <Checkbox
                        id={`conv-${convenio}`}
                        checked={formData.convenios_aceitos.includes(convenio)}
                        onCheckedChange={() => handleConvenioToggle(convenio)}
                      />
                      <label 
                        htmlFor={`conv-${convenio}`}
                        className="text-sm cursor-pointer"
                      >
                        {convenio}
                      </label>
                    </div>
                  ))}
                </div>
                
                {/* Campo condicional para "Outro Convênio" */}
                {formData.convenios_aceitos.includes('OUTRO') && (
                  <div className="mt-2">
                    <Input
                      placeholder="Digite o nome do outro convênio..."
                      value={formData.outroConvenio}
                      onChange={(e) => setFormData(prev => ({ ...prev, outroConvenio: e.target.value }))}
                      className="border-dashed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      O convênio será salvo em MAIÚSCULAS
                    </p>
                  </div>
                )}
              </div>

              {/* Tipos de Atendimento */}
              <div className="space-y-2">
                <Label>Tipos de Atendimento</Label>
                <div className="p-3 border rounded-lg space-y-3">
                  {atendimentosDisponiveis && atendimentosDisponiveis.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {atendimentosDisponiveis.map((atend) => (
                        <div key={atend.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`atend-${atend.id}`}
                            checked={formData.atendimentos_ids.includes(atend.id)}
                            onCheckedChange={() => handleAtendimentoToggle(atend.id)}
                          />
                          <label 
                            htmlFor={`atend-${atend.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {atend.nome}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({atend.tipo})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum tipo de atendimento cadastrado para esta clínica
                    </p>
                  )}
                  
                  {/* Opção para adicionar atendimento personalizado */}
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-sm font-medium">Adicionar outro atendimento:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Nome do atendimento..."
                        value={formData.outroAtendimento}
                        onChange={(e) => setFormData(prev => ({ ...prev, outroAtendimento: e.target.value }))}
                        className="border-dashed"
                      />
                      <Select 
                        value={formData.outroAtendimentoTipo}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, outroAtendimentoTipo: value }))}
                      >
                        <SelectTrigger className="border-dashed">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consulta">Consulta</SelectItem>
                          <SelectItem value="exame">Exame</SelectItem>
                          <SelectItem value="procedimento">Procedimento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O atendimento será criado automaticamente na clínica ao salvar
                    </p>
                  </div>
                </div>
              </div>

              {/* Faixa etária */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="idade_minima">Idade Mínima</Label>
                  <Input
                    id="idade_minima"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formData.idade_minima ?? ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      idade_minima: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idade_maxima">Idade Máxima</Label>
                  <Input
                    id="idade_maxima"
                    type="number"
                    min={0}
                    placeholder="Sem limite"
                    value={formData.idade_maxima ?? ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      idade_maxima: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações adicionais sobre o médico..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
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
                {editingDoctor ? 'Salvar Alterações' : 'Criar Médico'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default DoctorManagementPanel;
